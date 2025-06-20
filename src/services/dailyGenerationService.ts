import sequelize from "../config/database"
import Citation from "../models/Citation"
import aiService from "./aiService"
import imageService from "./imageService"

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
}

// Configuration par défaut pour la génération quotidienne
export const DEFAULT_CONFIG: DailyConfig = {
  totalCitations: 10, // 10 citations par jour
  themes: {
    motivation: { count: 3, style: "motivational" },
    wisdom: { count: 2, style: "philosophical" },
    success: { count: 2, style: "practical" },
    life: { count: 2, style: "inspirational" },
    love: { count: 1, style: "inspirational" },
  },
  language: "fr",
  minQualityScore: 0.6,
  generateImages: true,
}

export class DailyGenerationService {
  private config: DailyConfig
  private stats = {
    generated: 0,
    saved: 0,
    failed: 0,
    withImages: 0,
  }

  constructor(config: DailyConfig = DEFAULT_CONFIG) {
    this.config = config
  }

  async generate(): Promise<typeof this.stats> {
    console.log("🚀 Démarrage de la génération quotidienne de citations...")
    console.log(
      `📊 Configuration: ${this.config.totalCitations} citations réparties sur ${
        Object.keys(this.config.themes).length
      } thèmes`
    )

    // Réinitialiser les stats
    this.stats = { generated: 0, saved: 0, failed: 0, withImages: 0 }

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
      `\n🎯 Génération pour le thème: ${theme} (${themeConfig.count} citations)`
    )

    try {
      // Générer les citations via IA
      const generatedCitations = await aiService.generateCitations({
        theme,
        language: this.config.language,
        count: themeConfig.count,
        style: themeConfig.style as any,
      })

      console.log(`   📝 ${generatedCitations.length} citations générées par l'IA`)

      // Filtrer par qualité
      const qualityCitations = generatedCitations.filter(
        (citation) => citation.quality_score >= this.config.minQualityScore
      )

      console.log(
        `   ⭐ ${qualityCitations.length} citations passent le filtre qualité (>= ${this.config.minQualityScore})`
      )

      // Sauvegarder en base de données
      for (const citation of qualityCitations) {
        await this.saveCitation(citation, theme)
      }

      this.stats.generated += generatedCitations.length
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

      this.stats.saved++
    } catch (error) {
      console.error(`   ❌ Erreur sauvegarde citation:`, error)
      this.stats.failed++
    }
  }

  private async generateImages(citation: Citation): Promise<void> {
    try {
      console.log(`   🖼️  Génération d'images pour citation ${citation.id}...`)

      // Générer plusieurs variations d'images
      const variations = await imageService.generateVariations({
        content: citation.content,
        author: citation.author,
        theme: citation.theme,
      })

      // Sauvegarder le chemin de la première image
      if (variations.length > 0) {
        citation.imagePath = variations[0].path
        citation.imageMetadata = {
          variations: variations.map((v) => ({
            path: v.path,
            template: v.metadata.template,
            generatedAt: new Date().toISOString(),
          })),
        }
        await citation.save()

        console.log(`   ✅ ${variations.length} images générées`)
        this.stats.withImages++
      }
    } catch (error) {
      console.error(
        `   ⚠️  Erreur génération images pour citation ${citation.id}:`,
        error
      )
      // Ne pas faire échouer le processus si seules les images échouent
    }
  }

  private displayStats(): void {
    console.log("\n" + "=".repeat(50))
    console.log("📊 STATISTIQUES DE GÉNÉRATION QUOTIDIENNE")
    console.log("=".repeat(50))
    console.log(`✅ Citations générées par l'IA: ${this.stats.generated}`)
    console.log(`💾 Citations sauvées en base: ${this.stats.saved}`)
    console.log(`🖼️  Citations avec images: ${this.stats.withImages}`)
    console.log(`❌ Échecs: ${this.stats.failed}`)
    console.log(
      `📈 Taux de réussite: ${Math.round(
        (this.stats.saved / this.stats.generated) * 100
      )}%`
    )
    console.log("=".repeat(50))

    if (this.stats.saved === 0) {
      console.log("⚠️  ATTENTION: Aucune citation sauvée!")
    } else {
      console.log(`🎉 Génération quotidienne terminée avec succès!`)
    }
  }

  // Getters pour les tests
  getStats() {
    return { ...this.stats }
  }

  getConfig() {
    return { ...this.config }
  }
}
