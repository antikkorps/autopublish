import videoService from "@/services/videoService"
import fs from "fs/promises"

// Mock toutes les dépendances externes
jest.mock("fs/promises")
jest.mock("canvas", () => {
  const mockCanvas = {
    getContext: jest.fn(() => ({
      fillStyle: "",
      fillRect: jest.fn(),
      createLinearGradient: jest.fn(() => ({
        addColorStop: jest.fn(),
      })),
      drawImage: jest.fn(),
      globalAlpha: 1,
      textAlign: "center",
      textBaseline: "middle",
      font: "",
      fillText: jest.fn(),
      shadowColor: "",
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      measureText: jest.fn(() => ({ width: 100 })), // Mock measureText
      canvas: mockCanvas, // Référence circulaire pour ctx.canvas
    })),
    toBuffer: jest.fn(() => Buffer.from("fake-image-data")),
    width: 1080,
    height: 1080,
  }

  return {
    createCanvas: jest.fn(() => mockCanvas),
    loadImage: jest.fn(() =>
      Promise.resolve({
        width: 1080,
        height: 1080,
      })
    ),
  }
})

jest.mock("fluent-ffmpeg", () => {
  const mockFfmpeg = jest.fn((): any => ({
    input: jest.fn().mockReturnThis(),
    inputFPS: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    on: jest.fn((event: string, callback: () => void): any => {
      if (event === "end") {
        setTimeout(() => callback(), 100)
      }
      return mockFfmpeg()
    }),
    run: jest.fn(),
  }))

  // Ajouter la méthode statique setFfmpegPath
  ;(mockFfmpeg as any).setFfmpegPath = jest.fn()

  return mockFfmpeg
})

// Mock fetch global si nécessaire
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  })
) as any

// Mock ffmpeg-installer
jest.mock("@ffmpeg-installer/ffmpeg", () => ({
  path: "/fake/ffmpeg/path",
}))

const mockFs = fs as jest.Mocked<typeof fs>

const citationData = {
  content: "La vie est belle.",
  author: "Auteur Test",
  theme: "motivation",
  hashtags: ["#motivation"],
}

