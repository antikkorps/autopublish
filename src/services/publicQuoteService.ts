import dotenv from "dotenv"
import { CitationData } from "./videoService"

// Charger les variables d'environnement
dotenv.config()

interface QuoteAPIResponse {
  text?: string
  quote?: string
  author?: string
  content?: string
  author_name?: string
  q?: string
  a?: string
  message?: string
  status?: string
}

interface NinjasQuoteResponse {
  quote: string
  author: string
  category: string
}

export class PublicQuoteService {
  private readonly apis = [
    {
      name: "ninjas_quotes",
      url: "https://api.api-ninjas.com/v1/quotes",
      requiresAuth: true,
      transform: (data: NinjasQuoteResponse[]): CitationData => {
        const quote = data[0]
        return {
          content: quote.quote,
          author: quote.author,
          theme: this.mapCategoryToTheme(quote.category),
          hashtags: this.getHashtagsForTheme(this.mapCategoryToTheme(quote.category)),
        }
      },
    },
    {
      name: "quotable",
      url: "https://api.quotable.io/random",
      requiresAuth: false,
      transform: (data: QuoteAPIResponse): CitationData => ({
        content: data.content || data.text || data.quote || "",
        author: data.author || data.author_name || "Auteur inconnu",
        theme: "inspiration",
        hashtags: ["#citation", "#inspiration"],
      }),
    },
    {
      name: "quotable_with_tags",
      url: "https://api.quotable.io/random?tags=inspirational|motivational|success",
      requiresAuth: false,
      transform: (data: QuoteAPIResponse): CitationData => ({
        content: data.content || data.text || data.quote || "",
        author: data.author || data.author_name || "Auteur inconnu",
        theme: "motivation",
        hashtags: ["#motivation", "#inspiration", "#success"],
      }),
    },
    {
      name: "zenquotes",
      url: "https://zenquotes.io/api/random",
      requiresAuth: false,
      transform: (data: QuoteAPIResponse[]): CitationData => {
        const quote = data[0]
        return {
          content: quote.q || quote.text || quote.quote || "",
          author: quote.a || quote.author || quote.author_name || "Auteur inconnu",
          theme: "sagesse",
          hashtags: ["#sagesse", "#citation", "#zen"],
        }
      },
    },
    {
      name: "api_quotes",
      url: "https://api.quotable.io/quotes/random",
      requiresAuth: false,
      transform: (data: QuoteAPIResponse): CitationData => ({
        content: data.content || data.text || data.quote || "",
        author: data.author || data.author_name || "Auteur inconnu",
        theme: "inspiration",
        hashtags: ["#citation", "#inspiration"],
      }),
    },
    {
      name: "quotable_simple",
      url: "https://api.quotable.io/random?maxLength=150",
      requiresAuth: false,
      transform: (data: QuoteAPIResponse): CitationData => ({
        content: data.content || data.text || data.quote || "",
        author: data.author || data.author_name || "Auteur inconnu",
        theme: "inspiration",
        hashtags: ["#citation", "#inspiration"],
      }),
    },
  ]

  private lastRequestTime: { [key: string]: number } = {}
  private readonly minRequestInterval = 2000 // 2 secondes entre les requêtes

  /**
   * Récupère une citation depuis une API publique
   */
  async getRandomQuote(theme?: string): Promise<CitationData> {
    // Essayer les APIs dans l'ordre jusqu'à ce qu'une fonctionne
    for (const api of this.apis) {
      try {
        // Vérifier le rate limiting
        const now = Date.now()
        const lastRequest = this.lastRequestTime[api.name] || 0
        const timeSinceLastRequest = now - lastRequest

        if (timeSinceLastRequest < this.minRequestInterval) {
          const waitTime = this.minRequestInterval - timeSinceLastRequest
          console.log(`⏳ Attente de ${waitTime}ms pour éviter le rate limiting...`)
          await new Promise((resolve) => setTimeout(resolve, waitTime))
        }

        console.log(`📡 Récupération depuis ${api.name}...`)
        this.lastRequestTime[api.name] = Date.now()

        // Préparer les headers selon l'API
        const headers: Record<string, string> = {
          Accept: "application/json",
          "User-Agent": "AutoPublish/1.0",
        }

        if (api.requiresAuth) {
          const apiKey = process.env.NINJA_API_KEY
          if (!apiKey) {
            console.warn(`⚠️ Clé API manquante pour ${api.name}`)
            continue
          }
          headers["X-Api-Key"] = apiKey
        }

        const response = await fetch(api.url, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(8000), // Timeout de 8 secondes
        })

        if (!response.ok) {
          if (response.status === 429) {
            console.warn(`⚠️ Rate limiting détecté pour ${api.name}, attente...`)
            await new Promise((resolve) => setTimeout(resolve, 5000))
            continue
          }
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        const citation = api.transform(data)

        // Vérifier que la citation est valide
        if (!citation.content || citation.content.length < 10) {
          throw new Error("Citation trop courte")
        }

        // Adapter le thème si demandé
        if (theme) {
          citation.theme = theme
          citation.hashtags = this.getHashtagsForTheme(theme)
        }

        console.log(`✅ Citation récupérée: "${citation.content.substring(0, 50)}..."`)
        return citation
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.warn(`⚠️ API ${api.name} échouée:`, errorMessage)
        continue
      }
    }

    // Fallback avec des citations locales si toutes les APIs échouent
    console.log("🔄 Utilisation des citations de fallback...")
    return this.getFallbackQuote(theme)
  }

