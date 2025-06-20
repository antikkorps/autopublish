import { Context } from "koa"
import Post from "../models/Post"
import PaginationHelper from "../utils/pagination"

class PostController {
  // GET /api/posts - Lister tous les posts avec pagination
  async getAllPosts(ctx: Context) {
    try {
      // Filtres autorisés pour les posts
      const allowedFilters = ["status", "template_used", "citation_id"]
      const whereClause = PaginationHelper.buildWhereClause(ctx.query, allowedFilters)

      // Options de pagination
      const paginationOptions = {
        defaultLimit: 20,
        maxLimit: 100,
      }

      // Paginer avec Sequelize et inclure la citation associée
      const result = await PaginationHelper.paginate(
        Post,
        ctx.query,
        {
          where: whereClause,
          order: [["scheduled_for", "DESC"]],
          // Optionnel : inclure la citation associée
          // include: [{ model: Citation, as: 'citation' }]
        },
        paginationOptions
      )

      // Créer les liens de navigation
      const filteredQuery = PaginationHelper.filterQueryParams(ctx.query)
      const links = PaginationHelper.createPaginationLinks(
        `${ctx.protocol}://${ctx.host}/api/posts`,
        result.pagination,
        filteredQuery
      )

      ctx.body = {
        posts: result.data,
        pagination: result.pagination,
        links,
      }
    } catch (error) {
      ctx.status = 500
      ctx.body = {
        error: "Erreur lors de la récupération des posts",
        details: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  // GET /api/posts/:id - Récupérer un post par ID
  async getPostById(ctx: Context) {
    try {
      const { id } = ctx.params
      const post = await Post.findByPk(id)

      if (!post) {
        ctx.status = 404
        ctx.body = { error: "Post non trouvé" }
        return
      }

      ctx.body = { post }
    } catch (error) {
      ctx.status = 500
      ctx.body = {
        error: "Erreur lors de la récupération du post",
        details: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  // GET /api/posts/stats - Statistiques des posts
  async getPostStats(ctx: Context) {
    try {
      const [totalCount, scheduledCount, publishedCount, failedCount] = await Promise.all(
        [
          Post.count(),
          Post.count({ where: { status: "scheduled" } }),
          Post.count({ where: { status: "published" } }),
          Post.count({ where: { status: "failed" } }),
        ]
      )

      ctx.body = {
        total: totalCount,
        byStatus: {
          scheduled: scheduledCount,
          published: publishedCount,
          failed: failedCount,
        },
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

export default new PostController()
