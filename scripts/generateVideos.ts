#!/usr/bin/env ts-node

import sequelize from "@/config/database"
import Citation from "@/models/Citation"
import aiService from "@/services/aiService"
import videoService from "@/services/videoService"
import { config } from "dotenv"

// Charger les variables d'environnement
config()

interface GenerateOptions {
  count?: number
  format?: "instagram" | "tiktok" | "square"
  animation?: "fade-in" | "slide-in" | "typewriter"
  background?: "gradient" | "image" | "solid" | "slideshow" | "custom"
  duration?: number
  theme?: string
  saveToDb?: boolean
  backgroundImages?: string[]
  imageTransitionDuration?: number
  imageOverlayOpacity?: number
  includeMusic?: boolean
  musicType?: "inspirational" | "calm" | "energetic" | "emotional" | "motivational"
  musicVolume?: number
}

const formats = ["instagram", "tiktok", "square"]
const animations = ["fade-in", "slide-in", "typewriter"]
const backgrounds = ["gradient", "image", "solid", "slideshow", "custom"]
const musicTypes = ["inspirational", "calm", "energetic", "emotional", "motivational"]
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

async function generateVideos(options: GenerateOptions = {}) {
  const {
    count = 1,
    format = "instagram",
    animation = "fade-in",
    background = "gradient",
    duration = 30,
    theme = "motivation",
    saveToDb = true,
    backgroundImages = [],
    imageTransitionDuration = 3,
    imageOverlayOpacity = 0.6,
    includeMusic = false,
    musicType = "inspirational",
    musicVolume = 0.3,
  } = options

  console.log("🎬 Démarrage de la génération de vidéos...")
  console.log(
    `📊 Paramètres: ${count} vidéo(s), format: ${format}, animation: ${animation}, thème: ${theme}, fond: ${background}`
  )
  if (background === "slideshow" || background === "custom") {
    console.log(
      `🖼️  Images de fond: ${
        backgroundImages.length > 0 ? backgroundImages.length : "auto-générées"
      }`
    )
  }
  if (includeMusic) {
    console.log(`🎵 Musique: ${musicType} (volume: ${musicVolume})`)
  }

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

      // 2. Générer la vidéo
      console.log(
        `🎬 Génération de la vidéo (format: ${format}, animation: ${animation})...`
      )
      const videoResult = await videoService.generateVideo(citationData, {
        duration,
        format: format as "instagram" | "tiktok" | "square",
        animation: animation as "fade-in" | "slide-in" | "typewriter",
        background: background as "gradient" | "image" | "solid" | "slideshow" | "custom",
        quality: "medium",
        backgroundImages,
        imageTransitionDuration,
        imageOverlayOpacity,
        includeMusic,
        musicType: musicType as
          | "inspirational"
          | "calm"
          | "energetic"
          | "emotional"
          | "motivational",
        musicVolume,
      })
      console.log(
        `🎥 Vidéo générée: ${videoResult.filename} (${Math.round(
          videoResult.buffer.length / 1024 / 1024
        )}MB) - ${videoResult.metadata.duration}s`
      )

      if (saveToDb && citationId) {
        // Mettre à jour la citation avec le chemin de la vidéo
        await Citation.update(
          {
            videoPath: videoResult.path,
            videoMetadata: videoResult.metadata,
          },
          {
            where: { id: citationId },
          }
        )
        console.log(`📄 Vidéo associée à la citation (ID: ${citationId})`)
      }

      results.push({
        citation: citationData,
        video: videoResult,
        citationId: saveToDb ? citationId : null,
      })

      // Petite pause entre les générations
      if (i < count - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }

    console.log(`\n✅ Génération terminée ! ${count} vidéo(s) créée(s)`)
    console.log("\n📋 Résumé :")
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. 🎬 Vidéo ${index + 1}`)
      console.log(`   📖 Citation: "${result.citation.content}"`)
      console.log(`   👤 Auteur: ${result.citation.author}`)
      console.log(`   🏷️  Thème: ${result.citation.theme}`)
      console.log(`   🎥 Fichier: ${result.video.filename}`)
      console.log(
        `   📁 Taille: ${Math.round(result.video.buffer.length / 1024 / 1024)}MB`
      )
      console.log(`   ⏱️  Durée: ${result.video.metadata.duration}s`)
      console.log(`   📐 Résolution: ${result.video.metadata.resolution}`)
      if (result.citationId) {
        console.log(`   💾 ID Citation: ${result.citationId}`)
      }
    })

    return results
  } catch (error) {
    console.error("❌ Erreur lors de la génération de vidéos:", error)
    throw error
  }
}

// Fonction pour afficher l'aide
function showHelp() {
  console.log(`
🎬 Générateur de Vidéos AutoPublish

Usage: npm run generate-videos [options]

Options:
  --count <nombre>     Nombre de vidéos à générer (1-10, défaut: 1)
  --format <format>    Format de la vidéo (instagram, tiktok, square, défaut: instagram)
  --animation <type>   Type d'animation (fade-in, slide-in, typewriter, défaut: fade-in)
  --background <type>  Type de fond (gradient, image, solid, slideshow, custom, défaut: gradient)
  --duration <sec>     Durée en secondes (10-60, défaut: 30)
  --theme <thème>      Thème des citations (voir liste ci-dessous)
  --images <urls>      URLs d'images personnalisées (séparées par des virgules)
  --overlay <opacity>  Opacité de l'overlay sur les images (0-1, défaut: 0.6)
  --transition <sec>   Durée de transition entre images (défaut: 3)
  --music <type>       Type de musique (inspirational, calm, energetic, emotional, motivational)
  --volume <level>     Volume de la musique (0-1, défaut: 0.3)
  --no-db             Ne pas sauvegarder en base de données
  --help              Afficher cette aide

Formats disponibles:
  - instagram: 1080x1920 (9:16) - Stories/Reels
  - tiktok: 1080x1920 (9:16) - TikTok
  - square: 1080x1080 (1:1) - Posts carrés

Animations disponibles:
  - fade-in: Apparition progressive du texte
  - slide-in: Glissement depuis le bas
  - typewriter: Effet machine à écrire

Fonds disponibles:
  - gradient: Dégradé coloré selon le thème
  - image: Image Unsplash avec overlay
  - solid: Couleur unie
  - slideshow: Succession d'images Unsplash avec transitions
  - custom: Images personnalisées avec transitions

Thèmes disponibles:
  - motivation, sagesse, amour, success, bonheur
  - inspiration, vie, philosophie, parentalite
  - education, famille, enfance

Exemples:
  npm run generate-videos -- --count 3 --format instagram --animation fade-in
  npm run generate-videos -- --theme parentalite --format square --duration 20
  npm run generate-videos -- --count 1 --no-db --animation typewriter
  npm run generate-videos -- --background slideshow --theme motivation
  npm run generate-videos -- --background custom --images "url1,url2,url3" --overlay 0.4
  npm run generate-videos -- --music inspirational --volume 0.4
  npm run generate-videos -- --theme motivation --music energetic --background slideshow
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
      case "--count":
        options.count = parseInt(args[++i]) || 1
        break
      case "--format":
        const format = args[++i]
        if (formats.includes(format)) {
          options.format = format as any
        } else {
          console.error(
            `❌ Format invalide: ${format}. Formats disponibles: ${formats.join(", ")}`
          )
          return
        }
        break
      case "--animation":
        const animation = args[++i]
        if (animations.includes(animation)) {
          options.animation = animation as any
        } else {
          console.error(
            `❌ Animation invalide: ${animation}. Animations disponibles: ${animations.join(
              ", "
            )}`
          )
          return
        }
        break
      case "--background":
        const background = args[++i]
        if (backgrounds.includes(background)) {
          options.background = background as any
        } else {
          console.error(
            `❌ Fond invalide: ${background}. Fonds disponibles: ${backgrounds.join(
              ", "
            )}`
          )
          return
        }
        break
      case "--duration":
        options.duration = parseInt(args[++i]) || 30
        break
      case "--theme":
        const theme = args[++i]
        if (themes.includes(theme)) {
          options.theme = theme
        } else {
          console.error(
            `❌ Thème invalide: ${theme}. Thèmes disponibles: ${themes.join(", ")}`
          )
          return
        }
        break
      case "--images":
        const images = args[++i]
        if (images) {
          options.backgroundImages = images.split(",").map((url) => url.trim())
        }
        break
      case "--overlay":
        const overlay = parseFloat(args[++i])
        if (overlay >= 0 && overlay <= 1) {
          options.imageOverlayOpacity = overlay
        } else {
          console.error("❌ Opacité de l'overlay doit être entre 0 et 1")
          return
        }
        break
      case "--transition":
        const transition = parseInt(args[++i])
        if (transition > 0) {
          options.imageTransitionDuration = transition
        } else {
          console.error("❌ Durée de transition doit être positive")
          return
        }
        break
      case "--music":
        const musicType = args[++i]
        if (musicTypes.includes(musicType)) {
          options.includeMusic = true
          options.musicType = musicType as any
        } else {
          console.error(
            `❌ Type de musique invalide: ${musicType}. Types disponibles: ${musicTypes.join(
              ", "
            )}`
          )
          return
        }
        break
      case "--volume":
        const volume = parseFloat(args[++i])
        if (volume >= 0 && volume <= 1) {
          options.musicVolume = volume
        } else {
          console.error("❌ Volume de la musique doit être entre 0 et 1")
          return
        }
        break
      case "--no-db":
        options.saveToDb = false
        break
    }
  }

  // Validation des options
  if (options.count && (options.count < 1 || options.count > 10)) {
    console.error("❌ Le nombre de vidéos doit être entre 1 et 10")
    return
  }

  if (options.duration && (options.duration < 10 || options.duration > 60)) {
    console.error("❌ La durée doit être entre 10 et 60 secondes")
    return
  }

  try {
    await generateVideos(options)
  } catch (error) {
    console.error("❌ Erreur lors de l'exécution:", error)
    process.exit(1)
  }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export default generateVideos
