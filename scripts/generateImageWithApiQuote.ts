#!/usr/bin/env tsx

import imageService from "@/services/imageService"
import publicQuoteService from "@/services/publicQuoteService"
import dotenv from "dotenv"

// Charger les variables d'environnement
dotenv.config()

interface GenerateOptions {
  theme?: string
  template?: "minimal" | "gradient" | "photo" | "modern" | "elegant"
  count?: number
  saveToDb?: boolean
}

async function generateImageWithApiQuote(options: GenerateOptions = {}) {
  const {
    theme = "motivation",
    template = "photo",
    count = 1,
    saveToDb = false,
  } = options

  console.log("🖼️ Génération d'images avec citations API...")
  console.log(`📊 Paramètres: ${count} image(s), template: ${template}, thème: ${theme}`)

  try {
    const results = []

    for (let i = 0; i < count; i++) {
      console.log(`\n📝 Génération ${i + 1}/${count}...`)

      // 1. Récupérer une citation depuis l'API (pas l'IA)
      console.log("📡 Récupération de la citation depuis l'API...")
      const citationData = await publicQuoteService.getRandomQuote(theme)
      console.log(`💭 Citation: "${citationData.content}"`)
      console.log(`👤 Auteur: ${citationData.author}`)
      console.log(`🏷️  Thème: ${citationData.theme}`)

      // 2. Générer l'image avec le service imageService
      console.log(`🎨 Génération de l'image (template: ${template})...`)
      const imageResult = await imageService.generateImage(citationData, {
        template: template as "minimal" | "gradient" | "photo" | "modern" | "elegant",
        includeAuthor: true,
        includeBranding: true,
      })

      console.log(
        `🖼️  Image générée: ${imageResult.filename} (${Math.round(
          imageResult.buffer.length / 1024
        )}KB)`
      )

      results.push({
        citation: citationData,
        image: imageResult,
      })

      // Petite pause entre les générations
      if (i < count - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }

    console.log(`\n✅ Génération terminée ! ${count} image(s) créée(s)`)
    console.log("\n📋 Résumé:")
    results.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.image.filename}`)
      console.log(`     Citation: "${result.citation.content.substring(0, 50)}..."`)
      console.log(`     Auteur: ${result.citation.author}`)
      console.log(`     Thème: ${result.citation.theme}`)
    })

    return results
  } catch (error) {
    console.error("❌ Erreur lors de la génération:", error)
    throw error
  }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  // Récupérer les arguments de ligne de commande
  const args = process.argv.slice(2)
  const options: GenerateOptions = {
    theme: args[0] || "motivation",
    template: (args[1] as any) || "photo",
    count: parseInt(args[2]) || 1,
  }

  generateImageWithApiQuote(options)
    .then(() => console.log("\n🎉 Génération terminée !"))
    .catch((error) => {
      console.error("\n❌ Échec:", error.message)
      process.exit(1)
    })
}

export default generateImageWithApiQuote