  /**
   * Récupère plusieurs citations
   */
  async getMultipleQuotes(count: number, theme?: string): Promise<CitationData[]> {
    const quotes: CitationData[] = []
    const seenQuotes = new Set<string>()

    for (let i = 0; i < count; i++) {
      let attempts = 0
      let quote: CitationData | null = null

      // Essayer jusqu'à 3 fois pour éviter les doublons
      while (attempts < 3 && !quote) {
        const newQuote = await this.getRandomQuote(theme)
        const quoteKey = newQuote.content.toLowerCase().substring(0, 50)

        if (!seenQuotes.has(quoteKey)) {
          seenQuotes.add(quoteKey)
          quote = newQuote
        } else {
          attempts++
          // Attendre un peu avant de réessayer
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }

      if (quote) {
        quotes.push(quote)
      }

      // Pause entre les récupérations pour éviter le rate limiting
      if (i < count - 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
    }

    return quotes
  }

  /**
   * Mappe les catégories de l'API Ninjas vers nos thèmes
   */
  private mapCategoryToTheme(category: string): string {
    const categoryMap: Record<string, string> = {
      happiness: "bonheur",
      success: "success",
      love: "amour",
      life: "sagesse",
      motivation: "motivation",
      inspiration: "inspiration",
      wisdom: "sagesse",
      family: "famille",
      education: "education",
      friendship: "amour",
      courage: "motivation",
      hope: "inspiration",
      faith: "sagesse",
      peace: "bonheur",
      joy: "bonheur",
      gratitude: "bonheur",
      leadership: "success",
      creativity: "inspiration",
      change: "motivation",
      growth: "success",
    }

    return categoryMap[category.toLowerCase()] || "inspiration"
  }

  /**
   * Citations de fallback locales
   */
  private getFallbackQuote(theme?: string): CitationData {
    const fallbackQuotes = [
      {
        content: "La persévérance transforme les rêves en réalité. Chaque pas compte.",
        author: "Auteur inspirant",
        theme: "motivation",
      },
      {
        content:
          "Le succès n'est pas final, l'échec n'est pas fatal. C'est le courage de continuer qui compte.",
        author: "Winston Churchill",
        theme: "motivation",
      },
      {
        content: "La vie est belle quand on sait la regarder avec les yeux du cœur.",
        author: "Auteur sage",
        theme: "sagesse",
      },
      {
        content: "L'éducation est l'arme la plus puissante pour changer le monde.",
        author: "Nelson Mandela",
        theme: "education",
      },
      {
        content: "L'amour est la force la plus puissante de l'univers.",
        author: "Auteur romantique",
        theme: "amour",
      },
      {
        content:
          "Le bonheur n'est pas quelque chose de tout fait. Il vient de vos propres actions.",
        author: "Dalaï Lama",
        theme: "bonheur",
      },
      {
        content: "La créativité est l'intelligence qui s'amuse.",
        author: "Albert Einstein",
        theme: "inspiration",
      },
      {
        content: "Le plus grand échec est de ne pas essayer.",
        author: "Auteur motivant",
        theme: "success",
      },
      {
        content: "La famille n'est pas une chose importante. C'est tout.",
        author: "Michael J. Fox",
        theme: "famille",
      },
      {
        content:
          "Le courage n'est pas l'absence de peur, mais la capacité de vaincre ce qui fait peur.",
        author: "Nelson Mandela",
        theme: "motivation",
      },
    ]

    const selectedTheme = theme || "motivation"
    const themeQuotes = fallbackQuotes.filter((q) => q.theme === selectedTheme)
    const quote = themeQuotes.length > 0 ? themeQuotes[0] : fallbackQuotes[0]

    return {
      content: quote.content,
      author: quote.author,
      theme: quote.theme,
      hashtags: this.getHashtagsForTheme(quote.theme),
    }
  }

  /**
   * Génère des hashtags selon le thème
   */
  private getHashtagsForTheme(theme: string): string[] {
    const hashtagMap: Record<string, string[]> = {
      motivation: ["#motivation", "#inspiration", "#success", "#goals"],
      sagesse: ["#sagesse", "#citation", "#philosophie", "#reflexion"],
      amour: ["#amour", "#couple", "#romance", "#feelings"],
      education: ["#education", "#apprentissage", "#connaissance", "#savoir"],
      famille: ["#famille", "#parentalite", "#enfants", "#amour"],
      success: ["#success", "#reussite", "#objectifs", "#ambition"],
      bonheur: ["#bonheur", "#joie", "#positivite", "#vie"],
      inspiration: ["#inspiration", "#creativite", "#art", "#idees"],
    }

    return hashtagMap[theme] || ["#citation", "#inspiration"]
  }

  /**
   * Teste la connectivité des APIs
   */
  async testAPIs(): Promise<{ [key: string]: boolean }> {
    const results: { [key: string]: boolean } = {}

    for (const api of this.apis) {
      try {
        const headers: Record<string, string> = {
          Accept: "application/json",
        }

        if (api.requiresAuth) {
          const apiKey = process.env.NINJAS_API_KEY
          if (!apiKey) {
            results[api.name] = false
            continue
          }
          headers["X-Api-Key"] = apiKey
        }

        const response = await fetch(api.url, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(5000),
        })
        results[api.name] = response.ok
      } catch (error) {
        results[api.name] = false
      }
    }

    return results
  }
}

export default new PublicQuoteService()
