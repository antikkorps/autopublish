import instagramService, {
  InstagramCredentials,
  InstagramPostOptions,
} from "@/services/instagramService"

// Mock de fetch
global.fetch = jest.fn()
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

// Mock de fs
jest.mock("fs/promises", () => ({
  readFile: jest.fn(),
}))

const mockFs = require("fs/promises")

describe("InstagramService", () => {
  const mockCredentials: InstagramCredentials = {
    accessToken: "test_access_token",
    accountId: "test_account_id",
  }

  const mockPostOptions: InstagramPostOptions = {
    caption: "Test caption",
    imagePath: "/path/to/test/image.jpg",
    hashtags: ["test", "motivation"],
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock des variables d'environnement
    process.env.INSTAGRAM_ACCESS_TOKEN = "test_token"
    process.env.INSTAGRAM_ACCOUNT_ID = "test_account"
  })

  afterEach(() => {
    delete process.env.INSTAGRAM_ACCESS_TOKEN
    delete process.env.INSTAGRAM_ACCOUNT_ID
  })

  describe("Configuration", () => {
    it("devrait détecter si le service est configuré", () => {
      expect(instagramService.isConfigured()).toBe(true)

      delete process.env.INSTAGRAM_ACCESS_TOKEN
      expect(instagramService.isConfigured()).toBe(false)
    })

    it("devrait valider la configuration au démarrage", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation()

      delete process.env.INSTAGRAM_ACCESS_TOKEN
      delete process.env.INSTAGRAM_ACCOUNT_ID

      // Importer le service sans les variables d'environnement
      jest.resetModules()
      const { default: newInstagramService } = require("@/services/instagramService")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Variables d'environnement Instagram manquantes")
      )

      consoleSpy.mockRestore()
    })
  })

  describe("getAccountInfo", () => {
    it("devrait récupérer les informations du compte", async () => {
      const mockAccountInfo = {
        username: "test_user",
        name: "Test User",
        account_type: "BUSINESS",
        followers_count: 1000,
        media_count: 50,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccountInfo,
      } as Response)

      const result = await instagramService.getAccountInfo(mockCredentials)

      expect(result).toEqual(mockAccountInfo)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockCredentials.accountId}`)
      )
    })

    it("devrait gérer les erreurs d'API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({ error: { message: "Invalid token" } }),
      } as Response)

      await expect(instagramService.getAccountInfo(mockCredentials)).rejects.toThrow(
        "Invalid token"
      )
    })
  })

  describe("checkPublishingLimits", () => {
    it("devrait récupérer les limites de publication", async () => {
      const mockLimits = {
        data: [
          {
            quota_usage: 10,
            config: {
              quota_total: 100,
              quota_duration: 86400,
            },
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockLimits,
      } as Response)

      const result = await instagramService.checkPublishingLimits(mockCredentials)

      expect(result).toEqual(mockLimits.data[0])
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("content_publishing_limit")
      )
    })
  })

  describe("createMediaContainer", () => {
    it("devrait créer un conteneur média", async () => {
      const mockImageBuffer = Buffer.from("fake image data")
      mockFs.readFile.mockResolvedValue(mockImageBuffer)

      const mockResponse = { id: "container_123" }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await instagramService.createMediaContainer(
        mockCredentials,
        mockPostOptions
      )

      expect(result).toEqual({ id: "container_123", status: "IN_PROGRESS" })
      expect(mockFs.readFile).toHaveBeenCalledWith(mockPostOptions.imagePath)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/media"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      )
    })

    it("devrait inclure les hashtags dans la caption", async () => {
      const mockImageBuffer = Buffer.from("fake image data")
      mockFs.readFile.mockResolvedValue(mockImageBuffer)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "container_123" }),
      } as Response)

      await instagramService.createMediaContainer(mockCredentials, {
        ...mockPostOptions,
        hashtags: ["motivation", "inspiration"],
      })

      const fetchCall = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1]?.body as string)

      expect(requestBody.caption).toContain("#motivation #inspiration")
    })
  })

  describe("checkContainerStatus", () => {
    it("devrait vérifier le statut d'un conteneur", async () => {
      const mockStatus = { status_code: "FINISHED" }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus,
      } as Response)

      const result = await instagramService.checkContainerStatus(
        mockCredentials,
        "container_123"
      )

      expect(result).toEqual({ id: "container_123", status: "FINISHED" })
    })
  })

  describe("publishMediaContainer", () => {
    it("devrait publier un conteneur média", async () => {
      const mockPublishResponse = { id: "post_456" }
      const mockPostDetails = {
        permalink: "https://instagram.com/p/test",
        timestamp: "2024-01-01T00:00:00Z",
      }

      // Mock pour la publication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPublishResponse,
      } as Response)

      // Mock pour les détails du post
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPostDetails,
      } as Response)

      const result = await instagramService.publishMediaContainer(
        mockCredentials,
        "container_123"
      )

      expect(result).toEqual({
        id: "post_456",
        permalink: mockPostDetails.permalink,
        timestamp: mockPostDetails.timestamp,
      })
    })
  })

  describe("publishImage", () => {
    it("devrait publier une image complète (workflow complet)", async () => {
      const mockImageBuffer = Buffer.from("fake image data")
      mockFs.readFile.mockResolvedValue(mockImageBuffer)

      // Mock des limites
      const mockLimits = {
        data: [{ quota_usage: 10, config: { quota_total: 100, quota_duration: 86400 } }],
      }

      // Mock création conteneur
      const mockContainerResponse = { id: "container_123" }

      // Mock statut conteneur (FINISHED)
      const mockStatusResponse = { status_code: "FINISHED" }

      // Mock publication
      const mockPublishResponse = { id: "post_456" }

      // Mock détails post
      const mockPostDetails = {
        permalink: "https://instagram.com/p/test",
        timestamp: "2024-01-01T00:00:00Z",
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLimits,
        } as Response) // Limites
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockContainerResponse,
        } as Response) // Conteneur
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStatusResponse,
        } as Response) // Statut
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPublishResponse,
        } as Response) // Publication
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPostDetails,
        } as Response) // Détails

      const result = await instagramService.publishImage(mockCredentials, mockPostOptions)

      expect(result).toEqual({
        id: "post_456",
        permalink: mockPostDetails.permalink,
        timestamp: mockPostDetails.timestamp,
      })

      // Vérifier que toutes les étapes ont été appelées
      expect(mockFetch).toHaveBeenCalledTimes(5)
    })

    it("devrait échouer si les limites sont atteintes", async () => {
      const mockLimits = {
        data: [{ quota_usage: 100, config: { quota_total: 100, quota_duration: 86400 } }],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockLimits,
      } as Response)

      await expect(
        instagramService.publishImage(mockCredentials, mockPostOptions)
      ).rejects.toThrow("Limite de publication Instagram atteinte")
    })
  })

  describe("generateHashtags", () => {
    it("devrait générer des hashtags pour différents thèmes", () => {
      const motivationHashtags = instagramService.generateHashtags("motivation", "fr")
      expect(motivationHashtags).toContain("motivation")
      expect(motivationHashtags).toContain("citation")
      expect(motivationHashtags.length).toBeGreaterThan(0)

      const wisdomHashtags = instagramService.generateHashtags("wisdom", "en")
      expect(wisdomHashtags).toContain("wisdom")
      expect(wisdomHashtags).toContain("quote")
    })

    it("devrait utiliser la langue par défaut si non spécifiée", () => {
      const hashtags = instagramService.generateHashtags("success")
      expect(hashtags).toContain("citation") // Français par défaut
    })

    it("devrait gérer les thèmes inconnus", () => {
      const hashtags = instagramService.generateHashtags("unknown_theme", "fr")
      expect(hashtags).toContain("citation")
      expect(hashtags).toContain("penseedujour")
    })
  })

  describe("testConnection", () => {
    it("devrait tester la connexion avec succès", async () => {
      // Spy sur la méthode getAccountInfo
      const getAccountInfoSpy = jest
        .spyOn(instagramService, "getAccountInfo")
        .mockResolvedValue({ username: "test_user" })

      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      const result = await instagramService.testConnection(mockCredentials)

      expect(result).toBe(true)
      expect(consoleSpy).toHaveBeenCalledWith("✅ Connexion Instagram réussie")
      expect(getAccountInfoSpy).toHaveBeenCalledWith(mockCredentials)

      getAccountInfoSpy.mockRestore()
      consoleSpy.mockRestore()
    })

    it("devrait gérer les échecs de connexion", async () => {
      // Spy sur la méthode getAccountInfo pour qu'elle lance une erreur
      const getAccountInfoSpy = jest
        .spyOn(instagramService, "getAccountInfo")
        .mockRejectedValue(new Error("Network error"))

      const consoleSpy = jest.spyOn(console, "error").mockImplementation()

      const result = await instagramService.testConnection(mockCredentials)

      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith(
        "❌ Échec de la connexion Instagram:",
        expect.any(Error)
      )
      expect(getAccountInfoSpy).toHaveBeenCalledWith(mockCredentials)

      getAccountInfoSpy.mockRestore()
      consoleSpy.mockRestore()
    })
  })

  describe("getPostMetrics", () => {
    it("devrait récupérer les métriques d'un post", async () => {
      const mockMetrics = {
        data: [
          { name: "engagement", values: [{ value: 150 }] },
          { name: "impressions", values: [{ value: 1000 }] },
          { name: "reach", values: [{ value: 800 }] },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetrics,
      } as Response)

      const result = await instagramService.getPostMetrics(mockCredentials, "post_123")

      expect(result).toEqual(mockMetrics.data)
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("post_123/insights"))
    })

    it("devrait retourner null en cas d'erreur", async () => {
      // Mock fetch pour qu'il lance une erreur
      mockFetch.mockRejectedValueOnce(new Error("API Error"))

      const consoleSpy = jest.spyOn(console, "error").mockImplementation()

      const result = await instagramService.getPostMetrics(mockCredentials, "post_123")

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(
        "Erreur lors de la récupération des métriques:",
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })
})
