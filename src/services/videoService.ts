import ffmpegInstaller from "@ffmpeg-installer/ffmpeg"
import { CanvasRenderingContext2D, createCanvas, loadImage } from "canvas"
import ffmpeg from "fluent-ffmpeg"
import fs from "fs/promises"
import path from "path"
import freeMusicService from "./freeMusicService"

// Configuration FFmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path)

export interface CitationData {
  content: string
  author?: string
  theme: string
  hashtags?: string[]
}

export interface VideoOptions {
  duration?: number // en secondes
  format?: "instagram" | "tiktok" | "square" // format de la vidéo
  includeMusic?: boolean
  musicType?: "inspirational" | "calm" | "energetic" | "emotional" | "motivational"
  musicVolume?: number // Volume de la musique (0-1, défaut: 0.3)
  animation?: "fade-in" | "slide-in" | "typewriter"
  background?: "gradient" | "image" | "solid" | "slideshow" | "custom"
  quality?: "high" | "medium" | "low"
  backgroundImages?: string[] // URLs d'images personnalisées
  imageTransitionDuration?: number // Durée de transition entre images (en secondes)
  imageOverlayOpacity?: number // Opacité de l'overlay sur les images (0-1)
}

export interface GeneratedVideo {
  buffer: Buffer
  filename: string
  path: string
  metadata: {
    duration: number
    format: string
    resolution: string
    size: number
    theme: string
  }
}

class VideoService {
  private outputDir: string
  private tempDir: string

  constructor() {
    this.outputDir = path.join(process.cwd(), "public", "videos", "generated")
    this.tempDir = path.join(process.cwd(), "temp", "videos")
    this.ensureDirectories()
  }

