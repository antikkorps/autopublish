import fs from "fs/promises"

export interface InstagramCredentials {
  accessToken: string
  accountId: string
  pageId?: string // Optionnel pour Instagram Login direct
}

export interface InstagramPostOptions {
  caption: string
  imagePath: string
  hashtags?: string[]
  location?: {
    name: string
    latitude?: number
    longitude?: number
  }
  userTags?: Array<{
    username: string
    x: number
    y: number
  }>
}

export interface InstagramPostResult {
  id: string
  permalink: string
  timestamp: string
}

export interface InstagramMediaContainer {
  id: string
  status: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED"
}

class InstagramService {
  private readonly apiVersion = "v21.0"
  private readonly baseUrl = "https://graph.facebook.com"
  private readonly instagramUrl = "https://graph.instagram.com"

  constructor() {
    // Vérifier la configuration
    this.validateConfiguration()
  }

  /**
   * Valide la configuration Instagram
   */
  private validateConfiguration(): void {
    const requiredEnvVars = ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_ACCOUNT_ID"]

    const missingVars = requiredEnvVars.filter((varName) => !process.env[varName])

    if (missingVars.length > 0) {
      console.warn(
        `⚠️  Variables d'environnement Instagram manquantes: ${missingVars.join(", ")}`
      )
      console.warn("Publication Instagram désactivée jusqu'à configuration complète")
    }
  }

  /**
   * Vérifie si le service Instagram est configuré
   */
  isConfigured(): boolean {
    return !!(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_ACCOUNT_ID)
  }

