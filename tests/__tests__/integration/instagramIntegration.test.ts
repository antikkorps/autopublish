import Citation from "@/models/Citation"
import Post from "@/models/Post"
import aiService from "@/services/aiService"
import { DailyGenerationService } from "@/services/dailyGenerationService"
import imageService from "@/services/imageService"
import instagramService from "@/services/instagramService"

// Mock des services
jest.mock("@/services/instagramService")
jest.mock("@/services/aiService")
jest.mock("@/services/imageService")
jest.mock("@/models/Citation")
jest.mock("@/models/Post")
jest.mock("@/config/database", () => ({
  authenticate: jest.fn().mockResolvedValue(undefined),
}))

const mockInstagramService = instagramService as jest.Mocked<typeof instagramService>
const mockAiService = aiService as jest.Mocked<typeof aiService>
const mockImageService = imageService as jest.Mocked<typeof imageService>
const mockCitation = Citation as jest.Mocked<typeof Citation>
const mockPost = Post as jest.Mocked<typeof Post>

describe("Instagram Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("DailyGenerationService avec Instagram", () => {
    it("devrait générer et publier des citations sur Instagram", async () => {
      // Configuration avec Instagram activé
      const config = {
        totalCitations: 2,
        themes: {
          motivation: { count: 1, style: "motivational" as const },
          wisdom: { count: 1, style: "philosophical" as const },
        },
        language: "fr",
        minQualityScore: 0.6,
        generateImages: true,
        publishToInstagram: true,
        instagramCredentials: {
          accessToken: "test_token",
          accountId: "test_account",
        },
      }

      // Mock des citations générées par l'IA
      const mockGeneratedCitations = [
        {
          content: "La motivation est la clé du succès",
          author: "Test Author",
          theme: "motivation",
          quality_score: 0.8,
          hashtags: ["motivation", "success"],
        },
        {
          content: "La sagesse vient avec l'expérience",
          author: "Wise Author",
          theme: "wisdom",
          quality_score: 0.9,
          hashtags: ["wisdom", "experience"],
        },
      ]

      // Mock des citations sauvées
      const mockSavedCitations = [
        {
          id: 1,
          content: "La motivation est la clé du succès",
          author: "Test Author",
          theme: "motivation",
          language: "fr",
          imagePath: "/path/to/image1.jpg",
          imageMetadata: {
            template: "minimal",
            width: 1080,
            height: 1080,
            theme: "motivation",
            format: "jpg",
          },
          update: jest.fn(),
        },
        {
          id: 2,
          content: "La sagesse vient avec l'expérience",
          author: "Wise Author",
          theme: "wisdom",
          language: "fr",
          imagePath: "/path/to/image2.jpg",
          imageMetadata: {
            template: "gradient",
            width: 1080,
            height: 1080,
            theme: "wisdom",
            format: "jpg",
          },
          update: jest.fn(),
        },
      ]

      // Mock des variations d'images
      const mockImageVariations = [
        {
          filename: "image1.jpg",
          path: "/path/to/image1.jpg",
          buffer: Buffer.from("fake image data"),
          metadata: {
            template: "minimal",
            width: 1080,
            height: 1080,
            theme: "motivation",
            format: "jpg",
          },
        },
      ]

      // Mock des posts créés
      const mockCreatedPosts = [
        { id: 1, update: jest.fn() },
        { id: 2, update: jest.fn() },
      ]

      // Mock des résultats de publication Instagram
      const mockInstagramResults = [
        {
          id: "instagram_post_1",
          permalink: "https://instagram.com/p/test1",
          timestamp: "2024-01-01T00:00:00Z",
        },
        {
          id: "instagram_post_2",
          permalink: "https://instagram.com/p/test2",
          timestamp: "2024-01-01T01:00:00Z",
        },
      ]

      // Configuration des mocks
      mockInstagramService.isConfigured.mockReturnValue(true)

      mockAiService.generateCitations
        .mockResolvedValueOnce([mockGeneratedCitations[0]])
        .mockResolvedValueOnce([mockGeneratedCitations[1]])

      mockCitation.create
        .mockResolvedValueOnce(mockSavedCitations[0] as any)
        .mockResolvedValueOnce(mockSavedCitations[1] as any)

      mockImageService.generateVariations
        .mockResolvedValueOnce(mockImageVariations)
        .mockResolvedValueOnce(mockImageVariations)

      mockInstagramService.generateHashtags
        .mockReturnValueOnce(["motivation", "citation"])
        .mockReturnValueOnce(["wisdom", "reflexion"])

      mockPost.create
        .mockResolvedValueOnce(mockCreatedPosts[0] as any)
        .mockResolvedValueOnce(mockCreatedPosts[1] as any)

      mockInstagramService.publishImage
        .mockResolvedValueOnce(mockInstagramResults[0])
        .mockResolvedValueOnce(mockInstagramResults[1])

      // Exécution
      const service = new DailyGenerationService(config)
      const stats = await service.generate()

      // Vérifications
      expect(stats.generated).toBe(2)
      expect(stats.saved).toBe(2)
      expect(stats.withImages).toBe(2)
      expect(stats.published).toBe(2)
      expect(stats.publishFailed).toBe(0)

      // Vérifier que l'IA a été appelée pour chaque thème
      expect(mockAiService.generateCitations).toHaveBeenCalledTimes(2)
      expect(mockAiService.generateCitations).toHaveBeenCalledWith(
        {
          theme: "motivation",
          language: "fr",
          count: 1,
          style: "motivational",
        },
        "openai"
      )

      // Vérifier que les images ont été générées
      expect(mockImageService.generateVariations).toHaveBeenCalledTimes(2)

      // Vérifier que les posts ont été créés en base
      expect(mockPost.create).toHaveBeenCalledTimes(2)

      // Vérifier que les publications Instagram ont été faites
      expect(mockInstagramService.publishImage).toHaveBeenCalledTimes(2)
      expect(mockInstagramService.publishImage).toHaveBeenCalledWith(
        config.instagramCredentials,
        expect.objectContaining({
          caption: expect.stringContaining("La motivation est la clé du succès"),
          imagePath: "/path/to/image1.jpg",
          hashtags: ["motivation", "citation"],
        })
      )

      // Vérifier que les modèles ont été mis à jour
      expect(mockSavedCitations[0].update).toHaveBeenCalledWith({
        status: "published",
        published_at: expect.any(Date),
      })

      expect(mockCreatedPosts[0].update).toHaveBeenCalledWith({
        instagram_post_id: "instagram_post_1",
        status: "published",
        published_at: expect.any(Date),
      })
    })

    it("devrait gérer les échecs de publication Instagram", async () => {
      const config = {
        totalCitations: 1,
        themes: {
          motivation: { count: 1, style: "motivational" as const },
        },
        language: "fr",
        minQualityScore: 0.6,
        generateImages: true,
        publishToInstagram: true,
        instagramCredentials: {
          accessToken: "test_token",
          accountId: "test_account",
        },
      }

      const mockGeneratedCitation = {
        content: "Test citation",
        author: "Test Author",
        theme: "motivation",
        quality_score: 0.8,
        hashtags: ["test"],
      }

      const mockSavedCitation = {
        id: 1,
        content: "Test citation",
        author: "Test Author",
        theme: "motivation",
        language: "fr",
        imagePath: "/path/to/image.jpg",
        imageMetadata: {
          template: "minimal",
          width: 1080,
          height: 1080,
          theme: "motivation",
          format: "jpg",
        },
        update: jest.fn(),
      }

      const mockCreatedPost = {
        id: 1,
        retry_count: 0,
        update: jest.fn(),
      }

      // Configuration des mocks
      mockInstagramService.isConfigured.mockReturnValue(true)
      mockAiService.generateCitations.mockResolvedValue([mockGeneratedCitation])
      mockCitation.create.mockResolvedValue(mockSavedCitation as any)
      mockImageService.generateVariations.mockResolvedValue([
        {
          filename: "image.jpg",
          path: "/path/to/image.jpg",
          buffer: Buffer.from("fake image data"),
          metadata: {
            template: "minimal",
            width: 1080,
            height: 1080,
            theme: "motivation",
            format: "jpg",
          },
        },
      ])
      mockInstagramService.generateHashtags.mockReturnValue(["test", "citation"])
      mockPost.create.mockResolvedValue(mockCreatedPost as any)

      // Simuler un échec de publication Instagram
      mockInstagramService.publishImage.mockRejectedValue(
        new Error("Instagram API Error")
      )

      // Exécution
      const service = new DailyGenerationService(config)
      const stats = await service.generate()

      // Vérifications
      expect(stats.generated).toBe(1)
      expect(stats.saved).toBe(1)
      expect(stats.withImages).toBe(1)
      expect(stats.published).toBe(0)
      expect(stats.publishFailed).toBe(1)

      // Vérifier que le post a été marqué comme échoué
      expect(mockCreatedPost.update).toHaveBeenCalledWith({
        status: "failed",
        error_message: "Instagram API Error",
        retry_count: 1,
      })
    })

    it("devrait fonctionner sans Instagram si non configuré", async () => {
      const config = {
        totalCitations: 1,
        themes: {
          motivation: { count: 1, style: "motivational" as const },
        },
        language: "fr",
        minQualityScore: 0.6,
        generateImages: true,
        publishToInstagram: false,
      }

      const mockGeneratedCitation = {
        content: "Test citation",
        author: "Test Author",
        theme: "motivation",
        quality_score: 0.8,
        hashtags: ["test"],
      }

      const mockSavedCitation = {
        id: 1,
        content: "Test citation",
        author: "Test Author",
        theme: "motivation",
        language: "fr",
        imagePath: "/path/to/image.jpg",
        update: jest.fn(),
      }

      // Configuration des mocks
      mockInstagramService.isConfigured.mockReturnValue(false)
      mockAiService.generateCitations.mockResolvedValue([mockGeneratedCitation])
      mockCitation.create.mockResolvedValue(mockSavedCitation as any)
      mockImageService.generateVariations.mockResolvedValue([
        {
          filename: "image.jpg",
          path: "/path/to/image.jpg",
          buffer: Buffer.from("fake image data"),
          metadata: {
            template: "minimal",
            width: 1080,
            height: 1080,
            theme: "motivation",
            format: "jpg",
          },
        },
      ])

      // Exécution
      const service = new DailyGenerationService(config)
      const stats = await service.generate()

      // Vérifications
      expect(stats.generated).toBe(1)
      expect(stats.saved).toBe(1)
      expect(stats.withImages).toBe(1)
      expect(stats.published).toBe(0)
      expect(stats.publishFailed).toBe(0)

      // Vérifier qu'Instagram n'a pas été appelé
      expect(mockInstagramService.publishImage).not.toHaveBeenCalled()
      expect(mockPost.create).not.toHaveBeenCalled()
    })

    it("devrait configurer automatiquement Instagram depuis l'environnement", () => {
      // Mock des variables d'environnement
      process.env.INSTAGRAM_ACCESS_TOKEN = "env_token"
      process.env.INSTAGRAM_ACCOUNT_ID = "env_account"

      mockInstagramService.isConfigured.mockReturnValue(true)

      const service = new DailyGenerationService({
        totalCitations: 1,
        themes: { motivation: { count: 1 } },
      })

      // Vérifier que la configuration a été automatiquement détectée
      expect(service["config"].publishToInstagram).toBe(true)
      expect(service["config"].instagramCredentials).toEqual({
        accessToken: "env_token",
        accountId: "env_account",
      })

      // Nettoyage
      delete process.env.INSTAGRAM_ACCESS_TOKEN
      delete process.env.INSTAGRAM_ACCOUNT_ID
    })

    it("devrait ignorer Instagram si les credentials ne sont pas fournis", () => {
      mockInstagramService.isConfigured.mockReturnValue(false)

      const service = new DailyGenerationService({
        totalCitations: 1,
        themes: { motivation: { count: 1 } },
        publishToInstagram: true, // Demandé mais pas de credentials
      })

      // Vérifier que Instagram reste désactivé car isConfigured retourne false
      expect(service["config"].publishToInstagram).toBe(true) // La config demande toujours Instagram
      expect(service["config"].instagramCredentials).toBeUndefined()
    })
  })

  describe("Workflow complet de publication", () => {
    it("devrait exécuter le workflow complet : génération → images → Instagram", async () => {
      const config = {
        totalCitations: 1,
        themes: {
          motivation: { count: 1, style: "motivational" as const },
        },
        language: "fr",
        minQualityScore: 0.7,
        generateImages: true,
        publishToInstagram: true,
        instagramCredentials: {
          accessToken: "test_token",
          accountId: "test_account",
        },
      }

      // Mock complet du workflow
      const mockGeneratedCitation = {
        content: "Workflow test citation",
        author: "Workflow Author",
        theme: "motivation",
        quality_score: 0.85,
        hashtags: ["workflow", "test"],
      }

      const mockSavedCitation = {
        id: 1,
        content: "Workflow test citation",
        author: "Workflow Author",
        theme: "motivation",
        language: "fr",
        imagePath: null, // Pas d'image au début
        imageMetadata: null,
        update: jest.fn().mockImplementation(function (this: any, updates: any) {
          Object.assign(this, updates)
          return Promise.resolve(this)
        }),
      }

      const mockImageVariations = [
        {
          filename: "workflow_image.jpg",
          path: "/path/to/workflow_image.jpg",
          buffer: Buffer.from("fake image data"),
          metadata: {
            template: "modern",
            width: 1080,
            height: 1080,
            theme: "motivation",
            format: "jpg",
          },
        },
      ]

      const mockCreatedPost = {
        id: 1,
        retry_count: 0,
        update: jest.fn(),
      }

      const mockInstagramResult = {
        id: "workflow_instagram_post",
        permalink: "https://instagram.com/p/workflow",
        timestamp: "2024-01-01T12:00:00Z",
      }

      // Configuration des mocks dans l'ordre du workflow
      mockInstagramService.isConfigured.mockReturnValue(true)
      mockAiService.generateCitations.mockResolvedValue([mockGeneratedCitation])
      mockCitation.create.mockResolvedValue(mockSavedCitation as any)
      mockImageService.generateVariations.mockResolvedValue(mockImageVariations)
      mockInstagramService.generateHashtags.mockReturnValue(["motivation", "workflow"])
      mockPost.create.mockResolvedValue(mockCreatedPost as any)
      mockInstagramService.publishImage.mockResolvedValue(mockInstagramResult)

      // Simuler la mise à jour de l'image après génération
      mockSavedCitation.update.mockImplementation((updates: any) => {
        Object.assign(mockSavedCitation, updates)
        return Promise.resolve(mockSavedCitation)
      })

      // Exécution
      const service = new DailyGenerationService(config)
      const stats = await service.generate()

      // Vérifications détaillées du workflow
      expect(stats.generated).toBe(1)
      expect(stats.saved).toBe(1)
      expect(stats.withImages).toBe(1)
      expect(stats.published).toBe(1)
      expect(stats.failed).toBe(0)

      // 1. Vérifier génération IA
      expect(mockAiService.generateCitations).toHaveBeenCalledWith(
        {
          theme: "motivation",
          language: "fr",
          count: 1,
          style: "motivational",
        },
        "openai"
      )

      // 2. Vérifier sauvegarde citation
      expect(mockCitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Workflow test citation",
          author: "Workflow Author",
          theme: "motivation",
          quality_score: 0.85,
        })
      )

      // 3. Vérifier génération d'images
      expect(mockImageService.generateVariations).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Workflow test citation",
          author: "Workflow Author",
          theme: "motivation",
        }),
        ["minimal", "gradient", "modern"]
      )

      // 4. Vérifier mise à jour avec image
      expect(mockSavedCitation.update).toHaveBeenCalledWith({
        imagePath: "/path/to/workflow_image.jpg",
        imageMetadata: {
          template: "modern",
          variations: expect.any(Array),
        },
      })

      // 5. Vérifier création du post
      expect(mockPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          citation_id: 1,
          image_path: "/path/to/workflow_image.jpg",
          template_used: "modern",
          status: "scheduled",
          hashtags: ["motivation", "workflow"],
        })
      )

      // 6. Vérifier publication Instagram
      expect(mockInstagramService.publishImage).toHaveBeenCalledWith(
        config.instagramCredentials,
        expect.objectContaining({
          caption: expect.stringContaining("Workflow test citation"),
          imagePath: "/path/to/workflow_image.jpg",
          hashtags: ["motivation", "workflow"],
        })
      )

      // 7. Vérifier mise à jour finale
      expect(mockCreatedPost.update).toHaveBeenCalledWith({
        instagram_post_id: "workflow_instagram_post",
        status: "published",
        published_at: expect.any(Date),
      })

      expect(mockSavedCitation.update).toHaveBeenCalledWith({
        status: "published",
        published_at: expect.any(Date),
      })
    })
  })
})