  private async ensureDirectories() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true })
      await fs.mkdir(this.tempDir, { recursive: true })
    } catch (error) {
      console.error("Erreur lors de la création des répertoires:", error)
    }
  }

  /**
   * Génère une vidéo à partir d'une citation
   */
  async generateVideo(
    citation: CitationData,
    options: VideoOptions = {}
  ): Promise<GeneratedVideo> {
    const {
      duration = 30,
      format = "instagram",
      includeMusic = false,
      animation = "fade-in",
      background = "gradient",
      quality = "medium",
    } = options

    console.log(`🎬 Génération de vidéo: ${citation.content.substring(0, 50)}...`)

    try {
      // 1. Créer les frames animées
      const framesDir = await this.createAnimatedFrames(citation, {
        duration,
        animation,
        background,
        format,
        ...options, // Passer toutes les options
      })

      // 2. Générer la vidéo à partir des frames
      const videoPath = await this.createVideoFromFrames(framesDir, {
        duration,
        format,
        quality,
      })

      // 3. Ajouter de la musique si demandé
      let finalVideoPath = videoPath
      if (includeMusic) {
        finalVideoPath = await this.addBackgroundMusic(videoPath, options)
      }

      // 4. Optimiser pour le format cible
      const optimizedPath = await this.optimizeForSocialMedia(finalVideoPath, format)

      // 5. Lire le fichier final
      const buffer = await fs.readFile(optimizedPath)
      const stats = await fs.stat(optimizedPath)

      // 6. Nettoyer les fichiers temporaires
      await this.cleanupTempFiles(framesDir, videoPath, finalVideoPath)

      // 7. Générer le nom de fichier unique
      const timestamp = Date.now()
      const themeSafe = citation.theme.replace(/[^a-zA-Z0-9]/g, "-")
      const filename = `video-${themeSafe}-${timestamp}.mp4`
      const finalPath = path.join(this.outputDir, filename)

      // 8. Déplacer vers le répertoire final
      await fs.copyFile(optimizedPath, finalPath)

      return {
        buffer,
        filename,
        path: finalPath,
        metadata: {
          duration,
          format,
          resolution: this.getResolution(format),
          size: stats.size,
          theme: citation.theme,
        },
      }
    } catch (error) {
      console.error("Erreur lors de la génération de vidéo:", error)
      throw error
    }
  }

  /**
   * Crée des frames animées pour la vidéo
   */
  private async createAnimatedFrames(
    citation: CitationData,
    options: {
      duration: number
      animation: string
      background: string
      format: string
    } & VideoOptions
  ): Promise<string> {
    const { duration, animation, background, format, ...videoOptions } = options
    const fps = 30
    const totalFrames = duration * fps
    const framesDir = path.join(this.tempDir, `frames-${Date.now()}`)

    await fs.mkdir(framesDir, { recursive: true })

    const { width, height } = this.getDimensions(format)

    for (let frame = 0; frame < totalFrames; frame++) {
      const canvas = createCanvas(width, height)
      const ctx = canvas.getContext("2d")
      const progress = frame / totalFrames

      // Dessiner le fond
      await this.drawBackground(ctx, background, citation.theme, progress, videoOptions)

      // Dessiner le texte avec animation
      await this.drawAnimatedText(ctx, citation, animation, progress, { width, height })

      // Sauvegarder la frame
      const buffer = canvas.toBuffer("image/png")
      const framePath = path.join(
        framesDir,
        `frame-${frame.toString().padStart(6, "0")}.png`
      )
      await fs.writeFile(framePath, buffer)
    }

    return framesDir
  }

  /**
   * Dessine le fond de la vidéo
   */
  private async drawBackground(
    ctx: CanvasRenderingContext2D,
    backgroundType: string,
    theme: string,
    progress: number,
    options: VideoOptions = {}
  ): Promise<void> {
    const { width, height } = ctx.canvas
    const {
      backgroundImages = [],
      imageOverlayOpacity = 0.6,
      imageTransitionDuration = 3,
    } = options

    if (backgroundType === "gradient") {
      const colors = this.getThemeColors(theme)
      const gradient = ctx.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, colors.background)
      gradient.addColorStop(1, colors.accent)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)
    } else if (backgroundType === "solid") {
      const colors = this.getThemeColors(theme)
      ctx.fillStyle = colors.background
      ctx.fillRect(0, 0, width, height)
    } else if (backgroundType === "image") {
      // Utiliser une image Unsplash comme fond
      await this.drawImageBackground(ctx, theme, width, height, imageOverlayOpacity)
    } else if (backgroundType === "slideshow") {
      // Succession d'images avec transitions
      await this.drawSlideshowBackground(ctx, theme, width, height, progress, {
        backgroundImages,
        imageOverlayOpacity,
        imageTransitionDuration,
      })
    } else if (backgroundType === "custom" && backgroundImages.length > 0) {
      // Utiliser des images personnalisées
      await this.drawCustomImageBackground(
        ctx,
        backgroundImages,
        width,
        height,
        progress,
        {
          imageOverlayOpacity,
          imageTransitionDuration,
        }
      )
    } else {
      // Fallback vers gradient
      const colors = this.getThemeColors(theme)
      const gradient = ctx.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, colors.background)
      gradient.addColorStop(1, colors.accent)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)
    }
  }

  /**
   * Dessine une image de fond simple
   */
  private async drawImageBackground(
    ctx: CanvasRenderingContext2D,
    theme: string,
    width: number,
    height: number,
    overlayOpacity: number
  ): Promise<void> {
    try {
      const imageUrl = await this.getUnsplashImageUrl(theme, width, height)
      if (imageUrl) {
        const image = await loadImage(imageUrl)
        ctx.drawImage(image, 0, 0, width, height)

        // Ajouter un overlay semi-transparent
        ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`
        ctx.fillRect(0, 0, width, height)
      }
    } catch (error) {
      // Fallback vers gradient
      const colors = this.getThemeColors(theme)
      const gradient = ctx.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, colors.background)
      gradient.addColorStop(1, colors.accent)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)
    }
  }

  /**
   * Dessine un slideshow d'images avec transitions
   */
  private async drawSlideshowBackground(
    ctx: CanvasRenderingContext2D,
    theme: string,
    width: number,
    height: number,
    progress: number,
    options: {
      backgroundImages: string[]
      imageOverlayOpacity: number
      imageTransitionDuration: number
    }
  ): Promise<void> {
    const { backgroundImages, imageOverlayOpacity, imageTransitionDuration } = options

    // Si des images personnalisées sont fournies, les utiliser
    let imageUrls = backgroundImages

    // Sinon, générer des images Unsplash selon le thème
    if (imageUrls.length === 0) {
      imageUrls = await this.generateThemeImages(theme, 3) // 3 images par défaut
    }

    if (imageUrls.length === 0) {
      // Fallback vers gradient
      const colors = this.getThemeColors(theme)
      const gradient = ctx.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, colors.background)
      gradient.addColorStop(1, colors.accent)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)
      return
    }

    // Calculer quelle image afficher et la transition
    const totalDuration = 30 // Durée totale de la vidéo
    const imageDuration = totalDuration / imageUrls.length
    const currentImageIndex = Math.floor(progress * imageUrls.length)
    const nextImageIndex = (currentImageIndex + 1) % imageUrls.length

    // Calculer le progrès dans l'image actuelle
    const imageProgress = (progress * imageUrls.length) % 1

    try {
      // Charger l'image actuelle
      const currentImage = await loadImage(imageUrls[currentImageIndex])
      ctx.drawImage(currentImage, 0, 0, width, height)

      // Si on est en transition, charger et mélanger avec l'image suivante
      if (imageProgress > 0.8 && imageUrls.length > 1) {
        const nextImage = await loadImage(imageUrls[nextImageIndex])
        const transitionProgress = (imageProgress - 0.8) / 0.2 // 0 à 1 sur les 20% de transition

        // Dessiner l'image suivante avec opacité croissante
        ctx.globalAlpha = transitionProgress
        ctx.drawImage(nextImage, 0, 0, width, height)
        ctx.globalAlpha = 1
      }

      // Ajouter un overlay semi-transparent
      ctx.fillStyle = `rgba(0, 0, 0, ${imageOverlayOpacity})`
      ctx.fillRect(0, 0, width, height)
    } catch (error) {
      // Fallback vers gradient
      const colors = this.getThemeColors(theme)
      const gradient = ctx.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, colors.background)
      gradient.addColorStop(1, colors.accent)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)
    }
  }

  /**
   * Dessine des images personnalisées avec transitions
   */
  private async drawCustomImageBackground(
    ctx: CanvasRenderingContext2D,
    imageUrls: string[],
    width: number,
    height: number,
    progress: number,
    options: {
      imageOverlayOpacity: number
      imageTransitionDuration: number
    }
  ): Promise<void> {
    const { imageOverlayOpacity, imageTransitionDuration } = options

    if (imageUrls.length === 0) return

    // Calculer quelle image afficher
    const imageIndex = Math.floor(progress * imageUrls.length) % imageUrls.length
    const nextImageIndex = (imageIndex + 1) % imageUrls.length

    // Calculer le progrès dans l'image actuelle
    const imageProgress = (progress * imageUrls.length) % 1

    try {
      // Charger l'image actuelle
      const currentImage = await loadImage(imageUrls[imageIndex])
      ctx.drawImage(currentImage, 0, 0, width, height)

      // Si on est en transition, charger et mélanger avec l'image suivante
      if (imageProgress > 0.8 && imageUrls.length > 1) {
        const nextImage = await loadImage(imageUrls[nextImageIndex])
        const transitionProgress = (imageProgress - 0.8) / 0.2

        // Dessiner l'image suivante avec opacité croissante
        ctx.globalAlpha = transitionProgress
        ctx.drawImage(nextImage, 0, 0, width, height)
        ctx.globalAlpha = 1
      }

      // Ajouter un overlay semi-transparent
      ctx.fillStyle = `rgba(0, 0, 0, ${imageOverlayOpacity})`
      ctx.fillRect(0, 0, width, height)
    } catch (error) {
      console.error("Erreur lors du chargement d'image personnalisée:", error)
      // Fallback vers un fond uni
      ctx.fillStyle = "#000000"
      ctx.fillRect(0, 0, width, height)
    }
  }

  /**
   * Génère plusieurs images Unsplash pour un thème
   */
  private async generateThemeImages(theme: string, count: number): Promise<string[]> {
    const imageUrls: string[] = []

    for (let i = 0; i < count; i++) {
      try {
        const imageUrl = await this.getUnsplashImageUrl(theme, 1080, 1920)
        if (imageUrl) {
          imageUrls.push(imageUrl)
        }
      } catch (error) {
        console.warn(
          `Impossible de récupérer l'image ${i + 1} pour le thème ${theme}:`,
          error
        )
      }
    }

    return imageUrls
  }

  /**
   * Dessine le texte avec animation
   */
  private async drawAnimatedText(
    ctx: CanvasRenderingContext2D,
    citation: CitationData,
    animation: string,
    progress: number,
    dimensions: { width: number; height: number }
  ): Promise<void> {
    const { width, height } = dimensions
    const colors = this.getThemeColors(citation.theme)

    // Configuration du texte
    const padding = 80
    const maxWidth = width - padding * 2
    const fontSize = this.calculateFontSize(ctx, citation.content, maxWidth, 200)

    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    // Appliquer l'animation selon le type
    let opacity = 1
    let yOffset = 0
    let textProgress = 1

    if (animation === "fade-in") {
      opacity = Math.min(1, progress * 3) // Apparition progressive
    } else if (animation === "slide-in") {
      opacity = Math.min(1, progress * 2)
      yOffset = (1 - progress) * 50 // Glissement depuis le bas
    } else if (animation === "typewriter") {
      textProgress = Math.min(1, progress * 2) // Texte qui s'affiche progressivement
    }

    // Appliquer l'opacité
    ctx.globalAlpha = opacity

    // Dessiner le texte principal
    ctx.font = `bold ${fontSize}px "Arial", sans-serif`
    ctx.fillStyle = colors.text

    // Ajouter une ombre pour la lisibilité
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)"
    ctx.shadowBlur = 4
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2

    const lines = this.wrapText(ctx, citation.content, maxWidth)
    const lineHeight = fontSize * 1.4
    const totalTextHeight = lines.length * lineHeight
    let startY = (height - totalTextHeight) / 2 + yOffset

    // Pour l'effet typewriter, limiter le nombre de caractères affichés
    if (animation === "typewriter") {
      const totalChars = citation.content.length
      const charsToShow = Math.floor(totalChars * textProgress)
      const partialContent = citation.content.substring(0, charsToShow)
      const partialLines = this.wrapText(ctx, partialContent, maxWidth)

      partialLines.forEach((line, index) => {
        const y = startY + index * lineHeight
        ctx.fillText(line, width / 2, y)
      })
    } else {
      // Afficher tout le texte
      lines.forEach((line, index) => {
        const y = startY + index * lineHeight
        ctx.fillText(line, width / 2, y)
      })
    }

    // Afficher l'auteur (si présent) après le texte principal
    if (citation.author && progress > 0.7) {
      const authorOpacity = Math.min(1, (progress - 0.7) * 3.33)
      ctx.globalAlpha = authorOpacity

      const authorY = startY + totalTextHeight + 60
      ctx.font = `${fontSize * 0.6}px "Arial", sans-serif`
      ctx.fillStyle = colors.accent
      ctx.fillText(`— ${citation.author}`, width / 2, authorY)
    }

    // Réinitialiser l'opacité
    ctx.globalAlpha = 1
  }

  /**
   * Crée une vidéo à partir des frames
   */
  private async createVideoFromFrames(
    framesDir: string,
    options: { duration: number; format: string; quality: string }
  ): Promise<string> {
    const { duration, format, quality } = options
    const fps = 30
    const outputPath = path.join(this.tempDir, `video-${Date.now()}.mp4`)

    return new Promise((resolve, reject) => {
      const command = ffmpeg()
        .input(path.join(framesDir, "frame-%06d.png"))
        .inputFPS(fps)
        .outputOptions([
          "-c:v libx264",
          "-preset medium",
          "-crf 23",
          "-pix_fmt yuv420p",
          "-movflags +faststart",
        ])
        .output(outputPath)
        .on("end", () => resolve(outputPath))
        .on("error", (err) => reject(err))
        .run()
    })
  }

  /**
   * Ajoute de la musique de fond à la vidéo
   */
  private async addBackgroundMusic(
    videoPath: string,
    options: VideoOptions = {}
  ): Promise<string> {
    const { musicType = "inspirational", musicVolume = 0.3 } = options

    try {
      console.log(`🎵 Ajout de musique de fond: ${musicType}`)

      // Utiliser le nouveau service de musique libre
      const musicPath = await freeMusicService.getRandomMusic(musicType)

      if (!musicPath) {
        console.warn("⚠️ Aucune musique trouvée, vidéo sans musique")
        return videoPath
      }

      const outputPath = videoPath.replace(".mp4", "-with-music.mp4")

      return new Promise((resolve, reject) => {
        ffmpeg()
          .input(videoPath)
          .input(musicPath)
          .complexFilter([`[1:a]volume=${musicVolume}[music]`])
          .outputOptions([
            "-map 0:v",
            "-map [music]",
            "-c:v copy",
            "-c:a aac",
            "-shortest",
          ])
          .output(outputPath)
          .on("end", () => {
            console.log("✅ Musique ajoutée avec succès")
            resolve(outputPath)
          })
          .on("error", (err) => {
            console.error("❌ Erreur lors de l'ajout de musique:", err)
            reject(err)
          })
          .run()
      })
    } catch (error) {
      console.error("❌ Erreur lors de l'ajout de musique:", error)
      return videoPath // Retourner la vidéo originale si erreur
    }
  }

  /**
   * Obtient le chemin d'une musique selon le type
   */
  private async getMusicPath(musicType: string): Promise<string | null> {
    const musicDir = path.join(process.cwd(), "public", "music")
    const musicFiles = {
      inspirational: "inspirational-background.wav",
      calm: "calm-background.wav",
      energetic: "energetic-background.wav",
      emotional: "emotional-background.wav",
      motivational: "motivational-background.wav",
    }

    const fileName = musicFiles[musicType as keyof typeof musicFiles]
    if (!fileName) {
      return null
    }

    const musicPath = path.join(musicDir, fileName)

    // Vérifier si le fichier existe
    try {
      await fs.access(musicPath)
      return musicPath
    } catch {
      // Si le fichier n'existe pas, essayer de le télécharger
      return await this.downloadMusic(musicType, musicPath)
    }
  }

  /**
   * Télécharge une musique depuis une source libre de droits
   */
  private async downloadMusic(
    musicType: string,
    musicPath: string
  ): Promise<string | null> {
    try {
      console.log(`🎵 Téléchargement de la musique ${musicType}...`)

      // URLs de musiques libres de droits (exemples)
      const musicUrls = {
        inspirational: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav", // Exemple
        calm: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav", // Exemple
        energetic: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav", // Exemple
        emotional: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav", // Exemple
        motivational: "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav", // Exemple
      }

      const url = musicUrls[musicType as keyof typeof musicUrls]
      if (!url) {
        return null
      }

      // Télécharger la musique
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`)
      }

      const buffer = await response.arrayBuffer()
      await fs.writeFile(musicPath, Buffer.from(buffer))

      console.log(`✅ Musique ${musicType} téléchargée`)
      return musicPath
    } catch (error) {
      console.error(`❌ Erreur lors du téléchargement de la musique ${musicType}:`, error)
      return null
    }
  }

  /**
   * Optimise la vidéo pour les réseaux sociaux
   */
  private async optimizeForSocialMedia(
    videoPath: string,
    format: string
  ): Promise<string> {
    const outputPath = path.join(this.tempDir, `optimized-${Date.now()}.mp4`)

    return new Promise((resolve, reject) => {
      const command = ffmpeg()
        .input(videoPath)
        .outputOptions([
          "-c:v libx264",
          "-preset fast",
          "-crf 28", // Compression plus forte pour les réseaux sociaux
          "-maxrate 2M",
          "-bufsize 4M",
          "-movflags +faststart",
        ])
        .output(outputPath)
        .on("end", () => resolve(outputPath))
        .on("error", (err) => reject(err))
        .run()
    })
  }

  /**
   * Nettoie les fichiers temporaires
   */
  private async cleanupTempFiles(...paths: string[]): Promise<void> {
    for (const filePath of paths) {
      try {
        if (filePath.includes("frames-")) {
          // Supprimer le répertoire de frames
          await fs.rm(filePath, { recursive: true, force: true })
        } else {
          // Supprimer le fichier
          await fs.unlink(filePath)
        }
      } catch (error) {
        console.warn(`Impossible de supprimer ${filePath}:`, error)
      }
    }
  }

  /**
   * Obtient les dimensions selon le format
   */
  private getDimensions(format: string): { width: number; height: number } {
    switch (format) {
      case "instagram":
        return { width: 1080, height: 1920 } // 9:16
      case "tiktok":
        return { width: 1080, height: 1920 } // 9:16
      case "square":
        return { width: 1080, height: 1080 } // 1:1
      default:
        return { width: 1080, height: 1920 }
    }
  }

  /**
   * Obtient la résolution en string
   */
  private getResolution(format: string): string {
    const { width, height } = this.getDimensions(format)
    return `${width}x${height}`
  }

  /**
   * Obtient les couleurs selon le thème
   */
  private getThemeColors(theme: string): {
    background: string
    text: string
    accent: string
  } {
    const colorMap: Record<string, { background: string; text: string; accent: string }> =
      {
        motivation: {
          background: "#1a1a2e",
          text: "#ffffff",
          accent: "#ff6b6b",
        },
        wisdom: {
          background: "#2c3e50",
          text: "#ecf0f1",
          accent: "#3498db",
        },
        love: {
          background: "#e74c3c",
          text: "#ffffff",
          accent: "#f39c12",
        },
        success: {
          background: "#27ae60",
          text: "#ffffff",
          accent: "#f1c40f",
        },
        happiness: {
          background: "#f39c12",
          text: "#ffffff",
          accent: "#e74c3c",
        },
        inspiration: {
          background: "#8e44ad",
          text: "#ffffff",
          accent: "#3498db",
        },
        life: {
          background: "#34495e",
          text: "#ecf0f1",
          accent: "#e67e22",
        },
        philosophy: {
          background: "#2c3e50",
          text: "#bdc3c7",
          accent: "#95a5a6",
        },
        parentalite: {
          background: "#e8f4fd",
          text: "#2c3e50",
          accent: "#3498db",
        },
        education: {
          background: "#fef9e7",
          text: "#2c3e50",
          accent: "#f39c12",
        },
        famille: {
          background: "#eafaf1",
          text: "#2c3e50",
          accent: "#27ae60",
        },
        enfance: {
          background: "#fdf2e9",
          text: "#2c3e50",
          accent: "#e67e22",
        },
      }

    return colorMap[theme] || colorMap.motivation
  }

  /**
   * Calcule la taille de police adaptée
   */
  private calculateFontSize(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxHeight: number
  ): number {
    let fontSize = 100
    ctx.font = `${fontSize}px Arial`

    while (fontSize > 20) {
      const lines = this.wrapText(ctx, text, maxWidth)
      const lineHeight = fontSize * 1.4
      const totalHeight = lines.length * lineHeight

      if (totalHeight <= maxHeight) {
        break
      }

      fontSize -= 5
      ctx.font = `${fontSize}px Arial`
    }

    return fontSize
  }

  /**
   * Coupe le texte en lignes
   */
  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string[] {
    const words = text.split(" ")
    const lines: string[] = []
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
    return lines
  }

  /**
   * Récupère une image Unsplash (réutilisé depuis imageService)
   */
  private async getUnsplashImageUrl(
    theme: string,
    width: number,
    height: number
  ): Promise<string | null> {
    try {
      const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY
      if (!unsplashAccessKey) {
        return null
      }

      const query = this.getUnsplashQuery(theme)
      const response = await fetch(
        `https://api.unsplash.com/photos/random?query=${encodeURIComponent(
          query
        )}&w=${width}&h=${height}&orientation=portrait`,
        {
          headers: {
            Authorization: `Client-ID ${unsplashAccessKey}`,
          },
        }
      )

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      return data.urls?.regular || null
    } catch (error) {
      console.error("Erreur lors de la récupération d'image Unsplash:", error)
      return null
    }
  }

  /**
   * Génère une requête Unsplash selon le thème
   */
  private getUnsplashQuery(theme: string): string {
    const queryMap: Record<string, string> = {
      motivation: "motivation inspiration",
      wisdom: "philosophy wisdom",
      love: "love romance",
      success: "success achievement",
      happiness: "happiness joy",
      inspiration: "inspiration creativity",
      life: "life nature",
      philosophy: "philosophy thinking",
      parentalite: "family parenting",
      education: "education learning",
      famille: "family home",
      enfance: "childhood children",
    }

    return queryMap[theme] || "inspiration"
  }

  /**
   * Génère plusieurs variations de vidéos
   */
  async generateVariations(
    citation: CitationData,
    options: VideoOptions[] = []
  ): Promise<GeneratedVideo[]> {
    const defaultOptions: VideoOptions[] = [
      { format: "instagram", animation: "fade-in" },
      { format: "square", animation: "slide-in" },
      { format: "tiktok", animation: "typewriter" },
    ]

    const variationsToGenerate = options.length > 0 ? options : defaultOptions
    const variations: GeneratedVideo[] = []

    for (const videoOptions of variationsToGenerate) {
      try {
        const video = await this.generateVideo(citation, videoOptions)
        variations.push(video)
      } catch (error) {
        console.error(`Erreur lors de la génération de la variation:`, error)
      }
    }

    return variations
  }
}

const videoService = new VideoService()
export default videoService