  /**
   * Utilitaire pour construire des URLs avec paramètres
   */
  private buildUrl(baseUrl: string, params: Record<string, string>): string {
    const url = new URL(baseUrl)
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })
    return url.toString()
  }

  /**
   * Utilitaire pour gérer les réponses fetch
   */
  private async handleResponse(response: Response): Promise<any> {
    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: { message: response.statusText } }))
      throw new Error(
        errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
      )
    }
    return response.json()
  }

  /**
   * Obtient les informations du compte Instagram
   */
  async getAccountInfo(credentials: InstagramCredentials): Promise<any> {
    try {
      const url = this.buildUrl(
        `${this.instagramUrl}/${this.apiVersion}/${credentials.accountId}`,
        {
          fields:
            "account_type,media_count,followers_count,follows_count,name,username,profile_picture_url",
          access_token: credentials.accessToken,
        }
      )

      const response = await fetch(url)
      return this.handleResponse(response)
    } catch (error) {
      console.error("Erreur lors de la récupération des infos compte:", error)
      throw new Error("Impossible de récupérer les informations du compte Instagram")
    }
  }

  /**
   * Vérifie les limites de publication
   */
  async checkPublishingLimits(credentials: InstagramCredentials): Promise<{
    quota_usage: number
    config: {
      quota_total: number
      quota_duration: number
    }
  }> {
    try {
      const url = this.buildUrl(
        `${this.instagramUrl}/${this.apiVersion}/${credentials.accountId}/content_publishing_limit`,
        {
          access_token: credentials.accessToken,
        }
      )

      const response = await fetch(url)
      const data = await this.handleResponse(response)
      return data.data[0]
    } catch (error) {
      console.error("Erreur lors de la vérification des limites:", error)
      throw new Error("Impossible de vérifier les limites de publication")
    }
  }

  /**
   * Crée un conteneur média pour une image
   */
  async createMediaContainer(
    credentials: InstagramCredentials,
    options: InstagramPostOptions
  ): Promise<InstagramMediaContainer> {
    try {
      // Préparer la légende avec hashtags
      let caption = options.caption
      if (options.hashtags && options.hashtags.length > 0) {
        caption += "\n\n" + options.hashtags.map((tag) => `#${tag}`).join(" ")
      }

      // Lire le fichier image et le convertir en base64
      const imageBuffer = await fs.readFile(options.imagePath)
      const imageBase64 = imageBuffer.toString("base64")
      const imageUrl = `data:image/jpeg;base64,${imageBase64}`

      const params: any = {
        image_url: imageUrl,
        caption: caption,
        access_token: credentials.accessToken,
      }

      // Ajouter les tags utilisateur si spécifiés
      if (options.userTags && options.userTags.length > 0) {
        params.user_tags = JSON.stringify(options.userTags)
      }

      // Ajouter la localisation si spécifiée
      if (options.location) {
        params.location_id = options.location.name
      }

      const response = await fetch(
        `${this.instagramUrl}/${this.apiVersion}/${credentials.accountId}/media`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
        }
      )

      const data = await this.handleResponse(response)
      return { id: data.id, status: "IN_PROGRESS" }
    } catch (error: any) {
      console.error("Erreur lors de la création du conteneur média:", error.message)
      throw new Error(`Impossible de créer le conteneur média: ${error.message}`)
    }
  }

  /**
   * Vérifie le statut d'un conteneur média
   */
  async checkContainerStatus(
    credentials: InstagramCredentials,
    containerId: string
  ): Promise<InstagramMediaContainer> {
    try {
      const url = this.buildUrl(
        `${this.instagramUrl}/${this.apiVersion}/${containerId}`,
        {
          fields: "status_code",
          access_token: credentials.accessToken,
        }
      )

      const response = await fetch(url)
      const data = await this.handleResponse(response)

      return {
        id: containerId,
        status: data.status_code,
      }
    } catch (error) {
      console.error("Erreur lors de la vérification du statut:", error)
      throw new Error("Impossible de vérifier le statut du conteneur")
    }
  }

  /**
   * Publie un conteneur média
   */
  async publishMediaContainer(
    credentials: InstagramCredentials,
    containerId: string
  ): Promise<InstagramPostResult> {
    try {
      const response = await fetch(
        `${this.instagramUrl}/${this.apiVersion}/${credentials.accountId}/media_publish`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            creation_id: containerId,
            access_token: credentials.accessToken,
          }),
        }
      )

      const data = await this.handleResponse(response)

      // Récupérer les détails du post publié
      const postDetails = await this.getPostDetails(credentials, data.id)

      return {
        id: data.id,
        permalink: postDetails.permalink,
        timestamp: postDetails.timestamp,
      }
    } catch (error: any) {
      console.error("Erreur lors de la publication:", error.message)
      throw new Error(`Impossible de publier le conteneur: ${error.message}`)
    }
  }

  /**
   * Récupère les détails d'un post publié
   */
  async getPostDetails(credentials: InstagramCredentials, postId: string): Promise<any> {
    try {
      const url = this.buildUrl(`${this.instagramUrl}/${this.apiVersion}/${postId}`, {
        fields:
          "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count",
        access_token: credentials.accessToken,
      })

      const response = await fetch(url)
      return this.handleResponse(response)
    } catch (error) {
      console.error("Erreur lors de la récupération des détails:", error)
      throw new Error("Impossible de récupérer les détails du post")
    }
  }

  /**
   * Publie une image sur Instagram (méthode complète)
   */
  async publishImage(
    credentials: InstagramCredentials,
    options: InstagramPostOptions
  ): Promise<InstagramPostResult> {
    try {
      console.log("🚀 Début de la publication Instagram...")

      // 1. Vérifier les limites
      const limits = await this.checkPublishingLimits(credentials)
      console.log(
        `📊 Utilisation quota: ${limits.quota_usage}/${limits.config.quota_total}`
      )

      if (limits.quota_usage >= limits.config.quota_total) {
        throw new Error("Limite de publication Instagram atteinte (100 posts/24h)")
      }

      // 2. Créer le conteneur média
      console.log("📦 Création du conteneur média...")
      const container = await this.createMediaContainer(credentials, options)

      // 3. Attendre que le conteneur soit prêt (polling)
      console.log("⏳ Attente du traitement du média...")
      let attempts = 0
      const maxAttempts = 30 // 5 minutes max

      while (attempts < maxAttempts) {
        const status = await this.checkContainerStatus(credentials, container.id)

        if (status.status === "FINISHED") {
          console.log("✅ Conteneur prêt pour publication")
          break
        } else if (status.status === "ERROR") {
          throw new Error("Erreur lors du traitement du média")
        } else if (status.status === "EXPIRED") {
          throw new Error("Le conteneur a expiré (>24h)")
        }

        // Attendre 10 secondes avant la prochaine vérification
        await new Promise((resolve) => setTimeout(resolve, 10000))
        attempts++
      }

      if (attempts >= maxAttempts) {
        throw new Error("Timeout lors du traitement du média")
      }

      // 4. Publier le conteneur
      console.log("📤 Publication du post...")
      const result = await this.publishMediaContainer(credentials, container.id)

      console.log("🎉 Publication Instagram réussie!")
      console.log(`📱 Post ID: ${result.id}`)
      console.log(`🔗 Lien: ${result.permalink}`)

      return result
    } catch (error) {
      console.error("❌ Erreur lors de la publication Instagram:", error)
      throw error
    }
  }

  /**
   * Récupère les métriques d'engagement d'un post
   */
  async getPostMetrics(credentials: InstagramCredentials, postId: string): Promise<any> {
    try {
      const url = this.buildUrl(
        `${this.instagramUrl}/${this.apiVersion}/${postId}/insights`,
        {
          metric: "engagement,impressions,reach,likes,comments,saves,shares",
          access_token: credentials.accessToken,
        }
      )

      const response = await fetch(url)
      const data = await this.handleResponse(response)
      return data.data
    } catch (error) {
      console.error("Erreur lors de la récupération des métriques:", error)
      return null
    }
  }

  /**
   * Teste la connexion Instagram
   */
  async testConnection(credentials: InstagramCredentials): Promise<boolean> {
    try {
      await this.getAccountInfo(credentials)
      console.log("✅ Connexion Instagram réussie")
      return true
    } catch (error) {
      console.error("❌ Échec de la connexion Instagram:", error)
      return false
    }
  }

  /**
   * Génère des hashtags automatiques basés sur le thème
   */
  generateHashtags(theme: string, language: string = "fr"): string[] {
    const hashtagsMap: { [key: string]: { [lang: string]: string[] } } = {
      motivation: {
        fr: [
          "motivation",
          "inspiration",
          "succes",
          "reussite",
          "mindset",
          "positif",
          "goals",
          "reves",
        ],
        en: [
          "motivation",
          "inspiration",
          "success",
          "mindset",
          "positive",
          "goals",
          "dreams",
          "hustle",
        ],
      },
      wisdom: {
        fr: [
          "sagesse",
          "reflexion",
          "philosophie",
          "pensee",
          "meditation",
          "vie",
          "experience",
        ],
        en: [
          "wisdom",
          "reflection",
          "philosophy",
          "thoughts",
          "meditation",
          "life",
          "experience",
        ],
      },
      success: {
        fr: [
          "succes",
          "reussite",
          "entrepreneur",
          "business",
          "objectifs",
          "ambition",
          "leadership",
        ],
        en: [
          "success",
          "achievement",
          "entrepreneur",
          "business",
          "goals",
          "ambition",
          "leadership",
        ],
      },
      life: {
        fr: ["vie", "bonheur", "joie", "quotidien", "moment", "present", "gratitude"],
        en: ["life", "happiness", "joy", "daily", "moment", "present", "gratitude"],
      },
      love: {
        fr: ["amour", "coeur", "relation", "couple", "tendresse", "affection", "romance"],
        en: [
          "love",
          "heart",
          "relationship",
          "couple",
          "tenderness",
          "affection",
          "romance",
        ],
      },
      parentalite: {
        fr: [
          "parentalite",
          "parent",
          "enfants",
          "famille",
          "education",
          "amourparental",
          "elever",
          "maternite",
        ],
        en: [
          "parenting",
          "parent",
          "children",
          "family",
          "education",
          "parentallove",
          "raising",
          "motherhood",
        ],
      },
      education: {
        fr: [
          "education",
          "apprentissage",
          "enseignement",
          "enfants",
          "ecole",
          "savoir",
          "transmission",
          "pedagogie",
        ],
        en: [
          "education",
          "learning",
          "teaching",
          "children",
          "school",
          "knowledge",
          "transmission",
          "pedagogy",
        ],
      },
      famille: {
        fr: [
          "famille",
          "liens",
          "ensemble",
          "amour",
          "unite",
          "foyer",
          "parentenfant",
          "bonheur",
        ],
        en: [
          "family",
          "bonds",
          "together",
          "love",
          "unity",
          "home",
          "parentchild",
          "happiness",
        ],
      },
      enfance: {
        fr: [
          "enfance",
          "enfants",
          "innocence",
          "jeu",
          "developpement",
          "croissance",
          "rire",
          "decouvertes",
        ],
        en: [
          "childhood",
          "children",
          "innocence",
          "play",
          "development",
          "growth",
          "laughter",
          "discoveries",
        ],
      },
    }

    const themeHashtags =
      hashtagsMap[theme]?.[language] || hashtagsMap[theme]?.["en"] || []
    const generalHashtags =
      language === "fr"
        ? ["citation", "penseedujour", "motivation", "inspiration"]
        : ["quote", "thoughtoftheday", "motivation", "inspiration"]

    return [...themeHashtags.slice(0, 5), ...generalHashtags.slice(0, 3)]
  }
}

export default new InstagramService()
