#!/usr/bin/env ts-node

import sequelize from "@/config/database"
import Citation from "@/models/Citation"
import Post from "@/models/Post"
import aiService from "@/services/aiService"
import imageService from "@/services/imageService"
import { config } from "dotenv"

// Charger les variables d'environnement
config()

interface GenerateOptions {
  count?: number
  template?: string
  theme?: string
  saveToDb?: boolean
}

const templates = ["minimal", "gradient", "photo", "modern", "elegant"]
const themes = [
  "motivation",
  "sagesse",
  "amour",
  "success",
  "bonheur",
  "inspiration",
  "vie",
  "philosophie",
  "parentalite",
  "education",
  "famille",
  "enfance",
]

async function generateImages(options: GenerateOptions = {}) {
  const { count = 1, template = "photo", theme = "motivation", saveToDb = true } = options

  console.log("🚀 Démarrage de la génération d'images...")
  console.log(`📊 Paramètres: ${count} image(s), template: ${template}, thème: ${theme}`)

  try {
    // Connexion à la base de données si nécessaire
    if (saveToDb) {
      await sequelize.authenticate()
      console.log("✅ Connexion à la base de données établie")
    }

    const results = []

    for (let i = 0; i < count; i++) {
      console.log(`\n📝 Génération ${i + 1}/${count}...`)

      // 1. Générer une citation avec l'IA
      console.log("🤖 Génération de la citation...")
      const citations = await aiService.generateCitations({
        theme,
        language: "fr",
        count: 1,
      })
      const citationData = {
        content: citations[0].content,
        author: citations[0].author,
        theme: citations[0].theme,
        hashtags: citations[0].hashtags,
      }
      console.log(`💭 Citation: "${citationData.content}" - ${citationData.author}`)

      let citationId
      if (saveToDb) {
        // Sauvegarder en base
        const citation = new Citation({
          content: citationData.content,
          author: citationData.author,
          theme: citationData.theme,
          language: "fr",
          ai_source: "openai",
          quality_score: citations[0].quality_score,
          status: "approved",
          generated_at: new Date(),
          hashtags: citationData.hashtags,
        })
        const savedCitation = await citation.save()
        citationId = savedCitation.id
        console.log(`💾 Citation sauvegardée (ID: ${citationId})`)
      }

      // 2. Générer l'image
      console.log(`🎨 Génération de l'image (template: ${template})...`)
      const imageResult = await imageService.generateImage(citationData, {
        template: template as "minimal" | "gradient" | "photo" | "modern" | "elegant",
      })
      console.log(
        `🖼️  Image générée: ${imageResult.filename} (${Math.round(
          imageResult.buffer.length / 1024
        )}KB)`
      )

      if (saveToDb && citationId) {
        // Créer le post
        const post = new Post({
          citation_id: citationId,
          image_url: imageResult.filename,
          image_path: imageResult.path,
          template_used: template,
          caption: citationData.content,
          hashtags: citationData.hashtags || [],
          status: "draft",
          scheduled_for: new Date(),
        })
        const savedPost = await post.save()
        console.log(`📄 Post sauvegardé (ID: ${savedPost.id})`)
      }

      results.push({
        citation: citationData,
        image: imageResult,
        citationId: saveToDb ? citationId : null,
      })

      // Petite pause entre les générations
      if (i < count - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    console.log(`\n✅ Génération terminée ! ${count} image(s) créée(s)`)
    console.log(`📁 Images disponibles dans: public/images/generated/`)

    return results
  } catch (error) {
    console.error("❌ Erreur lors de la génération:", error)
    throw error
  }
}

// Fonction pour afficher l'aide
function showHelp() {
  console.log(`
🎨 Script de génération d'images AutoPublish

Usage:
  npm run generate-images [options]

Options:
  --count <number>     Nombre d'images à générer (défaut: 1)
  --template <name>    Template à utiliser (défaut: photo)
  --theme <name>       Thème des citations (défaut: motivation)
  --no-db             Ne pas sauvegarder en base de données
  --help              Afficher cette aide

Templates disponibles:
  ${templates.join(", ")}

Thèmes disponibles:
  ${themes.join(", ")}

Exemples:
  npm run generate-images                           # 1 image avec template photo
  npm run generate-images -- --count 5             # 5 images
  npm run generate-images -- --template minimal    # Template minimal
  npm run generate-images -- --theme sagesse       # Thème sagesse
  npm run generate-images -- --count 3 --no-db     # 3 images sans sauvegarde
  `)
}

// Parser les arguments de ligne de commande
function parseArgs(): GenerateOptions & { help?: boolean } {
  const args = process.argv.slice(2)
  const options: GenerateOptions & { help?: boolean } = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case "--help":
        options.help = true
        break
      case "--count":
        options.count = parseInt(args[++i]) || 1
        break
      case "--template":
        options.template = args[++i]
        break
      case "--theme":
        options.theme = args[++i]
        break
      case "--no-db":
        options.saveToDb = false
        break
    }
  }

  return options
}

// Validation des options
function validateOptions(options: GenerateOptions): string[] {
  const errors: string[] = []

  if (options.count && (options.count < 1 || options.count > 20)) {
    errors.push("Le nombre d'images doit être entre 1 et 20")
  }

  if (options.template && !templates.includes(options.template)) {
    errors.push(`Template invalide. Templates disponibles: ${templates.join(", ")}`)
  }

  if (options.theme && !themes.includes(options.theme)) {
    errors.push(`Thème invalide. Thèmes disponibles: ${themes.join(", ")}`)
  }

  return errors
}

// Point d'entrée principal
async function main() {
  const options = parseArgs()

  if (options.help) {
    showHelp()
    process.exit(0)
  }

  // Validation
  const errors = validateOptions(options)
  if (errors.length > 0) {
    console.error("❌ Erreurs de validation:")
    errors.forEach((error) => console.error(`  - ${error}`))
    console.log("\nUtilisez --help pour voir l'aide")
    process.exit(1)
  }

  try {
    await generateImages(options)
    process.exit(0)
  } catch (error) {
    console.error("❌ Échec de la génération:", error)
    process.exit(1)
  }
}

// Exécuter le script si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { generateImages }
