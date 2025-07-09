import sequelize from "../config/database"
import Citation from "../models/Citation"
import Post from "../models/Post"
import aiService from "./aiService"
import imageService from "./imageService"
import instagramService, { InstagramCredentials } from "./instagramService"
import videoService from "./videoService"

export interface DailyConfig {
  totalCitations: number
  themes: {
    [key: string]: {
      count: number
      style?: "motivational" | "philosophical" | "practical" | "inspirational"
    }
  }
  language: string
  minQualityScore: number
  generateImages: boolean
  generateVideos: boolean
  publishToInstagram: boolean
  instagramCredentials?: InstagramCredentials
}

// Configuration par défaut pour la génération quotidienne
export const DEFAULT_CONFIG: DailyConfig = {
  totalCitations: 12, // 12 citations par jour pour inclure les nouveaux thèmes
  themes: {
    motivation: { count: 3, style: "motivational" },
    wisdom: { count: 2, style: "philosophical" },
    success: { count: 2, style: "practical" },
    life: { count: 2, style: "inspirational" },
    love: { count: 1, style: "inspirational" },
    parentalite: { count: 1, style: "inspirational" },
    famille: { count: 1, style: "philosophical" },
  },
  language: "fr",
  minQualityScore: 0.6,
  generateImages: true,
  generateVideos: false, // Désactivé par défaut car plus coûteux
  publishToInstagram: false, // Désactivé par défaut
}

export class DailyGenerationService {
  private config: DailyConfig
  private stats = {
    generated: 0,
    saved: 0,
    failed: 0,
    withImages: 0,
    withVideos: 0,
    published: 0,
    publishFailed: 0,
  }

  constructor(config: Partial<DailyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }

