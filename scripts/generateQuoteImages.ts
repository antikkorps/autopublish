import { createCanvas, loadImage } from "canvas"
import dotenv from "dotenv"
import { existsSync, mkdirSync, writeFileSync } from "fs"
import { join } from "path"

dotenv.config()

const INSTAGRAM_SIZE = 1080 // Format carré Instagram
const NINJA_API_KEY = process.env.NINJA_API_KEY
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

interface Quote {
  quote: string
  author: string
}

class QuoteImageGenerator {
  private canvas: any
  private ctx: any

  constructor() {
    this.canvas = createCanvas(INSTAGRAM_SIZE, INSTAGRAM_SIZE)
    this.ctx = this.canvas.getContext("2d")
  }

  async fetchQuote(category: string, source: "ninja" | "ia"): Promise<Quote> {
    if (source === "ninja") {
      try {
        console.log(`Récupération d'une citation ${category} depuis l'API Ninjas...`)
        const url = new URL("https://api-ninjas.com/api/quotes")
        url.searchParams.append("category", category)
        const response = await fetch(url.toString(), {
          headers: { "X-Api-Key": NINJA_API_KEY || "" },
        })
        if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`)
        const data = await response.json()
        if (data && data.length > 0) {
          return { quote: data[0].quote, author: data[0].author }
        }
        throw new Error("Aucune citation trouvée")
      } catch (error) {
        console.error(`Erreur API Ninja, fallback...`, error)
        return this.getFallbackQuote(category)
      }
    } else {
      // IA locale (OpenAI)
      try {
        if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquante")
        const prompt = `Donne-moi une citation courte et inspirante sur le thème "${category}". Réponds uniquement par la citation et l'auteur, format JSON: {\"quote\":\"...\",\"author\":\"...\"}`
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 80,
            temperature: 0.8,
          }),
        })
        if (!response.ok) throw new Error(`Erreur OpenAI: ${response.status}`)
        const data = await response.json()
        const content = data.choices[0].message.content
        const parsed = JSON.parse(content)
        return parsed
      } catch (error) {
        console.error("Erreur API IA, fallback...", error)
        return this.getFallbackQuote(category)
      }
    }
  }

  getFallbackQuote(category: string): Quote {
    const fallbackQuotes = {
      motivation: [
        {
          quote:
            "Le succès n'est pas final, l'échec n'est pas fatal : c'est le courage de continuer qui compte.",
          author: "Winston Churchill",
        },
        {
          quote: "La seule façon de faire du bon travail est d'aimer ce que vous faites.",
          author: "Steve Jobs",
        },
        {
          quote: "Le futur appartient à ceux qui croient en la beauté de leurs rêves.",
          author: "Eleanor Roosevelt",
        },
      ],
      education: [
        {
          quote:
            "L'éducation est l'arme la plus puissante que vous pouvez utiliser pour changer le monde.",
          author: "Nelson Mandela",
        },
        {
          quote: "L'investissement dans la connaissance rapporte les meilleurs intérêts.",
          author: "Benjamin Franklin",
        },
        {
          quote:
            "L'éducation n'est pas la préparation à la vie, l'éducation c'est la vie elle-même.",
          author: "John Dewey",
        },
      ],
    }
    const quotes =
      fallbackQuotes[category as keyof typeof fallbackQuotes] || fallbackQuotes.motivation
    return quotes[Math.floor(Math.random() * quotes.length)]
  }

  async fetchUnsplashImage(category: string): Promise<Buffer> {
    if (!UNSPLASH_ACCESS_KEY) throw new Error("UNSPLASH_ACCESS_KEY manquante")
    const searchTerms = {
      motivation: ["success", "achievement", "goal", "inspiration"],
      education: ["books", "learning", "study", "knowledge"],
    }
    const terms =
      searchTerms[category as keyof typeof searchTerms] || searchTerms.motivation
    for (let i = 0; i < terms.length; i++) {
      const term = terms[i]
      try {
        const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(
          term
        )}&orientation=squarish&client_id=${UNSPLASH_ACCESS_KEY}`
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Erreur HTTP Unsplash: ${response.status}`)
        const data = await response.json()
        if (data && data.urls && data.urls.regular) {
          const imgResp = await fetch(data.urls.regular)
          if (!imgResp.ok) throw new Error("Erreur téléchargement image Unsplash")
          const arrayBuffer = await imgResp.arrayBuffer()
          return Buffer.from(arrayBuffer)
        }
      } catch (e) {
        console.warn(
          `Essai Unsplash échoué pour le mot-clé "${term}", on tente le suivant...`
        )
      }
    }
    throw new Error("Aucune image Unsplash trouvée")
  }

  wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(" ")
    const lines: string[] = []
    let currentLine = words[0]
    for (let i = 1; i < words.length; i++) {
      const word = words[i]
      const width = this.ctx.measureText(currentLine + " " + word).width
      if (width < maxWidth) {
        currentLine += " " + word
      } else {
        lines.push(currentLine)
        currentLine = word
      }
    }
    lines.push(currentLine)
    return lines
  }

  async generateImage(category: string, source: "ninja" | "ia"): Promise<string> {
    console.log(`\n=== Génération d'une image ${category} (${source}) ===`)
    // Récupérer la citation
    const quote = await this.fetchQuote(category, source)
    console.log(`Citation: "${quote.quote}" - ${quote.author}`)
    // Récupérer l'image de fond
    let imageBuffer: Buffer
    try {
      imageBuffer = await this.fetchUnsplashImage(category)
    } catch (e) {
      console.error("Erreur Unsplash, fallback gradient...", e)
      // Fallback gradient
      const fallbackCanvas = createCanvas(INSTAGRAM_SIZE, INSTAGRAM_SIZE)
      const fallbackCtx = fallbackCanvas.getContext("2d")
      const gradients = {
        motivation: ["#FF6B6B", "#4ECDC4"],
        education: ["#667eea", "#764ba2"],
      }
      const colors = gradients[category as keyof typeof gradients] || gradients.motivation
      const gradient = fallbackCtx.createLinearGradient(
        0,
        0,
        INSTAGRAM_SIZE,
        INSTAGRAM_SIZE
      )
      gradient.addColorStop(0, colors[0])
      gradient.addColorStop(1, colors[1])
      fallbackCtx.fillStyle = gradient
      fallbackCtx.fillRect(0, 0, INSTAGRAM_SIZE, INSTAGRAM_SIZE)
      imageBuffer = fallbackCanvas.toBuffer()
    }
    const backgroundImage = await loadImage(imageBuffer)
    this.ctx.drawImage(backgroundImage, 0, 0, INSTAGRAM_SIZE, INSTAGRAM_SIZE)
    // Overlay
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.4)"
    this.ctx.fillRect(0, 0, INSTAGRAM_SIZE, INSTAGRAM_SIZE)
    // Texte
    const maxWidth = INSTAGRAM_SIZE * 0.8
    const centerX = INSTAGRAM_SIZE / 2
    let currentY = INSTAGRAM_SIZE * 0.3
    this.ctx.font = "bold 48px Arial"
    this.ctx.fillStyle = "#FFFFFF"
    this.ctx.textAlign = "center"
    const lines = this.wrapText(quote.quote, maxWidth)
    lines.forEach((line) => {
      this.ctx.fillText(line, centerX, currentY)
      currentY += 60
    })
    // Auteur
    currentY += 40
    this.ctx.font = "italic 32px Arial"
    this.ctx.fillStyle = "#E0E0E0"
    this.ctx.fillText(`— ${quote.author}`, centerX, currentY)
    // Hashtags
    const hashtags = {
      motivation: ["#motivation", "#inspiration", "#success", "#goals", "#mindset"],
      education: ["#education", "#learning", "#knowledge", "#study", "#growth"],
    }
    const tags = hashtags[category as keyof typeof hashtags] || hashtags.motivation
    currentY += 80
    this.ctx.font = "24px Arial"
    this.ctx.fillStyle = "#CCCCCC"
    const hashtagText = tags.join(" ")
    this.ctx.fillText(hashtagText, centerX, currentY)
    // Sauvegarde
    const outputDir = join(process.cwd(), "public", "images", "generated")
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filename = `quote_${category}_${source}_${timestamp}.png`
    const filepath = join(outputDir, filename)
    const buffer = this.canvas.toBuffer("image/png")
    writeFileSync(filepath, buffer)
    console.log(`✅ Image générée: ${filepath}`)
    return filepath
  }
}

async function main() {
  const args = process.argv.slice(2)
  const source = args[0] === "ia" || args[0] === "ninja" ? args[0] : "ninja"
  const generator = new QuoteImageGenerator()
  try {
    await generator.generateImage("motivation", source as "ninja" | "ia")
    await generator.generateImage("education", source as "ninja" | "ia")
    console.log("\n🎉 Génération terminée avec succès !")
    console.log("📁 Images disponibles dans: public/images/generated/")
  } catch (error) {
    console.error("❌ Erreur lors de la génération:", error)
    process.exit(1)
  }
}

main()
