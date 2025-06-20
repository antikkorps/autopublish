import { Context } from "koa"
import Citation from "../models/Citation"
import aiService, { CitationRequest } from "../services/aiService"
import PaginationHelper from "../utils/pagination"

class CitationController {
  // GET /api/citations - Lister toutes les citations
  async getAllCitations(ctx: Context) {
    try {
      // Filtres autorisés
      const allowedFilters = ["theme", "status", "language", "ai_source"]
      const whereClause = PaginationHelper.buildWhereClause(ctx.query, allowedFilters)

      // Options de pagination
      const paginationOptions = {
        defaultLimit: 10,
        maxLimit: 50,
      }

      // Paginer avec Sequelize
      const result = await PaginationHelper.paginate(
        Citation,
        ctx.query,
        {
          where: whereClause,
          order: [["generated_at", "DESC"]],
        },
        paginationOptions
      )

      // Créer les liens de navigation (optionnel)
      const filteredQuery = PaginationHelper.filterQueryParams(ctx.query)
      const links = PaginationHelper.createPaginationLinks(
        `${ctx.protocol}://${ctx.host}/api/citations`,
        result.pagination,
        filteredQuery
      )

      ctx.body = {
        citations: result.data,
        pagination: result.pagination,
        links,
      }
    } catch (error) {
      ctx.status = 500
      ctx.body = {
        error: "Erreur lors de la récupération des citations",
        details: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  // GET /api/citations/:id - Récupérer une citation par ID
  async getCitationById(ctx: Context) {
    try {
      const { id } = ctx.params
      const citation = await Citation.findByPk(id)

      if (!citation) {
        ctx.status = 404
        ctx.body = { error: "Citation non trouvée" }
        return
      }

      ctx.body = { citation }
    } catch (error) {
      ctx.status = 500
      ctx.body = {
        error: "Erreur lors de la récupération de la citation",
        details: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  // POST /api/citations/generate - Générer de nouvelles citations avec l'IA
  async generateCitations(ctx: Context) {
    try {
      const {
        theme,
        language = "fr",
        count = 3,
        style,
        provider = "openai",
      } = ctx.request.body as any

      if (!theme) {
        ctx.status = 400
        ctx.body = { error: "Le thème est requis" }
        return
      }

      // Valider le thème
      const validThemes = [
        "motivation",
        "success",
        "love",
        "life",
        "wisdom",
        "happiness",
        "inspiration",
        "leadership",
        "mindfulness",
        "creativity",
      ]
      if (!validThemes.includes(theme)) {
        ctx.status = 400
        ctx.body = {
          error: `Thème invalide. Thèmes disponibles: ${validThemes.join(", ")}`,
        }
        return
      }

      const request: CitationRequest = {
        theme,
        language,
        count: Math.min(count, 10), // Limiter à 10 citations max
        style,
      }

      // Générer les citations avec l'IA
      const generatedCitations = await aiService.generateCitations(request, provider)

      // Sauvegarder en base de données
      const savedCitations = await Promise.all(
        generatedCitations.map((citation) =>
          Citation.create({
            content: citation.content,
            author: citation.author,
            theme: citation.theme,
            language,
            quality_score: citation.quality_score,
            status: "pending",
            ai_source: provider,
            hashtags: citation.hashtags,
            generated_at: new Date(),
          })
        )
      )

      ctx.body = {
        message: `${savedCitations.length} citations générées avec succès`,
        citations: savedCitations,
      }
    } catch (error) {
      ctx.status = 500
      ctx.body = {
        error: "Erreur lors de la génération des citations",
        details: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  // PUT /api/citations/:id/validate - Valider ou rejeter une citation
  async validateCitation(ctx: Context) {
    try {
      const { id } = ctx.params
      const { status } = ctx.request.body as any

      if (!["approved", "rejected"].includes(status)) {
        ctx.status = 400
        ctx.body = { error: 'Status doit être "approved" ou "rejected"' }
        return
      }

      const citation = await Citation.findByPk(id)
      if (!citation) {
        ctx.status = 404
        ctx.body = { error: "Citation non trouvée" }
        return
      }

      await citation.update({
        status,
        validated_at: new Date(),
      })

      ctx.body = {
        message: `Citation ${status === "approved" ? "approuvée" : "rejetée"}`,
        citation,
      }
    } catch (error) {
      ctx.status = 500
      ctx.body = {
        error: "Erreur lors de la validation",
        details: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  // DELETE /api/citations/:id - Supprimer une citation
  async deleteCitation(ctx: Context) {
    try {
      const { id } = ctx.params
      const citation = await Citation.findByPk(id)

      if (!citation) {
        ctx.status = 404
        ctx.body = { error: "Citation non trouvée" }
        return
      }

      await citation.destroy()
      ctx.body = { message: "Citation supprimée avec succès" }
    } catch (error) {
      ctx.status = 500
      ctx.body = {
        error: "Erreur lors de la suppression",
        details: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  // GET /api/citations/stats - Statistiques des citations
  async getCitationStats(ctx: Context) {
    try {
      const [totalCount, pendingCount, approvedCount, rejectedCount] = await Promise.all([
        Citation.count(),
        Citation.count({ where: { status: "pending" } }),
        Citation.count({ where: { status: "approved" } }),
        Citation.count({ where: { status: "rejected" } }),
      ])

      // Statistiques par thème
      const themeStats = await Citation.findAll({
        attributes: [
          "theme",
          [Citation.sequelize!.fn("COUNT", Citation.sequelize!.col("id")), "count"],
        ],
        group: ["theme"],
        raw: true,
      })

      ctx.body = {
        total: totalCount,
        byStatus: {
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
        },
        byTheme: themeStats,
      }
    } catch (error) {
      ctx.status = 500
      ctx.body = {
        error: "Erreur lors de la récupération des statistiques",
        details: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}

export default new CitationController()