describe("VideoService - Tests unitaires", () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Mock des méthodes fs
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.writeFile.mockResolvedValue(undefined)
    mockFs.readFile.mockResolvedValue(Buffer.from("fake-video-data"))
    mockFs.stat.mockResolvedValue({ size: 1024 } as any)
    mockFs.copyFile.mockResolvedValue(undefined)
    mockFs.access.mockResolvedValue(undefined)

    // Mock des logs
    jest.spyOn(console, "log").mockImplementation(() => {})
    jest.spyOn(console, "warn").mockImplementation(() => {})
    jest.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("Génération vidéo sans musique", () => {
    it("génère une vidéo avec fond gradient par défaut", async () => {
      const result = await videoService.generateVideo(citationData, {
        duration: 5,
        format: "square",
        includeMusic: false,
        background: "gradient",
      })

      expect(result).toHaveProperty("filename")
      expect(result).toHaveProperty("buffer")
      expect(result).toHaveProperty("path")
      expect(result.metadata).toMatchObject({
        duration: 5,
        format: "square",
        resolution: "1080x1080",
        theme: "motivation",
      })
    })

    it("génère une vidéo avec fond solide", async () => {
      const result = await videoService.generateVideo(citationData, {
        duration: 10,
        format: "instagram",
        includeMusic: false,
        background: "solid",
      })

      expect(result.metadata).toMatchObject({
        duration: 10,
        format: "instagram",
        resolution: "1080x1920",
      })
    })
  })

  describe("Génération vidéo avec musique", () => {
    it("génère une vidéo avec musique inspirational", async () => {
      const result = await videoService.generateVideo(citationData, {
        duration: 5,
        format: "square",
        includeMusic: true,
        musicType: "inspirational",
        musicVolume: 0.2,
        background: "gradient",
      })

      expect(result).toHaveProperty("filename")
      expect(result).toHaveProperty("buffer")
      expect(result.metadata).toMatchObject({
        duration: 5,
        format: "square",
      })
    })

    it("génère une vidéo avec musique energetic", async () => {
      const result = await videoService.generateVideo(citationData, {
        duration: 15,
        format: "tiktok",
        includeMusic: true,
        musicType: "energetic",
        musicVolume: 0.5,
        background: "gradient",
      })

      expect(result.metadata).toMatchObject({
        duration: 15,
        format: "tiktok",
        resolution: "1080x1920",
      })
    })

    it("génère une vidéo avec musique calm", async () => {
      const result = await videoService.generateVideo(citationData, {
        duration: 20,
        format: "square",
        includeMusic: true,
        musicType: "calm",
        musicVolume: 0.3,
        background: "gradient",
      })

      expect(result.metadata).toMatchObject({
        duration: 20,
        format: "square",
      })
    })
  })

  describe("Génération vidéo avec fonds personnalisés", () => {
    it("génère une vidéo avec fond image personnalisé et musique", async () => {
      const result = await videoService.generateVideo(citationData, {
        duration: 5,
        format: "square",
        includeMusic: true,
        musicType: "emotional",
        background: "custom",
        backgroundImages: [
          "https://images.unsplash.com/photo-1",
          "https://images.unsplash.com/photo-2",
        ],
        imageOverlayOpacity: 0.5,
      })

      expect(result).toHaveProperty("filename")
      expect(result).toHaveProperty("buffer")
      expect(result.metadata).toMatchObject({
        duration: 5,
        format: "square",
      })
    })

    it("génère une vidéo avec fond slideshow et musique motivational", async () => {
      const result = await videoService.generateVideo(citationData, {
        duration: 5,
        format: "square",
        includeMusic: true,
        musicType: "motivational",
        background: "slideshow",
        imageTransitionDuration: 2,
      })

      expect(result).toHaveProperty("filename")
      expect(result).toHaveProperty("buffer")
      expect(result.metadata).toMatchObject({
        duration: 5,
        format: "square",
      })
    })
  })

  describe("Génération vidéo avec animations", () => {
    it("génère une vidéo avec animation fade-in et musique", async () => {
      const result = await videoService.generateVideo(citationData, {
        duration: 5,
        format: "square",
        includeMusic: true,
        musicType: "inspirational",
        animation: "fade-in",
        background: "gradient",
      })

      expect(result.metadata).toMatchObject({
        duration: 5,
        format: "square",
      })
    })

    it("génère une vidéo avec animation typewriter et musique", async () => {
      const result = await videoService.generateVideo(citationData, {
        duration: 5,
        format: "square",
        includeMusic: true,
        musicType: "energetic",
        animation: "typewriter",
        background: "gradient",
      })

      expect(result.metadata).toMatchObject({
        duration: 5,
        format: "square",
      })
    })
  })

  describe("Génération de variations", () => {
    it("génère plusieurs variations de vidéos", async () => {
      const variations = await videoService.generateVariations(citationData, [
        { format: "square", includeMusic: true, musicType: "inspirational" },
        { format: "instagram", includeMusic: true, musicType: "calm" },
        { format: "tiktok", includeMusic: false },
      ])

      expect(variations).toHaveLength(3)
      expect(variations[0].metadata.format).toBe("square")
      expect(variations[1].metadata.format).toBe("instagram")
      expect(variations[2].metadata.format).toBe("tiktok")
    })
  })

  describe("Gestion des erreurs", () => {
    it("gère l'erreur de création de répertoire", async () => {
      mockFs.mkdir.mockRejectedValue(new Error("Permission denied"))

      await expect(
        videoService.generateVideo(citationData, {
          duration: 5,
          format: "square",
        })
      ).rejects.toThrow("Permission denied")
    })

    it("gère l'erreur de lecture de fichier", async () => {
      mockFs.readFile.mockRejectedValue(new Error("File not found"))

      await expect(
        videoService.generateVideo(citationData, {
          duration: 5,
          format: "square",
        })
      ).rejects.toThrow("File not found")
    })
  })
})
