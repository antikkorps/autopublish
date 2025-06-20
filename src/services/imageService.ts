import { CanvasRenderingContext2D, createCanvas } from "canvas"
import { promises as fs } from "fs"
import path from "path"
import sharp from "sharp"

export interface ImageGenerationOptions {
  width?: number
  height?: number
  template?: "minimal" | "gradient" | "modern" | "elegant"
  theme?: string
  backgroundColor?: string
  textColor?: string
  accentColor?: string
  includeAuthor?: boolean
  includeBranding?: boolean
}

export interface GeneratedImage {
  buffer: Buffer
  filename: string
  path: string
  metadata: {
    width: number
    height: number
    template: string
    theme: string
    format: string
  }
}

export interface CitationData {
  content: string
  author?: string
  theme: string
  hashtags?: string[]
}

class ImageService {
  private readonly outputDir: string
  private readonly templatesDir: string

  constructor() {
    this.outputDir = path.join(process.cwd(), "public", "images", "generated")
    this.templatesDir = path.join(process.cwd(), "public", "templates")
    this.ensureDirectories()
  }

  private async ensureDirectories() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true })
      await fs.mkdir(this.templatesDir, { recursive: true })
    } catch (error) {
      console.error("Erreur lors de la création des dossiers:", error)
    }
  }

  /**
   * Génère une image Instagram à partir d'une citation
   */
  async generateImage(
    citation: CitationData,
    options: ImageGenerationOptions = {}
  ): Promise<GeneratedImage> {
    const {
      width = 1080,
      height = 1080,
      template = "minimal",
      includeAuthor = true,
      includeBranding = true,
    } = options

    // Créer le canvas
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext("2d")

    // Appliquer le template choisi
    await this.applyTemplate(ctx, citation, { ...options, width, height })

    // Générer le nom de fichier unique
    const timestamp = Date.now()
    const themeSafe = citation.theme.replace(/[^a-zA-Z0-9]/g, "-")
    const filename = `citation-${themeSafe}-${timestamp}.png`
    const imagePath = path.join(this.outputDir, filename)

    // Convertir en buffer et optimiser avec Sharp
    const buffer = canvas.toBuffer("image/png")
    const optimizedBuffer = await sharp(buffer)
      .png({ quality: 90, compressionLevel: 9 })
      .toBuffer()

    // Sauvegarder le fichier
    await fs.writeFile(imagePath, optimizedBuffer)

    return {
      buffer: optimizedBuffer,
      filename,
      path: imagePath,
      metadata: {
        width,
        height,
        template,
        theme: citation.theme,
        format: "png",
      },
    }
  }

  /**
   * Applique un template spécifique au canvas
   */
  private async applyTemplate(
    ctx: CanvasRenderingContext2D,
    citation: CitationData,
    options: ImageGenerationOptions & { width: number; height: number }
  ) {
    const { template, width, height } = options

    // Effacer le canvas
    ctx.clearRect(0, 0, width, height)

    switch (template) {
      case "minimal":
        await this.applyMinimalTemplate(ctx, citation, options)
        break
      case "gradient":
        await this.applyGradientTemplate(ctx, citation, options)
        break
      case "modern":
        await this.applyModernTemplate(ctx, citation, options)
        break
      case "elegant":
        await this.applyElegantTemplate(ctx, citation, options)
        break
      default:
        await this.applyMinimalTemplate(ctx, citation, options)
    }
  }

  /**
   * Template minimal - fond uni avec texte centré
   */
  private async applyMinimalTemplate(
    ctx: CanvasRenderingContext2D,
    citation: CitationData,
    options: ImageGenerationOptions & { width: number; height: number }
  ) {
    const { width, height, theme } = options
    const colors = this.getThemeColors(theme || citation.theme)

    // Fond
    ctx.fillStyle = colors.background
    ctx.fillRect(0, 0, width, height)

    // Configuration du texte
    const padding = 80
    const maxWidth = width - padding * 2

    // Citation principale
    ctx.fillStyle = colors.text
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    // Calculer la taille de police adaptée
    const fontSize = this.calculateFontSize(ctx, citation.content, maxWidth, 300)
    ctx.font = `${fontSize}px "Arial", sans-serif`

    // Dessiner la citation avec retour à la ligne
    const lines = this.wrapText(ctx, citation.content, maxWidth)
    const lineHeight = fontSize * 1.4
    const totalTextHeight = lines.length * lineHeight

    let startY = (height - totalTextHeight) / 2

    // Ajouter les guillemets
    ctx.font = `${fontSize * 1.5}px "Arial", sans-serif`
    ctx.fillStyle = colors.accent
    ctx.fillText('"', width / 2 - maxWidth / 2, startY - fontSize / 2)
    ctx.fillText('"', width / 2 + maxWidth / 2, startY + totalTextHeight + fontSize / 2)

    // Texte principal
    ctx.font = `${fontSize}px "Arial", sans-serif`
    ctx.fillStyle = colors.text

    lines.forEach((line, index) => {
      const y = startY + index * lineHeight
      ctx.fillText(line, width / 2, y)
    })

    // Auteur (si présent)
    if (options.includeAuthor && citation.author) {
      const authorY = startY + totalTextHeight + 60
      ctx.font = `${fontSize * 0.6}px "Arial", sans-serif`
      ctx.fillStyle = colors.accent
      ctx.fillText(`— ${citation.author}`, width / 2, authorY)
    }

    // Branding (si activé)
    if (options.includeBranding) {
      ctx.font = '24px "Arial", sans-serif'
      ctx.fillStyle = colors.muted
      ctx.textAlign = "right"
      ctx.fillText("@autopublish", width - 40, height - 40)
    }
  }

  /**
   * Template avec gradient de fond
   */
  private async applyGradientTemplate(
    ctx: CanvasRenderingContext2D,
    citation: CitationData,
    options: ImageGenerationOptions & { width: number; height: number }
  ) {
    const { width, height, theme } = options
    const colors = this.getThemeColors(theme || citation.theme)

    // Gradient de fond
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, colors.background)
    gradient.addColorStop(1, colors.accent + "40") // Transparence 40%

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    // Overlay semi-transparent pour améliorer la lisibilité
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)"
    ctx.fillRect(0, 0, width, height)

    // Appliquer le reste comme le template minimal
    await this.applyMinimalTemplate(ctx, citation, {
      ...options,
      backgroundColor: "transparent",
    })
  }

  /**
   * Template moderne avec formes géométriques
   */
  private async applyModernTemplate(
    ctx: CanvasRenderingContext2D,
    citation: CitationData,
    options: ImageGenerationOptions & { width: number; height: number }
  ) {
    const { width, height, theme } = options
    const colors = this.getThemeColors(theme || citation.theme)

    // Fond
    ctx.fillStyle = colors.background
    ctx.fillRect(0, 0, width, height)

    // Formes géométriques décoratives
    ctx.fillStyle = colors.accent + "20"

    // Cercle en haut à droite
    ctx.beginPath()
    ctx.arc(width - 100, 100, 80, 0, Math.PI * 2)
    ctx.fill()

    // Rectangle en bas à gauche
    ctx.fillRect(50, height - 150, 100, 100)

    // Continuer avec le texte du template minimal
    await this.applyMinimalTemplate(ctx, citation, options)
  }

  /**
   * Template élégant avec bordures
   */
  private async applyElegantTemplate(
    ctx: CanvasRenderingContext2D,
    citation: CitationData,
    options: ImageGenerationOptions & { width: number; height: number }
  ) {
    const { width, height, theme } = options
    const colors = this.getThemeColors(theme || citation.theme)

    // Fond
    ctx.fillStyle = colors.background
    ctx.fillRect(0, 0, width, height)

    // Bordure élégante
    const borderWidth = 4
    const borderPadding = 60

    ctx.strokeStyle = colors.accent
    ctx.lineWidth = borderWidth
    ctx.strokeRect(
      borderPadding,
      borderPadding,
      width - borderPadding * 2,
      height - borderPadding * 2
    )

    // Coins décoratifs
    const cornerSize = 20
    ctx.fillStyle = colors.accent

    // Coins supérieurs
    ctx.fillRect(
      borderPadding - borderWidth,
      borderPadding - borderWidth,
      cornerSize,
      cornerSize
    )
    ctx.fillRect(
      width - borderPadding - cornerSize + borderWidth,
      borderPadding - borderWidth,
      cornerSize,
      cornerSize
    )

    // Coins inférieurs
    ctx.fillRect(
      borderPadding - borderWidth,
      height - borderPadding - cornerSize + borderWidth,
      cornerSize,
      cornerSize
    )
    ctx.fillRect(
      width - borderPadding - cornerSize + borderWidth,
      height - borderPadding - cornerSize + borderWidth,
      cornerSize,
      cornerSize
    )

    // Texte avec plus de padding
    await this.applyMinimalTemplate(ctx, citation, {
      ...options,
      backgroundColor: "transparent",
    })
  }

  /**
   * Calcule la taille de police optimale pour le texte
   */
  private calculateFontSize(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxHeight: number
  ): number {
    let fontSize = 60

    while (fontSize > 20) {
      ctx.font = `${fontSize}px "Arial", sans-serif`
      const lines = this.wrapText(ctx, text, maxWidth)
      const totalHeight = lines.length * fontSize * 1.4

      if (totalHeight <= maxHeight) {
        return fontSize
      }

      fontSize -= 2
    }

    return 20
  }

  /**
   * Découpe le texte en lignes selon la largeur maximale
   */
  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string[] {
    const words = text.split(" ")
    const lines: string[] = []
    let currentLine = ""

    for (const word of words) {
      const testLine = currentLine + (currentLine ? " " : "") + word
      const metrics = ctx.measureText(testLine)

      if (metrics.width > maxWidth && currentLine !== "") {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }

    return lines
  }

  /**
   * Retourne les couleurs selon le thème
   */
  private getThemeColors(theme: string): {
    background: string
    text: string
    accent: string
    muted: string
  } {
    const colorSchemes = {
      motivation: {
        background: "#1a1a2e",
        text: "#ffffff",
        accent: "#ffd700",
        muted: "#cccccc",
      },
      success: {
        background: "#0f3460",
        text: "#ffffff",
        accent: "#00ff87",
        muted: "#b0c4de",
      },
      love: {
        background: "#ffe4e6",
        text: "#2d1b20",
        accent: "#ff6b9d",
        muted: "#8a6b73",
      },
      life: {
        background: "#f0f8ff",
        text: "#2c3e50",
        accent: "#3498db",
        muted: "#7f8c8d",
      },
      wisdom: {
        background: "#2c1810",
        text: "#f4f1de",
        accent: "#d4a574",
        muted: "#a0916c",
      },
      happiness: {
        background: "#fff9e6",
        text: "#2d2a00",
        accent: "#ffcc02",
        muted: "#996600",
      },
      inspiration: {
        background: "#e8f4fd",
        text: "#1a365d",
        accent: "#2b77ad",
        muted: "#4a90b8",
      },
      default: {
        background: "#ffffff",
        text: "#333333",
        accent: "#007acc",
        muted: "#666666",
      },
    }

    return colorSchemes[theme as keyof typeof colorSchemes] || colorSchemes.default
  }

  /**
   * Génère plusieurs variations d'une citation
   */
  async generateVariations(
    citation: CitationData,
    templates: string[] = ["minimal", "gradient", "modern", "elegant"]
  ): Promise<GeneratedImage[]> {
    const variations: GeneratedImage[] = []

    for (const template of templates) {
      try {
        const image = await this.generateImage(citation, {
          template: template as any,
          includeAuthor: true,
          includeBranding: true,
        })
        variations.push(image)
      } catch (error) {
        console.error(`Erreur lors de la génération du template ${template}:`, error)
      }
    }

    return variations
  }

  /**
   * Nettoie les anciens fichiers générés
   */
  async cleanupOldImages(maxAgeHours: number = 24): Promise<number> {
    try {
      const files = await fs.readdir(this.outputDir)
      const now = Date.now()
      const maxAge = maxAgeHours * 60 * 60 * 1000
      let deletedCount = 0

      for (const file of files) {
        const filePath = path.join(this.outputDir, file)
        const stats = await fs.stat(filePath)

        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath)
          deletedCount++
        }
      }

      return deletedCount
    } catch (error) {
      console.error("Erreur lors du nettoyage:", error)
      return 0
    }
  }
}

export default new ImageService()
