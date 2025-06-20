import {
  DailyGenerationService,
  DEFAULT_CONFIG,
} from "../../../src/services/dailyGenerationService"

// Mock des services externes
jest.mock("../../../src/config/database", () => ({
  authenticate: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../../../src/models/Citation", () => ({
  create: jest.fn(),
  destroy: jest.fn(),
  count: jest.fn(),
}))

jest.mock("../../../src/services/aiService", () => ({
  generateCitations: jest.fn(),
}))

jest.mock("../../../src/services/imageService", () => ({
  generateVariations: jest.fn(),
}))

import sequelize from "../../../src/config/database"
import Citation from "../../../src/models/Citation"
import aiService from "../../../src/services/aiService"
import imageService from "../../../src/services/imageService"

// Configuration de test
const TEST_CONFIG = {
  totalCitations: 2,
  themes: {
    motivation: { count: 1, style: "motivational" as const },
    wisdom: { count: 1, style: "philosophical" as const },
  },
  language: "fr",
  minQualityScore: 0.6,
  generateImages: false,
}

// Helper pour créer des citations mock
const createMockCitation = (overrides: any = {}) => ({
  content: "Citation de test",
  author: "Auteur Test",
  theme: "motivation",
  quality_score: 0.8,
  hashtags: ["#test"],
  ...overrides,
})

// Helper pour créer des variations d'images mock
const createMockImageVariation = (overrides: any = {}) => ({
  path: "/path/to/image.png",
  metadata: {
    width: 1080,
    height: 1080,
    template: "modern",
    theme: "motivation",
    format: "png",
    ...overrides.metadata,
  },
  ...overrides,
})