    // Configuration automatique des credentials Instagram depuis l'environnement
    if (!this.config.instagramCredentials && instagramService.isConfigured()) {
      this.config.instagramCredentials = {
        accessToken: process.env.INSTAGRAM_ACCESS_TOKEN!,
        accountId: process.env.INSTAGRAM_ACCOUNT_ID!,
      }
      this.config.publishToInstagram = true
    }
  }

  async generate(): Promise<typeof this.stats> {
    console.log("🚀 Démarrage de la génération quotidienne de citations...")
    console.log(
      `📊 Configuration: ${this.config.totalCitations} citations réparties sur ${
        Object.keys(this.config.themes).length
      } thèmes`
    )

    if (this.config.publishToInstagram) {
      console.log("📱 Publication Instagram activée")
    }

    // Réinitialiser les stats
    this.stats = {
      generated: 0,
      saved: 0,
      failed: 0,
      withImages: 0,
      withVideos: 0,
      published: 0,
      publishFailed: 0,
    }

    try {
      // Initialiser la base de données
      await sequelize.authenticate()
      console.log("✅ Connexion à la base de données établie")

      // Générer les citations pour chaque thème
      for (const [theme, themeConfig] of Object.entries(this.config.themes)) {
        await this.generateForTheme(theme, themeConfig)
      }

      // Afficher les statistiques finales
      this.displayStats()
      return this.stats
    } catch (error) {
      console.error("❌ Erreur lors de la génération quotidienne:", error)
      throw error
    }
  }

  private async generateForTheme(
    theme: string,
    themeConfig: { count: number; style?: string }
  ): Promise<void> {
    console.log(
      `\n🎨 Génération pour le thème "${theme}" (${themeConfig.count} citations)`
    )

    try {
      // Générer les citations avec l'IA
      const generatedCitations = await aiService.generateCitations(
        {
          theme,
          language: this.config.language,
          count: themeConfig.count,
          style: themeConfig.style as
            | "motivational"
            | "philosophical"
            | "practical"
            | "inspirational",
        },
        "openai"
      )

      this.stats.generated += generatedCitations.length
      console.log(`   📝 ${generatedCitations.length} citations générées`)

      // Filtrer par qualité
      const qualityCitations = generatedCitations.filter(
        (citation) => citation.quality_score >= this.config.minQualityScore
      )

      console.log(
        `   ✨ ${qualityCitations.length}/${generatedCitations.length} citations passent le filtre qualité (${this.config.minQualityScore})`
      )

      // Sauvegarder les citations de qualité
      for (const generatedCitation of qualityCitations) {
        await this.saveCitation(generatedCitation, theme)
      }
    } catch (error) {
      console.error(`   ❌ Erreur pour le thème ${theme}:`, error)
      this.stats.failed += themeConfig.count
    }
  }

  private async saveCitation(generatedCitation: any, theme: string): Promise<void> {
    try {
      // Créer la citation en base
      const citation = await Citation.create({
        content: generatedCitation.content,
        author: generatedCitation.author,
        theme: theme,
        language: this.config.language,
        quality_score: generatedCitation.quality_score,
        status: "approved", // Auto-approuvé si passe le filtre qualité
        ai_source: "openai", // À ajuster selon le provider utilisé
        generated_at: new Date(),
        hashtags: generatedCitation.hashtags,
        metadata: {
          generatedBy: "daily-service",
          generatedAt: new Date().toISOString(),
          qualityScore: generatedCitation.quality_score,
        },
      })

      console.log(
        `   ✅ Citation sauvée (ID: ${citation.id}) - Score: ${citation.quality_score}`
      )

      // Générer les images si configuré
      if (this.config.generateImages) {
        await this.generateImages(citation)
      }

      // Générer les vidéos si configuré
      if (this.config.generateVideos) {
        await this.generateVideos(citation)
      }

      // Publier sur Instagram si configuré
      if (
        this.config.publishToInstagram &&
        this.config.instagramCredentials &&
        citation.imagePath
      ) {
        await this.publishToInstagram(citation)
      }

      this.stats.saved++
    } catch (error) {
      console.error(`   ❌ Erreur sauvegarde citation:`, error)
      this.stats.failed++
    }
  }

  private async generateImages(citation: Citation): Promise<void> {
    try {
      console.log(`   🎨 Génération d'images pour citation ${citation.id}`)

      const citationData = {
        content: citation.content,
        author: citation.author,
        theme: citation.theme,
        hashtags: citation.hashtags,
      }

      // Générer plusieurs variations d'images
      const variations = await imageService.generateVariations(citationData, [
        "minimal",
        "gradient",
        "photo",
      ])

      if (variations.length > 0) {
        // Utiliser la première image comme image principale
        const mainImage = variations[0]

        await citation.update({
          imagePath: mainImage.path,
          imageMetadata: {
            template: mainImage.metadata.template,
            variations: variations.map((v) => ({
              filename: v.filename,
              path: v.path,
              metadata: v.metadata,
            })),
          },
        })

        console.log(`   🖼️  ${variations.length} variations d'images générées`)
        this.stats.withImages++
      }
    } catch (error) {
      console.error(`   ❌ Erreur génération images:`, error)
      // Ne pas faire échouer le processus pour une erreur d'image
    }
  }

  private async generateVideos(citation: Citation): Promise<void> {
    try {
      console.log(`   🎬 Génération de vidéo pour citation ${citation.id}`)

      const citationData = {
        content: citation.content,
        author: citation.author,
        theme: citation.theme,
        hashtags: citation.hashtags,
      }

      // Générer une vidéo Instagram par défaut
      const video = await videoService.generateVideo(citationData, {
        duration: 30,
        format: "instagram",
        animation: "fade-in",
        background: "gradient",
        quality: "medium",
      })

      // Mettre à jour la citation avec le chemin de la vidéo
      await citation.update({
        videoPath: video.path,
        videoMetadata: video.metadata,
      })

      console.log(`   🎥 Vidéo générée: ${video.filename} (${video.metadata.duration}s)`)
      this.stats.withVideos++
    } catch (error) {
      console.error(`   ❌ Erreur génération vidéo:`, error)
      // Ne pas faire échouer le processus pour une erreur de vidéo
    }
  }

  private async publishToInstagram(citation: Citation): Promise<void> {
    try {
      console.log(`   📱 Publication Instagram pour citation ${citation.id}`)

      if (!this.config.instagramCredentials) {
        throw new Error("Credentials Instagram non configurés")
      }

      // Générer des hashtags automatiques
      const hashtags = instagramService.generateHashtags(
        citation.theme,
        citation.language
      )

      // Préparer la légende
      let caption = citation.content
      if (citation.author) {
        caption += `\n\n— ${citation.author}`
      }

      // Créer le post en base
      const post = await Post.create({
        citation_id: citation.id,
        image_url: `/images/generated/${citation.imagePath?.split("/").pop()}`,
        image_path: citation.imagePath!,
        template_used: (citation.imageMetadata as any)?.template || "minimal",
        status: "scheduled",
        scheduled_for: new Date(),
        caption: caption,
        hashtags: hashtags,
        retry_count: 0,
      })

      try {
        // Publier sur Instagram
        const result = await instagramService.publishImage(
          this.config.instagramCredentials,
          {
            caption: caption,
            imagePath: citation.imagePath!,
            hashtags: hashtags,
          }
        )

        // Mettre à jour le post avec les informations Instagram
        await post.update({
          instagram_post_id: result.id,
          status: "published",
          published_at: new Date(),
        })

        // Mettre à jour la citation
        await citation.update({
          status: "published",
          published_at: new Date(),
        })

        console.log(`   🎉 Publié sur Instagram: ${result.permalink}`)
        this.stats.published++
      } catch (publishError) {
        // Mettre à jour le post avec l'erreur
        await post.update({
          status: "failed",
          error_message:
            publishError instanceof Error ? publishError.message : "Erreur inconnue",
          retry_count: post.retry_count + 1,
        })

        console.error(`   ❌ Échec publication Instagram:`, publishError)
        this.stats.publishFailed++
      }
    } catch (error) {
      console.error(`   ❌ Erreur publication Instagram:`, error)
      this.stats.publishFailed++
    }
  }

  private displayStats(): void {
    console.log("\n📊 === STATISTIQUES FINALES ===")
    console.log(`📝 Citations générées: ${this.stats.generated}`)
    console.log(`💾 Citations sauvées: ${this.stats.saved}`)
    console.log(`🖼️  Avec images: ${this.stats.withImages}`)
    console.log(`🎬 Avec vidéos: ${this.stats.withVideos}`)

    if (this.config.publishToInstagram) {
      console.log(`📱 Publiées Instagram: ${this.stats.published}`)
      console.log(`❌ Échecs publication: ${this.stats.publishFailed}`)
    }

    console.log(`❌ Échecs génération: ${this.stats.failed}`)

    const successRate =
      this.stats.generated > 0 ? (this.stats.saved / this.stats.generated) * 100 : 0
    console.log(`📈 Taux de réussite: ${successRate.toFixed(1)}%`)

    if (this.config.publishToInstagram) {
      const publishRate =
        this.stats.saved > 0 ? (this.stats.published / this.stats.saved) * 100 : 0
      console.log(`📱 Taux publication Instagram: ${publishRate.toFixed(1)}%`)
    }

    console.log("=".repeat(35))
  }

  // Getters pour les tests
  getStats() {
    return { ...this.stats }
  }

  getConfig() {
    return { ...this.config }
  }
}
