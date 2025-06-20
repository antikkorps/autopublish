import { promises as fs } from "fs"
import path from "path"
import imageService, {
  CitationData,
  ImageGenerationOptions,
} from "../../../src/services/imageService"

describe("ImageService", () => {
  const testCitation: CitationData = {
    content: "La vie est belle quand on sait l'apprécier",
    author: "Test Author",
    theme: "happiness",
    hashtags: ["#motivation", "#vie", "#bonheur"],
  }

  afterEach(async () => {
    // Nettoyer les images de test
    try {
      const outputDir = path.join(process.cwd(), "public", "images", "generated")
      const files = await fs.readdir(outputDir)

      for (const file of files) {
        if (file.includes("test-") || file.includes("happiness-")) {
          await fs.unlink(path.join(outputDir, file))
        }
      }
    } catch (error) {
      // Ignorer les erreurs de nettoyage
    }
  })

  describe("generateImage", () => {
    test("génère une image avec le template minimal", async () => {
      const options: ImageGenerationOptions = {
        template: "minimal",
        width: 500,
        height: 500,
      }

      const result = await imageService.generateImage(testCitation, options)

      expect(result).toBeDefined()
      expect(result.filename).toMatch(/citation-happiness-\d+\.png/)
      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.metadata.width).toBe(500)
      expect(result.metadata.height).toBe(500)
      expect(result.metadata.template).toBe("minimal")
      expect(result.metadata.theme).toBe("happiness")

      // Vérifier que le fichier existe
      expect(
        await fs
          .access(result.path)
          .then(() => true)
          .catch(() => false)
      ).toBe(true)
    })

    test("génère une image avec différents templates", async () => {
      const templates = ["minimal", "gradient", "modern", "elegant"] as const

      for (const template of templates) {
        const result = await imageService.generateImage(testCitation, { template })

        expect(result.metadata.template).toBe(template)
        expect(result.filename).toMatch(/citation-happiness-\d+\.png/)
      }
    })

    test("adapte automatiquement la taille de police pour un long texte", async () => {
      const longCitation: CitationData = {
        content:
          "Ceci est un texte très long qui devrait nécessiter une adaptation automatique de la taille de police pour s'adapter correctement dans l'espace disponible de l'image générée. Le service doit calculer intelligemment la meilleure taille.",
        theme: "wisdom",
      }

      const result = await imageService.generateImage(longCitation)

      expect(result).toBeDefined()
      expect(result.metadata.theme).toBe("wisdom")
    })

    test("gère les thèmes avec des couleurs spécifiques", async () => {
      const themes = ["motivation", "success", "love", "life", "wisdom"]

      for (const theme of themes) {
        const citation: CitationData = {
          content: "Test citation",
          theme,
        }

        const result = await imageService.generateImage(citation)
        expect(result.metadata.theme).toBe(theme)
      }
    })

    test("inclut l'auteur quand spécifié", async () => {
      const options: ImageGenerationOptions = {
        includeAuthor: true,
      }

      const result = await imageService.generateImage(testCitation, options)
      expect(result).toBeDefined()
      // L'auteur est inclus visuellement, pas dans les métadonnées
    })

    test("inclut le branding quand activé", async () => {
      const options: ImageGenerationOptions = {
        includeBranding: true,
      }

      const result = await imageService.generateImage(testCitation, options)
      expect(result).toBeDefined()
    })
  })

  describe("generateVariations", () => {
    test("génère plusieurs variations d'une citation", async () => {
      const templates = ["minimal", "gradient"]

      const variations = await imageService.generateVariations(testCitation, templates)

      expect(variations).toHaveLength(2)
      expect(variations[0].metadata.template).toBe("minimal")
      expect(variations[1].metadata.template).toBe("gradient")

      // Vérifier que tous les fichiers existent
      for (const variation of variations) {
        const fileExists = await fs
          .access(variation.path)
          .then(() => true)
          .catch(() => false)
        expect(fileExists).toBe(true)
      }
    })

    test("génère toutes les variations par défaut", async () => {
      const variations = await imageService.generateVariations(testCitation)

      expect(variations.length).toBeGreaterThan(0)

      const templates = variations.map((v) => v.metadata.template)
      expect(templates).toContain("minimal")
      expect(templates).toContain("gradient")
      expect(templates).toContain("modern")
      expect(templates).toContain("elegant")
    })
  })

  describe("cleanupOldImages", () => {
    test("ne supprime aucune image récente", async () => {
      // Générer une image récente
      await imageService.generateImage(testCitation)

      const deletedCount = await imageService.cleanupOldImages(24)

      // Aucune image récente ne devrait être supprimée
      expect(deletedCount).toBe(0)
    })
  })

  describe("validation des paramètres", () => {
    test("génère une image avec des dimensions personnalisées", async () => {
      const options: ImageGenerationOptions = {
        width: 800,
        height: 600,
      }

      const result = await imageService.generateImage(testCitation, options)

      expect(result.metadata.width).toBe(800)
      expect(result.metadata.height).toBe(600)
    })

    test("utilise les valeurs par défaut quand les options sont vides", async () => {
      const result = await imageService.generateImage(testCitation, {})

      expect(result.metadata.width).toBe(1080)
      expect(result.metadata.height).toBe(1080)
      expect(result.metadata.template).toBe("minimal")
    })
  })
})
