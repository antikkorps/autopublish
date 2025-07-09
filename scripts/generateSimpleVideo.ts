#!/usr/bin/env tsx

import publicQuoteService from "@/services/publicQuoteService"
import videoService from "@/services/videoService"
import dotenv from "dotenv"

// Charger les variables d'environnement
dotenv.config()

async function generateSimpleVideo() {
  console.log("🎬 Génération vidéo simple : citation + image + musique (10s)")

  try {
    // 1. Récupérer une citation
    console.log("📡 Récupération de la citation...")
    const citationData = await publicQuoteService.getRandomQuote("motivation")
    console.log(`💭 Citation: "${citationData.content}"`)
    console.log(`👤 Auteur: ${citationData.author}`)

    // 2. Générer la vidéo simple
    console.log("\n🎬 Génération de la vidéo...")
    const startTime = Date.now()

    const videoResult = await videoService.generateVideo(citationData, {
      duration: 10,
      format: "instagram",
      animation: "fade-in",
      background: "image", // Une seule image de fond
      includeMusic: true,
      musicType: "inspirational",
      musicVolume: 0.3,
      quality: "medium",
    })

    const endTime = Date.now()
    const generationTime = (endTime - startTime) / 1000

    console.log(`\n✅ Vidéo générée en ${generationTime}s !`)
    console.log(`📁 Fichier: ${videoResult.filename}`)
    console.log(`📊 Taille: ${Math.round(videoResult.buffer.length / 1024)}KB`)
    console.log(`⏱️  Durée: ${videoResult.metadata.duration}s`)
    console.log(`📐 Résolution: ${videoResult.metadata.resolution}`)
    console.log(`🎵 Musique: Inspirational`)
    console.log(`🖼️  Fond: Image Unsplash`)

    console.log(
      `\n📂 Fichier disponible: public/videos/generated/${videoResult.filename}`
    )

    return videoResult
  } catch (error) {
    console.error("❌ Erreur lors de la génération:", error)
    throw error
  }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  generateSimpleVideo()
    .then(() => console.log("\n🎉 Génération terminée !"))
    .catch((error) => {
      console.error("\n❌ Échec:", error.message)
      process.exit(1)
    })
}

export default generateSimpleVideo
