import instagramController from "@/controllers/instagramController"
import Citation from "@/models/Citation"
import Post from "@/models/Post"
import instagramService from "@/services/instagramService"
import Koa from "koa"
import bodyParser from "koa-bodyparser"
import Router from "koa-router"
import request from "supertest"

// Mock des modèles
jest.mock("@/models/Citation")
jest.mock("@/models/Post")
jest.mock("@/services/instagramService")

const mockCitation = Citation as jest.Mocked<typeof Citation>
const mockPost = Post as jest.Mocked<typeof Post>
const mockInstagramService = instagramService as jest.Mocked<typeof instagramService>

// Configuration de l'app de test
const app = new Koa()
const router = new Router()

app.use(bodyParser())

// Mock du middleware d'authentification
app.use(async (ctx, next) => {
  ctx.user = { id: 1, email: "test@example.com", role: "admin" }
  await next()
})

// Routes de test
router.get("/test", instagramController.testConnection)
router.get("/limits", instagramController.checkLimits)
router.post("/publish/:citationId", instagramController.publishCitation)
router.get("/metrics/:postId", instagramController.getPostMetrics)
router.get("/posts", instagramController.listPosts)

app.use(router.routes())

describe("InstagramController", () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Mock des variables d'environnement
    process.env.INSTAGRAM_ACCESS_TOKEN = "test_token"
    process.env.INSTAGRAM_ACCOUNT_ID = "test_account"

    // Ajouter les mocks manquants
    mockPost.findAndCountAll = jest.fn()
    mockPost.findOne = jest.fn()
    mockPost.create = jest.fn()
    mockCitation.findByPk = jest.fn()
  })

  afterEach(() => {
    delete process.env.INSTAGRAM_ACCESS_TOKEN
    delete process.env.INSTAGRAM_ACCOUNT_ID
  })

  describe("GET /test", () => {
    it("devrait tester la connexion Instagram avec succès", async () => {
      mockInstagramService.isConfigured.mockReturnValue(true)
      mockInstagramService.testConnection.mockResolvedValue(true)
      mockInstagramService.getAccountInfo.mockResolvedValue({
        username: "test_user",
        name: "Test User",
        account_type: "BUSINESS",
        followers_count: 1000,
        media_count: 50,
      })

      const response = await request(app.callback()).get("/test")

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe("Connexion Instagram réussie")
      expect(response.body.data.account.username).toBe("test_user")
    })

    it("devrait retourner une erreur si Instagram n'est pas configuré", async () => {
      mockInstagramService.isConfigured.mockReturnValue(false)

      const response = await request(app.callback()).get("/test")

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain("Service Instagram non configuré")
    })

    it("devrait gérer les échecs de connexion", async () => {
      mockInstagramService.isConfigured.mockReturnValue(true)
      mockInstagramService.testConnection.mockResolvedValue(false)

      const response = await request(app.callback()).get("/test")

      expect(response.status).toBe(500)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe("Échec de la connexion Instagram")
    })
  })

  describe("GET /limits", () => {
    it("devrait récupérer les limites de publication", async () => {
      mockInstagramService.isConfigured.mockReturnValue(true)
      mockInstagramService.checkPublishingLimits.mockResolvedValue({
        quota_usage: 25,
        config: {
          quota_total: 100,
          quota_duration: 86400,
        },
      })

      const response = await request(app.callback()).get("/limits")

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.quota_usage).toBe(25)
      expect(response.body.data.quota_total).toBe(100)
      expect(response.body.data.quota_remaining).toBe(75)
      expect(response.body.data.quota_duration_hours).toBe(24)
    })

    it("devrait retourner une erreur si Instagram n'est pas configuré", async () => {
      mockInstagramService.isConfigured.mockReturnValue(false)

      const response = await request(app.callback()).get("/limits")

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })

  describe("POST /publish/:citationId", () => {
    const mockCitationData = {
      id: 1,
      content: "Test citation content",
      author: "Test Author",
      theme: "motivation",
      language: "fr",
      imagePath: "/path/to/image.jpg",
      imageMetadata: { template: "minimal" },
      update: jest.fn(),
    }

    const mockPostData = {
      id: 1,
      citation_id: 1,
      update: jest.fn(),
    }

    beforeEach(() => {
      mockInstagramService.isConfigured.mockReturnValue(true)
      mockInstagramService.generateHashtags.mockReturnValue(["motivation", "citation"])
    })

    it("devrait publier une citation avec succès", async () => {
      mockCitation.findByPk.mockResolvedValue(mockCitationData as any)
      mockPost.findOne.mockResolvedValue(null) // Pas de post existant
      mockPost.create.mockResolvedValue(mockPostData as any)

      mockInstagramService.publishImage.mockResolvedValue({
        id: "instagram_post_123",
        permalink: "https://instagram.com/p/test",
        timestamp: "2024-01-01T00:00:00Z",
      })

      const response = await request(app.callback()).post("/publish/1")

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe("Citation publiée avec succès sur Instagram")
      expect(response.body.data.post.instagram_post_id).toBe("instagram_post_123")

      // Vérifier que les modèles ont été mis à jour
      expect(mockPostData.update).toHaveBeenCalledWith({
        instagram_post_id: "instagram_post_123",
        status: "published",
        published_at: expect.any(Date),
      })

      expect(mockCitationData.update).toHaveBeenCalledWith({
        status: "published",
        published_at: expect.any(Date),
      })
    })

    it("devrait retourner une erreur si la citation n'existe pas", async () => {
      mockCitation.findByPk.mockResolvedValue(null)

      const response = await request(app.callback()).post("/publish/999")

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe("Citation non trouvée")
    })

    it("devrait retourner une erreur si la citation n'a pas d'image", async () => {
      mockCitation.findByPk.mockResolvedValue({
        ...mockCitationData,
        imagePath: null,
      } as any)

      const response = await request(app.callback()).post("/publish/1")

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain("Aucune image associée")
    })

    it("devrait retourner une erreur si la citation est déjà publiée", async () => {
      mockCitation.findByPk.mockResolvedValue(mockCitationData as any)
      mockPost.findOne.mockResolvedValue({
        id: 1,
        instagram_post_id: "existing_post_123",
      } as any)

      const response = await request(app.callback()).post("/publish/1")

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain("déjà été publiée")
    })

    it("devrait gérer les erreurs de publication Instagram", async () => {
      mockCitation.findByPk.mockResolvedValue(mockCitationData as any)
      mockPost.findOne.mockResolvedValue(null)

      const mockCreatedPostData = {
        id: 1,
        retry_count: 0,
        update: jest.fn(),
      }
      mockPost.create.mockResolvedValue(mockCreatedPostData as any)

      mockInstagramService.publishImage.mockRejectedValue(
        new Error("Instagram API Error")
      )

      const response = await request(app.callback()).post("/publish/1")

      expect(response.status).toBe(500)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain("Erreur lors de la publication")

      // Vérifier que le post a été marqué comme échoué
      expect(mockCreatedPostData.update).toHaveBeenCalledWith({
        status: "failed",
        error_message: "Instagram API Error",
        retry_count: 1,
      })
    })
  })

  describe("GET /metrics/:postId", () => {
    const mockPostData = {
      id: 1,
      instagram_post_id: "instagram_post_123",
      update: jest.fn(),
    }

    it("devrait récupérer les métriques d'un post", async () => {
      mockPost.findByPk.mockResolvedValue(mockPostData as any)
      mockInstagramService.isConfigured.mockReturnValue(true)

      const mockMetrics = [
        { name: "engagement", values: [{ value: 150 }] },
        { name: "impressions", values: [{ value: 1000 }] },
      ]

      mockInstagramService.getPostMetrics.mockResolvedValue(mockMetrics)

      const response = await request(app.callback()).get("/metrics/1")

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.metrics.engagement).toBe(150)
      expect(response.body.data.metrics.impressions).toBe(1000)

      // Vérifier que les métriques ont été sauvées en base
      expect(mockPostData.update).toHaveBeenCalledWith({
        engagement: { engagement: 150, impressions: 1000 },
      })
    })

    it("devrait retourner une erreur si le post n'existe pas", async () => {
      mockPost.findByPk.mockResolvedValue(null)

      const response = await request(app.callback()).get("/metrics/999")

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain("Post non trouvé")
    })

    it("devrait gérer les métriques non disponibles", async () => {
      mockPost.findByPk.mockResolvedValue(mockPostData as any)
      mockInstagramService.isConfigured.mockReturnValue(true)
      mockInstagramService.getPostMetrics.mockResolvedValue(null)

      const response = await request(app.callback()).get("/metrics/1")

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain("Métriques non disponibles")
      expect(response.body.data.metrics).toBeNull()
    })
  })

  describe("GET /posts", () => {
    it("devrait lister les posts Instagram", async () => {
      const mockPosts = [
        {
          id: 1,
          instagram_post_id: "post_123",
          status: "published",
          published_at: new Date(),
          caption: "Test caption",
          hashtags: ["test", "citation"],
          engagement: { likes: 100 },
          Citation: {
            id: 1,
            content: "Test content",
            author: "Test Author",
            theme: "motivation",
            quality_score: 0.8,
          },
        },
        {
          id: 2,
          instagram_post_id: "post_456",
          status: "published",
          published_at: new Date(),
          caption: "Another caption",
          hashtags: ["motivation"],
          engagement: { likes: 50 },
          Citation: {
            id: 2,
            content: "Another content",
            author: "Another Author",
            theme: "wisdom",
            quality_score: 0.9,
          },
        },
      ]

      mockPost.findAndCountAll.mockResolvedValue({
        count: 2,
        rows: mockPosts,
      } as any)

      const response = await request(app.callback()).get("/posts")

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.posts).toHaveLength(2)
      expect(response.body.data.pagination.total_items).toBe(2)
      expect(response.body.data.pagination.current_page).toBe(1)
      expect(response.body.data.pagination.total_pages).toBe(1)
    })

    it("devrait supporter la pagination", async () => {
      mockPost.findAndCountAll.mockResolvedValue({
        count: 25,
        rows: [],
      } as any)

      const response = await request(app.callback())
        .get("/posts")
        .query({ page: 2, limit: 5 })

      expect(response.status).toBe(200)
      expect(response.body.data.pagination.current_page).toBe(2)
      expect(response.body.data.pagination.total_pages).toBe(5)
      expect(response.body.data.pagination.items_per_page).toBe(5)

      // Vérifier que la requête a été faite avec les bons paramètres
      expect(mockPost.findAndCountAll).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Array),
        order: [["published_at", "DESC"]],
        limit: 5,
        offset: 5, // (page 2 - 1) * limit 5
      })
    })

    it("devrait supporter le filtrage par statut", async () => {
      mockPost.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [],
      } as any)

      const response = await request(app.callback())
        .get("/posts")
        .query({ status: "published" })

      expect(response.status).toBe(200)

      // Vérifier que le filtre a été appliqué
      expect(mockPost.findAndCountAll).toHaveBeenCalledWith({
        where: { status: "published" },
        include: expect.any(Array),
        order: [["published_at", "DESC"]],
        limit: 10,
        offset: 0,
      })
    })

    it("devrait gérer les erreurs de base de données", async () => {
      mockPost.findAndCountAll.mockRejectedValue(new Error("Database error"))

      const response = await request(app.callback()).get("/posts")

      expect(response.status).toBe(500)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain("Erreur lors de la récupération")
    })
  })

  describe("Configuration Instagram manquante", () => {
    beforeEach(() => {
      delete process.env.INSTAGRAM_ACCESS_TOKEN
      delete process.env.INSTAGRAM_ACCOUNT_ID
    })

    it("devrait retourner une erreur pour toutes les routes nécessitant Instagram", async () => {
      mockInstagramService.isConfigured.mockReturnValue(false)

      const routes = [
        { method: "get", path: "/test" },
        { method: "get", path: "/limits" },
        { method: "post", path: "/publish/1" },
        { method: "get", path: "/metrics/1" },
      ]

      for (const route of routes) {
        const agent = request(app.callback())
        const response =
          route.method === "get"
            ? await agent.get(route.path)
            : await agent.post(route.path)

        expect(response.status).toBe(400)
        expect(response.body.success).toBe(false)
        expect(response.body.message).toContain("Service Instagram non configuré")
      }
    })
  })
})
