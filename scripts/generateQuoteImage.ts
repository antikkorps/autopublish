#!/usr/bin/env tsx

import publicQuoteService from "@/services/publicQuoteService"
import { createCanvas, loadImage } from "canvas"
import dotenv from "dotenv"
import fs from "fs/promises"
import path from "path"

// Charger les variables d'environnement
dotenv.config()

async function generateQuoteImage() {
  console.log("🖼️ Génération d'une image avec citation Ninjas...")

  try {
    // 1. Récupérer une citation depuis l'API Ninjas
    console.log("📡 Récupération de la citation...")
    const citationData = await publicQuoteService.getRandomQuote("motivation")
    console.log(`💭 Citation: "${citationData.content}"`)
    console.log(`👤 Auteur: ${citationData.author}`)
    console.log(`🏷️  Thème: ${citationData.theme}`)

    // 2. Créer l'image
    console.log("\n🎨 Création de l'image...")
    const width = 1080
    const height = 1920 // Format Instagram
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext("2d")

    // Fond dégradé
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, "#667eea")
    gradient.addColorStop(1, "#764ba2")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    // Ajouter une image de fond depuis Unsplash
    try {
      const imageUrl = `https://source.unsplash.com/1080x1920/?${citationData.theme},motivation`
      console.log(`📸 Téléchargement de l'image: ${imageUrl}`)
      const image = await loadImage(imageUrl)

      // Dessiner l'image avec overlay
      ctx.globalAlpha = 0.3
      ctx.drawImage(image, 0, 0, width, height)
      ctx.globalAlpha = 1.0
    } catch (error) {
      console.warn(
        "⚠️ Impossible de charger l'image de fond, utilisation du dégradé uniquement"
      )
    }

    // Overlay semi-transparent
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"
    ctx.fillRect(0, 0, width, height)

    // Configuration du texte
    ctx.textAlign = "center"
    ctx.fillStyle = "#ffffff"

    // Titre
    ctx.font = "bold 48px Arial"
    ctx.fillText("Citation du Jour", width / 2, 200)

    // Citation
    ctx.font = "bold 36px Arial"
    const maxWidth = width - 100
    const words = citationData.content.split(" ")
    const lines = []
    let currentLine = words[0]

    for (let i = 1; i < words.length; i++) {
      const word = words[i]
      const width = ctx.measureText(currentLine + " " + word).width
      if (width < maxWidth) {
        currentLine += " " + word
      } else {
        lines.push(currentLine)
        currentLine = word
      }
    }
    lines.push(currentLine)

    // Dessiner les lignes de citation
    const lineHeight = 50
    const startY = height / 2 - (lines.length * lineHeight) / 2

    lines.forEach((line, index) => {
      ctx.fillText(line, width / 2, startY + index * lineHeight)
    })

    // Auteur
    ctx.font = "italic 28px Arial"
    ctx.fillStyle = "#e0e0e0"
    ctx.fillText(
      `— ${citationData.author}`,
      width / 2,
      startY + lines.length * lineHeight + 80
    )

    // Hashtags
    if (citationData.hashtags && citationData.hashtags.length > 0) {
      ctx.font = "20px Arial"
      ctx.fillStyle = "#cccccc"
      const hashtags = citationData.hashtags.slice(0, 3).join(" ")
      ctx.fillText(hashtags, width / 2, height - 100)
    }

    // 3. Sauvegarder l'image
    console.log("💾 Sauvegarde de l'image...")
    const outputDir = path.join(process.cwd(), "public", "images", "generated")
    await fs.mkdir(outputDir, { recursive: true })

    const timestamp = Date.now()
    const filename = `quote-${citationData.theme}-${timestamp}.png`
    const filepath = path.join(outputDir, filename)

    const buffer = canvas.toBuffer("image/png")
    await fs.writeFile(filepath, buffer)

    console.log(`\n✅ Image générée avec succès !`)
    console.log(`📁 Fichier: ${filename}`)
    console.log(`📊 Taille: ${Math.round(buffer.length / 1024)}KB`)
    console.log(`📐 Résolution: ${width}x${height}`)
    console.log(`📂 Chemin: ${filepath}`)

    return {
      filename,
      filepath,
      buffer,
      citation: citationData,
    }
  } catch (error) {
    console.error("❌ Erreur lors de la génération:", error)
    throw error
  }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  generateQuoteImage()
    .then(() => console.log("\n🎉 Génération terminée !"))
    .catch((error) => {
      console.error("\n❌ Échec:", error.message)
      process.exit(1)
    })
}

export default generateQuoteImage
