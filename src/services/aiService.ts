import dotenv from "dotenv"

dotenv.config()

export interface CitationRequest {
  theme: string
  language: string
  count: number
  style?: "motivational" | "philosophical" | "practical" | "inspirational"
}

export interface GeneratedCitation {
  content: string
  author?: string
  theme: string
  quality_score: number
  hashtags: string[]
}

class AIService {
  private openaiApiKey: string
  private claudeApiKey: string

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || ""
    this.claudeApiKey = process.env.CLAUDE_API_KEY || ""
  }

  async generateCitationsWithOpenAI(
    request: CitationRequest
  ): Promise<GeneratedCitation[]> {
    const prompt = this.buildPrompt(request)

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4-turbo-preview",
          messages: [
            {
              role: "system",
              content:
                "Tu es un expert en citations inspirantes et motivantes. Tu génères des citations de qualité avec des hashtags pertinents.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.8,
          max_tokens: 1500,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content

      if (!content) {
        throw new Error("Aucun contenu généré par OpenAI")
      }

      return this.parseCitations(content, request.theme)
    } catch (error) {
      console.error("Erreur lors de la génération avec OpenAI:", error)
      throw error
    }
  }

  async generateCitationsWithClaude(
    request: CitationRequest
  ): Promise<GeneratedCitation[]> {
    const prompt = this.buildPrompt(request)

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": this.claudeApiKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-sonnet-20240229",
          max_tokens: 1500,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.8,
        }),
      })

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const content = data.content[0]?.text

      if (!content) {
        throw new Error("Aucun contenu généré par Claude")
      }

      return this.parseCitations(content, request.theme)
    } catch (error) {
      console.error("Erreur lors de la génération avec Claude:", error)
      throw error
    }
  }

  async generateCitations(
    request: CitationRequest,
    preferredProvider: "openai" | "claude" = "openai"
  ): Promise<GeneratedCitation[]> {
    try {
      if (preferredProvider === "openai" && this.openaiApiKey) {
        return await this.generateCitationsWithOpenAI(request)
      } else if (preferredProvider === "claude" && this.claudeApiKey) {
        return await this.generateCitationsWithClaude(request)
      } else {
        // Fallback vers l'autre provider
        if (this.openaiApiKey) {
          return await this.generateCitationsWithOpenAI(request)
        } else if (this.claudeApiKey) {
          return await this.generateCitationsWithClaude(request)
        } else {
          throw new Error("Aucune clé API configurée pour les services IA")
        }
      }
    } catch (error) {
      console.error("Erreur lors de la génération de citations:", error)
      throw error
    }
  }

  private buildPrompt(request: CitationRequest): string {
    const themeInstructions = {
      motivation: "citations motivantes pour encourager l'action et la persévérance",
      success: "citations sur le succès, la réussite et l'accomplissement",
      love: "citations sur l'amour, les relations et les sentiments",
      life: "citations sur la vie, l'existence et les expériences humaines",
      wisdom: "citations sages et philosophiques sur la sagesse de vivre",
      happiness: "citations sur le bonheur, la joie et la satisfaction",
      inspiration: "citations inspirantes pour élever l'esprit",
      leadership: "citations sur le leadership, la direction et l'influence",
      mindfulness: "citations sur la pleine conscience et la méditation",
      creativity: "citations sur la créativité, l'art et l'innovation",
    }

    const styleInstructions = {
      motivational: "avec un ton dynamique et énergique",
      philosophical: "avec une approche réflexive et profonde",
      practical: "avec des conseils concrets et applicables",
      inspirational: "avec un message élevant et transcendant",
    }

    return `
Génère ${request.count} ${
      themeInstructions[request.theme as keyof typeof themeInstructions] || "citations"
    } en ${request.language === "fr" ? "français" : "anglais"} ${
      request.style ? styleInstructions[request.style] : ""
    }.

Format de réponse attendu (JSON) :
[
  {
    "content": "La citation complète ici",
    "author": "Nom de l'auteur ou null si anonyme",
    "quality_score": 0.85,
    "hashtags": ["#motivation", "#inspiration", "#citation"]
  }
]

Critères de qualité :
- Citations originales et profondes
- Entre 50 et 280 caractères
- Éviter les clichés
- Pertinence thématique forte
- Hashtags pertinents (3-5 par citation)
- Quality_score basé sur l'originalité, la profondeur et l'impact émotionnel

Réponds uniquement avec le JSON, sans texte additionnel.
    `
  }

  private parseCitations(content: string, theme: string): GeneratedCitation[] {
    try {
      // Nettoyer le contenu pour extraire le JSON
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error("Format JSON non trouvé dans la réponse")
      }

      const citations = JSON.parse(jsonMatch[0])

      return citations.map((citation: any) => ({
        content: citation.content,
        author: citation.author || undefined,
        theme: theme,
        quality_score: citation.quality_score || 0.5,
        hashtags: citation.hashtags || [],
      }))
    } catch (error) {
      console.error("Erreur lors du parsing des citations:", error)
      throw new Error("Impossible de parser les citations générées")
    }
  }

  calculateQualityScore(citation: string): number {
    let score = 0.5 // Score de base

    // Longueur appropriée
    const length = citation.length
    if (length >= 50 && length <= 280) {
      score += 0.2
    }

    // Présence de mots-clés positifs
    const positiveWords = [
      "réussir",
      "succès",
      "bonheur",
      "amour",
      "espoir",
      "force",
      "courage",
      "sagesse",
    ]
    const hasPositiveWords = positiveWords.some((word) =>
      citation.toLowerCase().includes(word)
    )
    if (hasPositiveWords) {
      score += 0.15
    }

    // Éviter les répétitions communes
    const commonPhrases = [
      "comme dit le proverbe",
      "il faut toujours",
      "n'oubliez jamais",
    ]
    const hasCommonPhrases = commonPhrases.some((phrase) =>
      citation.toLowerCase().includes(phrase)
    )
    if (hasCommonPhrases) {
      score -= 0.1
    }

    return Math.max(0, Math.min(1, score))
  }
}

export default new AIService()
