#!/usr/bin/env tsx

import publicQuoteService from "@/services/publicQuoteService"
import videoService from "@/services/videoService"
import dotenv from "dotenv"

// Charger les variables d'environnement
dotenv.config()

interface GenerateOptions {
  duration?: number
  format?: "instagram" | "tiktok" | "square"
  animation?: "fade-in" | "slide-in" | "typewriter"
  background?: "gradient" | "image" | "solid" | "slideshow" | "custom"
  theme?: string
  includeMusic?: boolean
  musicType?: "inspirational" | "calm" | "energetic" | "emotional" | "motivational"
  quality?: "high" | "medium" | "low"
}

async function generateVideo(options: GenerateOptions = {}) {
  const {
    duration = 10,
    format = "instagram",
    animation = "fade-in",
    background = "slideshow",
    theme = "motivation",
    includeMusic = true,
    musicType = "inspirational",
    quality = "medium",
  } = options

  console.log("🎬 Génération vidéo avec citations publiques et musique...")
  console.log(
    `📊 Paramètres: ${duration}s, format: ${format}, animation: ${animation}, fond: ${background}, thème: ${theme}`
  )

  if (includeMusic) {
    console.log(`🎵 Musique: ${musicType}`)
  }

  try {
    // 1. Récupérer une citation depuis l'API Ninjas
    console.log("\n📡 Récupération de la citation...")
    const citationData = await publicQuoteService.getRandomQuote(theme)
    console.log(`💭 Citation: "${citationData.content}"`)
    console.log(`👤 Auteur: ${citationData.author}`)
    console.log(`🏷️  Thème: ${citationData.theme}`)

    // 2. Générer la vidéo
    console.log("\n🎬 Génération de la vidéo...")
    const startTime = Date.now()

    const videoResult = await videoService.generateVideo(citationData, {
      duration,
      format,
      animation,
      background,
      includeMusic,
      musicType,
      musicVolume: 0.3,
      quality,
      imageTransitionDuration: 3,
      imageOverlayOpacity: 0.6,
    })

    const endTime = Date.now()
    const generationTime = (endTime - startTime) / 1000

    console.log(`\n✅ Vidéo générée avec succès en ${generationTime}s !`)
    console.log(`📁 Fichier: ${videoResult.filename}`)
    console.log(`📊 Taille: ${Math.round(videoResult.buffer.length / 1024 / 1024)}MB`)
    console.log(`⏱️  Durée: ${videoResult.metadata.duration}s`)
    console.log(`📐 Résolution: ${videoResult.metadata.resolution}`)
    console.log(`🎵 Musique: ${includeMusic ? musicType : "Non"}`)
    console.log(`🖼️  Fond: ${background}`)
    console.log(`🎬 Animation: ${animation}`)

    console.log(
      `\n📂 Fichier disponible: public/videos/generated/${videoResult.filename}`
    )

    return videoResult
  } catch (error) {
    console.error("❌ Erreur lors de la génération:", error)
    throw error
  }
}

// Fonction pour afficher l'aide
function showHelp() {
  console.log(`
🎬 Générateur de Vidéos avec Citations Publiques

Usage: npx tsx scripts/generateVideo.ts [options]

Options:
  --duration <sec>     Durée en secondes (défaut: 10)
  --format <format>    Format (instagram, tiktok, square, défaut: instagram)
  --animation <type>   Animation (fade-in, slide-in, typewriter, défaut: fade-in)
  --background <type>  Fond (gradient, image, solid, slideshow, custom, défaut: slideshow)
  --theme <thème>      Thème (motivation, sagesse, amour, success, bonheur, inspiration)
  --music <type>       Type de musique (inspirational, calm, energetic, emotional, motivational)
  --no-music          Désactiver la musique
  --quality <level>    Qualité (high, medium, low, défaut: medium)
  --help              Afficher cette aide

Exemples:
  npx tsx scripts/generateVideo.ts --duration 15 --theme motivation --music inspirational
  npx tsx scripts/generateVideo.ts --format tiktok --background gradient --no-music
  npx tsx scripts/generateVideo.ts --animation typewriter --quality high
`)
}

// Fonction principale
async function main() {
  const args = process.argv.slice(2)

  // Afficher l'aide si demandé
  if (args.includes("--help") || args.includes("-h")) {
    showHelp()
    return
  }

  // Parser les arguments
  const options: GenerateOptions = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case "--duration":
        options.duration = parseInt(args[++i]) || 10
        break
      case "--format":
        const format = args[++i]
        if (["instagram", "tiktok", "square"].includes(format)) {
          options.format = format as any
        }
        break
      case "--animation":
        const animation = args[++i]
        if (["fade-in", "slide-in", "typewriter"].includes(animation)) {
          options.animation = animation as any
        }
        break
      case "--background":
        const background = args[++i]
        if (["gradient", "image", "solid", "slideshow", "custom"].includes(background)) {
          options.background = background as any
        }
        break
      case "--theme":
        options.theme = args[++i]
        break
      case "--music":
        const musicType = args[++i]
        if (
          ["inspirational", "calm", "energetic", "emotional", "motivational"].includes(
            musicType
          )
        ) {
          options.includeMusic = true
          options.musicType = musicType as any
        }
        break
      case "--no-music":
        options.includeMusic = false
        break
      case "--quality":
        const quality = args[++i]
        if (["high", "medium", "low"].includes(quality)) {
          options.quality = quality as any
        }
        break
    }
  }

  try {
    await generateVideo(options)
  } catch (error) {
    console.error("❌ Erreur lors de l'exécution:", error)
    process.exit(1)
  }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export default generateVideo