describe("DailyGenerationService - Tests Unitaires", () => {
  let service: DailyGenerationService
  let mockCitation: any
  let mockAiService: jest.Mocked<typeof aiService>
  let mockImageService: jest.Mocked<typeof imageService>
  let mockCitationModel: jest.Mocked<typeof Citation>

  beforeEach(() => {
    service = new DailyGenerationService(TEST_CONFIG)

    // Réinitialiser tous les mocks
    jest.clearAllMocks()

    // Configuration des mocks
    mockAiService = aiService as jest.Mocked<typeof aiService>
    mockImageService = imageService as jest.Mocked<typeof imageService>
    mockCitationModel = Citation as jest.Mocked<typeof Citation>

    // Mock d'une citation créée en base
    mockCitation = {
      id: 1,
      content: "Citation de test",
      theme: "motivation",
      quality_score: 0.8,
      save: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
    }

    // Réinitialiser le mock de sequelize pour chaque test
    const mockSequelize = sequelize as jest.Mocked<typeof sequelize>
    mockSequelize.authenticate.mockResolvedValue(undefined)

    // Mock console pour éviter les logs pendant les tests
    jest.spyOn(console, "log").mockImplementation()
    jest.spyOn(console, "error").mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("Configuration et Initialisation", () => {
    test("devrait créer une instance avec la configuration par défaut", () => {
      const defaultService = new DailyGenerationService()
      expect(defaultService).toBeDefined()
      expect(defaultService.getConfig()).toEqual(DEFAULT_CONFIG)
    })

    test("devrait créer une instance avec une configuration personnalisée", () => {
      const config = service.getConfig()
      expect(config.totalCitations).toBe(2)
      expect(config.themes.motivation.count).toBe(1)
      expect(config.themes.wisdom.count).toBe(1)
    })

    test("devrait initialiser les statistiques à zéro", () => {
      const stats = service.getStats()
      expect(stats.generated).toBe(0)
      expect(stats.saved).toBe(0)
      expect(stats.failed).toBe(0)
      expect(stats.withImages).toBe(0)
    })

    test("devrait valider la configuration par défaut", () => {
      expect(DEFAULT_CONFIG.totalCitations).toBeGreaterThan(0)
      expect(DEFAULT_CONFIG.themes).toBeDefined()
      expect(DEFAULT_CONFIG.language).toBe("fr")
      expect(DEFAULT_CONFIG.minQualityScore).toBeGreaterThanOrEqual(0)
      expect(DEFAULT_CONFIG.minQualityScore).toBeLessThanOrEqual(1)
    })
  })

  describe("Génération Réussie", () => {
    beforeEach(() => {
      // Mock de citations générées par l'IA - 1 citation par appel
      mockAiService.generateCitations
        .mockResolvedValueOnce([
          createMockCitation({
            content: "Citation motivation test",
            author: "Test Author",
            theme: "motivation",
            quality_score: 0.8,
            hashtags: ["#motivation", "#test"],
          }),
        ])
        .mockResolvedValueOnce([
          createMockCitation({
            content: "Citation wisdom test",
            author: "Wise Author",
            theme: "wisdom",
            quality_score: 0.7,
            hashtags: ["#wisdom", "#test"],
          }),
        ])

      // Mock de création de citation en base
      mockCitationModel.create.mockResolvedValue(mockCitation)
    })

    test("devrait générer des citations avec succès", async () => {
      const stats = await service.generate()

      expect(stats.generated).toBe(2) // 2 citations générées au total
      expect(stats.saved).toBe(2) // 2 citations sauvées
      expect(stats.failed).toBe(0) // Aucun échec
      expect(stats.withImages).toBe(0) // Pas d'images configurées
    })

    test("devrait appeler l'IA pour chaque thème", async () => {
      await service.generate()

      expect(mockAiService.generateCitations).toHaveBeenCalledTimes(2)
      expect(mockAiService.generateCitations).toHaveBeenCalledWith({
        theme: "motivation",
        language: "fr",
        count: 1,
        style: "motivational",
      })
      expect(mockAiService.generateCitations).toHaveBeenCalledWith({
        theme: "wisdom",
        language: "fr",
        count: 1,
        style: "philosophical",
      })
    })

    test("devrait sauvegarder les citations en base", async () => {
      await service.generate()

      expect(mockCitationModel.create).toHaveBeenCalledTimes(2)
      expect(mockCitationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Citation motivation test",
          theme: "motivation",
          language: "fr",
          quality_score: 0.8,
          status: "approved",
        })
      )
    })
  })

  describe("Filtrage par Qualité", () => {
    test("devrait filtrer les citations de faible qualité", async () => {
      // Mock avec citations de qualité variable
      mockAiService.generateCitations.mockResolvedValue([
        createMockCitation({ content: "Bonne citation", quality_score: 0.8 }),
        createMockCitation({ content: "Citation moyenne", quality_score: 0.5 }), // En dessous du seuil
        createMockCitation({ content: "Excellente citation", quality_score: 0.9 }),
      ])

      mockCitationModel.create.mockResolvedValue(mockCitation)

      const stats = await service.generate()

      expect(stats.generated).toBe(6) // 3 citations × 2 thèmes
      expect(stats.saved).toBe(4) // Seulement celles > 0.6
      expect(mockCitationModel.create).toHaveBeenCalledTimes(4)
    })

    test("devrait gérer le cas où aucune citation ne passe le filtre", async () => {
      mockAiService.generateCitations.mockResolvedValue([
        createMockCitation({ content: "Citation faible", quality_score: 0.3 }),
        createMockCitation({ content: "Autre citation faible", quality_score: 0.4 }),
      ])

      const stats = await service.generate()

      expect(stats.generated).toBe(4) // 2 citations × 2 thèmes
      expect(stats.saved).toBe(0) // Aucune ne passe le filtre
      expect(mockCitationModel.create).not.toHaveBeenCalled()
    })
  })

  describe("Génération d'Images", () => {
    beforeEach(() => {
      // Activer la génération d'images
      service = new DailyGenerationService({
        ...TEST_CONFIG,
        generateImages: true,
      })

      mockAiService.generateCitations.mockResolvedValue([
        createMockCitation({ content: "Citation avec image", quality_score: 0.8 }),
      ])

      mockImageService.generateVariations.mockResolvedValue([
        createMockImageVariation({ path: "/path/to/image1.png" }),
        createMockImageVariation({
          path: "/path/to/image2.png",
          metadata: { template: "classic" },
        }),
      ])

      mockCitationModel.create.mockResolvedValue(mockCitation)
    })

    test("devrait générer des images quand configuré", async () => {
      const stats = await service.generate()

      expect(mockImageService.generateVariations).toHaveBeenCalledTimes(2)
      expect(stats.withImages).toBe(2)
      expect(mockCitation.save).toHaveBeenCalledTimes(2)
    })

    test("devrait gérer les erreurs d'images sans faire échouer le processus", async () => {
      mockImageService.generateVariations.mockRejectedValue(new Error("Erreur image"))

      const stats = await service.generate()

      expect(stats.saved).toBe(2) // Les citations sont quand même sauvées
      expect(stats.withImages).toBe(0) // Mais pas d'images
    })
  })

  describe("Gestion d'Erreurs", () => {
    test("devrait gérer les erreurs de l'IA", async () => {
      mockAiService.generateCitations.mockRejectedValue(new Error("Erreur API"))

      const stats = await service.generate()

      expect(stats.generated).toBe(0)
      expect(stats.saved).toBe(0)
      expect(stats.failed).toBe(2) // 2 thèmes échoués
    })

    test("devrait gérer les erreurs de base de données", async () => {
      mockAiService.generateCitations.mockResolvedValue([
        createMockCitation({ content: "Citation test", quality_score: 0.8 }),
      ])

      mockCitationModel.create.mockRejectedValue(new Error("Erreur DB"))

      const stats = await service.generate()

      expect(stats.generated).toBe(2)
      expect(stats.saved).toBe(0) // Aucune sauvée à cause de l'erreur
      expect(stats.failed).toBe(2) // 2 échecs de sauvegarde
    })

    test("devrait gérer les erreurs de connexion à la base", async () => {
      const mockSequelize = sequelize as jest.Mocked<typeof sequelize>
      mockSequelize.authenticate.mockRejectedValue(new Error("Connexion échouée"))

      await expect(service.generate()).rejects.toThrow("Connexion échouée")
    })
  })

  describe("Configurations Limites", () => {
    test("devrait gérer une configuration avec 0 citations", async () => {
      const emptyService = new DailyGenerationService({
        totalCitations: 0,
        themes: {},
        language: "fr",
        minQualityScore: 0.6,
        generateImages: false,
      })

      const stats = await emptyService.generate()

      expect(stats.generated).toBe(0)
      expect(stats.saved).toBe(0)
      expect(stats.failed).toBe(0)
      expect(mockAiService.generateCitations).not.toHaveBeenCalled()
    })

    test("devrait gérer un score de qualité minimum de 0", async () => {
      const lowQualityService = new DailyGenerationService({
        ...TEST_CONFIG,
        minQualityScore: 0,
      })

      mockAiService.generateCitations.mockResolvedValue([
        createMockCitation({ content: "Citation très faible", quality_score: 0.1 }),
      ])

      mockCitationModel.create.mockResolvedValue(mockCitation)

      const stats = await lowQualityService.generate()

      expect(stats.saved).toBe(2) // Toutes les citations passent
    })

    test("devrait gérer un score de qualité minimum de 1", async () => {
      const highQualityService = new DailyGenerationService({
        ...TEST_CONFIG,
        minQualityScore: 1,
      })

      mockAiService.generateCitations.mockResolvedValue([
        createMockCitation({ content: "Citation parfaite", quality_score: 1.0 }),
        createMockCitation({ content: "Citation presque parfaite", quality_score: 0.99 }),
      ])

      mockCitationModel.create.mockResolvedValue(mockCitation)

      const stats = await highQualityService.generate()

      expect(stats.saved).toBe(2) // Seulement les citations parfaites (1.0)
    })
  })
})
