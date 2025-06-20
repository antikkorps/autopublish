import PaginationHelper from "../../../src/utils/pagination"

describe("PaginationHelper", () => {
  describe("extractPaginationParams", () => {
    it("devrait extraire les paramètres de pagination par défaut", () => {
      // Arrange
      const query = {}
      const options = {}

      // Act
      const result = PaginationHelper.extractPaginationParams(query, options)

      // Assert
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
      expect(result.offset).toBe(0)
    })

    it("devrait parser les paramètres de pagination fournis", () => {
      // Arrange
      const query = { page: "3", limit: "20" }
      const options = {}

      // Act
      const result = PaginationHelper.extractPaginationParams(query, options)

      // Assert
      expect(result.page).toBe(3)
      expect(result.limit).toBe(20)
      expect(result.offset).toBe(40) // (3-1) * 20
    })

    it("devrait valider et corriger les valeurs invalides", () => {
      // Arrange
      const query = { page: "-1", limit: "invalid" }
      const options = { defaultLimit: 15 }

      // Act
      const result = PaginationHelper.extractPaginationParams(query, options)

      // Assert
      expect(result.page).toBe(1) // Corrigé de -1 à 1
      expect(result.limit).toBe(15) // Corrigé avec defaultLimit
      expect(result.offset).toBe(0)
    })

    it("devrait respecter la limite maximale", () => {
      // Arrange
      const query = { limit: "1000" }
      const options = { maxLimit: 50 }

      // Act
      const result = PaginationHelper.extractPaginationParams(query, options)

      // Assert
      expect(result.limit).toBe(50) // Limité à maxLimit
    })

    it("devrait utiliser les options par défaut personnalisées", () => {
      // Arrange
      const query = {}
      const options = { defaultLimit: 25, maxLimit: 100 }

      // Act
      const result = PaginationHelper.extractPaginationParams(query, options)

      // Assert
      expect(result.limit).toBe(25)
    })
  })

  describe("buildWhereClause", () => {
    it("devrait construire une clause WHERE vide pour des filtres vides", () => {
      // Arrange
      const query = {}
      const allowedFilters = ["theme", "status"]

      // Act
      const result = PaginationHelper.buildWhereClause(query, allowedFilters)

      // Assert
      expect(result).toEqual({})
    })

    it("devrait construire une clause WHERE avec les filtres autorisés", () => {
      // Arrange
      const query = {
        theme: "motivation",
        status: "approved",
        language: "fr",
        unauthorizedField: "hack",
      }
      const allowedFilters = ["theme", "status", "language"]

      // Act
      const result = PaginationHelper.buildWhereClause(query, allowedFilters)

      // Assert
      expect(result).toEqual({
        theme: "motivation",
        status: "approved",
        language: "fr",
      })
      expect(result).not.toHaveProperty("unauthorizedField")
    })

    it("devrait ignorer les valeurs undefined et vides", () => {
      // Arrange
      const query = {
        theme: "motivation",
        status: "",
        language: undefined,
      }
      const allowedFilters = ["theme", "status", "language"]

      // Act
      const result = PaginationHelper.buildWhereClause(query, allowedFilters)

      // Assert
      expect(result).toEqual({ theme: "motivation" })
    })
  })

  describe("filterQueryParams", () => {
    it("devrait filtrer les paramètres de pagination par défaut", () => {
      // Arrange
      const query = {
        page: "2",
        limit: "10",
        theme: "motivation",
        status: "approved",
      }

      // Act
      const result = PaginationHelper.filterQueryParams(query)

      // Assert
      expect(result).toEqual({
        theme: "motivation",
        status: "approved",
      })
      expect(result).not.toHaveProperty("page")
      expect(result).not.toHaveProperty("limit")
    })

    it("devrait filtrer des clés personnalisées", () => {
      // Arrange
      const query = {
        search: "test",
        orderBy: "name",
        internal: "secret",
      }
      const excludeKeys = ["internal", "orderBy"]

      // Act
      const result = PaginationHelper.filterQueryParams(query, excludeKeys)

      // Assert
      expect(result).toEqual({ search: "test" })
    })

    it("devrait ignorer les valeurs undefined et vides", () => {
      // Arrange
      const query = {
        theme: "motivation",
        status: "",
        language: undefined,
        valid: "value",
      }

      // Act
      const result = PaginationHelper.filterQueryParams(query)

      // Assert
      expect(result).toEqual({
        theme: "motivation",
        valid: "value",
      })
    })
  })

  describe("createPaginationLinks", () => {
    const baseUrl = "https://api.example.com/citations"
    const pagination = {
      total: 100,
      page: 3,
      limit: 10,
      totalPages: 10,
      hasNext: true,
      hasPrev: true,
      nextPage: 4,
      prevPage: 2,
    }

    it("devrait créer tous les liens de pagination", () => {
      // Act
      const result = PaginationHelper.createPaginationLinks(baseUrl, pagination)

      // Assert
      expect(result.self).toBe("https://api.example.com/citations?page=3&limit=10")
      expect(result.first).toBe("https://api.example.com/citations?page=1&limit=10")
      expect(result.last).toBe("https://api.example.com/citations?page=10&limit=10")
      expect(result.next).toBe("https://api.example.com/citations?page=4&limit=10")
      expect(result.prev).toBe("https://api.example.com/citations?page=2&limit=10")
    })

    it("devrait inclure les paramètres de query additionnels", () => {
      // Arrange
      const query = { theme: "motivation", status: "approved" }

      // Act
      const result = PaginationHelper.createPaginationLinks(baseUrl, pagination, query)

      // Assert
      expect(result.self).toContain("theme=motivation")
      expect(result.self).toContain("status=approved")
      expect(result.next).toContain("theme=motivation")
    })

    it("devrait retourner null pour next/prev quand approprié", () => {
      // Arrange
      const firstPagePagination = {
        ...pagination,
        page: 1,
        hasPrev: false,
        prevPage: null,
      }

      // Act
      const result = PaginationHelper.createPaginationLinks(baseUrl, firstPagePagination)

      // Assert
      expect(result.prev).toBeNull()
      expect(result.next).not.toBeNull()
    })
  })
})
