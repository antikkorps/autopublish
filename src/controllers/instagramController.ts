import { Context } from "koa"
import Citation from "../models/Citation"
import Post from "../models/Post"
import instagramService, { InstagramCredentials } from "../services/instagramService"

export class InstagramController {
  /**
   * Teste la connexion Instagram
   * GET /api/instagram/test
   */
  async testConnection(ctx: Context) {
    try {
      if (!instagramService.isConfigured()) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message:
            "Service Instagram non configuré. Vérifiez vos variables d'environnement.",
        }
        return
      }

      const credentials: InstagramCredentials = {
        accessToken: process.env.INSTAGRAM_ACCESS_TOKEN!,
        accountId: process.env.INSTAGRAM_ACCOUNT_ID!,
      }

      const isConnected = await instagramService.testConnection(credentials)

      if (isConnected) {
        const accountInfo = await instagramService.getAccountInfo(credentials)
        ctx.body = {
          success: true,
          message: "Connexion Instagram réussie",
          data: {
            account: {
              username: accountInfo.username,
              name: accountInfo.name,
              account_type: accountInfo.account_type,
              followers_count: accountInfo.followers_count,
              media_count: accountInfo.media_count,
            },
          },
        }
      } else {
        ctx.status = 500
        ctx.body = {
          success: false,
          message: "Échec de la connexion Instagram",
        }
      }
    } catch (error) {
      console.error("Erreur lors du test de connexion Instagram:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors du test de connexion",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }

  /**
   * Vérifie les limites de publication Instagram
   * GET /api/instagram/limits
   */
  async checkLimits(ctx: Context) {
    try {
      if (!instagramService.isConfigured()) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: "Service Instagram non configuré",
        }
        return
      }

      const credentials: InstagramCredentials = {
        accessToken: process.env.INSTAGRAM_ACCESS_TOKEN!,
        accountId: process.env.INSTAGRAM_ACCOUNT_ID!,
      }

      const limits = await instagramService.checkPublishingLimits(credentials)

      ctx.body = {
        success: true,
        data: {
          quota_usage: limits.quota_usage,
          quota_total: limits.config.quota_total,
          quota_remaining: limits.config.quota_total - limits.quota_usage,
          quota_duration_hours: limits.config.quota_duration / 3600,
        },
      }
    } catch (error) {
      console.error("Erreur lors de la vérification des limites:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors de la vérification des limites",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }

  /**
   * Publie une citation sur Instagram
   * POST /api/instagram/publish/:citationId
   */
  async publishCitation(ctx: Context) {
    try {
      const { citationId } = ctx.params

      if (!instagramService.isConfigured()) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: "Service Instagram non configuré",
        }
        return
      }

      // Récupérer la citation
      const citation = await Citation.findByPk(citationId)
      if (!citation) {
        ctx.status = 404
        ctx.body = {
          success: false,
          message: "Citation non trouvée",
        }
        return
      }

      // Vérifier qu'une image est disponible
      if (!citation.imagePath) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: "Aucune image associée à cette citation. Générez d'abord une image.",
        }
        return
      }

      // Vérifier si la citation n'est pas déjà publiée
      const existingPost = await Post.findOne({
        where: {
          citation_id: citation.id,
          status: "published",
        },
      })

      if (existingPost) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: "Cette citation a déjà été publiée sur Instagram",
          data: {
            post_id: existingPost.id,
            instagram_post_id: existingPost.instagram_post_id,
          },
        }
        return
      }

      const credentials: InstagramCredentials = {
        accessToken: process.env.INSTAGRAM_ACCESS_TOKEN!,
        accountId: process.env.INSTAGRAM_ACCOUNT_ID!,
      }

      // Générer des hashtags automatiques
      const hashtags = instagramService.generateHashtags(
        citation.theme,
        citation.language
      )

      // Préparer la légende
      let caption = citation.content
      if (citation.author) {
        caption += `\n\n— ${citation.author}`
      }

      // Créer le post en base avec statut "scheduled"
      const post = await Post.create({
        citation_id: citation.id,
        image_url: `/images/generated/${citation.imagePath?.split("/").pop()}`,
        image_path: citation.imagePath,
        template_used: (citation.imageMetadata as any)?.template || "minimal",
        status: "scheduled",
        scheduled_for: new Date(),
        caption: caption,
        hashtags: hashtags,
        retry_count: 0,
      })

      try {
        // Publier sur Instagram
        const result = await instagramService.publishImage(credentials, {
          caption: caption,
          imagePath: citation.imagePath,
          hashtags: hashtags,
        })

        // Mettre à jour le post avec les informations Instagram
        await post.update({
          instagram_post_id: result.id,
          status: "published",
          published_at: new Date(),
        })

        // Mettre à jour la citation
        await citation.update({
          status: "published",
          published_at: new Date(),
        })

        ctx.status = 201
        ctx.body = {
          success: true,
          message: "Citation publiée avec succès sur Instagram",
          data: {
            post: {
              id: post.id,
              instagram_post_id: result.id,
              permalink: result.permalink,
              caption: caption,
              hashtags: hashtags,
              published_at: result.timestamp,
            },
            citation: {
              id: citation.id,
              content: citation.content,
              author: citation.author,
              theme: citation.theme,
            },
          },
        }
      } catch (publishError) {
        // Mettre à jour le post avec l'erreur
        await post.update({
          status: "failed",
          error_message:
            publishError instanceof Error ? publishError.message : "Erreur inconnue",
          retry_count: post.retry_count + 1,
        })

        throw publishError
      }
    } catch (error) {
      console.error("Erreur lors de la publication Instagram:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors de la publication sur Instagram",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }

  /**
   * Récupère les métriques d'un post Instagram
   * GET /api/instagram/metrics/:postId
   */
  async getPostMetrics(ctx: Context) {
    try {
      const { postId } = ctx.params

      // Récupérer le post en base
      const post = await Post.findByPk(postId)
      if (!post || !post.instagram_post_id) {
        ctx.status = 404
        ctx.body = {
          success: false,
          message: "Post non trouvé ou non publié sur Instagram",
        }
        return
      }

      if (!instagramService.isConfigured()) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: "Service Instagram non configuré",
        }
        return
      }

      const credentials: InstagramCredentials = {
        accessToken: process.env.INSTAGRAM_ACCESS_TOKEN!,
        accountId: process.env.INSTAGRAM_ACCOUNT_ID!,
      }

      // Récupérer les métriques depuis Instagram
      const metrics = await instagramService.getPostMetrics(
        credentials,
        post.instagram_post_id
      )

      if (metrics) {
        // Convertir les métriques en format plus lisible
        const formattedMetrics = metrics.reduce((acc: any, metric: any) => {
          acc[metric.name] = metric.values[0]?.value || 0
          return acc
        }, {})

        // Mettre à jour les métriques en base
        await post.update({
          engagement: formattedMetrics,
        })

        ctx.body = {
          success: true,
          data: {
            post_id: post.id,
            instagram_post_id: post.instagram_post_id,
            metrics: formattedMetrics,
            last_updated: new Date().toISOString(),
          },
        }
      } else {
        ctx.body = {
          success: true,
          message: "Métriques non disponibles pour ce post",
          data: {
            post_id: post.id,
            instagram_post_id: post.instagram_post_id,
            metrics: null,
          },
        }
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des métriques:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors de la récupération des métriques",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }

  /**
   * Liste les posts Instagram publiés
   * GET /api/instagram/posts
   */
  async listPosts(ctx: Context) {
    try {
      const { page = 1, limit = 10, status } = ctx.query

      const whereClause: any = {}
      if (status) {
        whereClause.status = status
      }

      const offset = (Number(page) - 1) * Number(limit)

      const { count, rows: posts } = await Post.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Citation,
            attributes: ["id", "content", "author", "theme", "quality_score"],
          },
        ],
        order: [["published_at", "DESC"]],
        limit: Number(limit),
        offset: offset,
      })

      ctx.body = {
        success: true,
        data: {
          posts: posts.map((post) => ({
            id: post.id,
            instagram_post_id: post.instagram_post_id,
            status: post.status,
            published_at: post.published_at,
            caption: post.caption,
            hashtags: post.hashtags,
            engagement: post.engagement,
            citation: (post as any).Citation,
          })),
          pagination: {
            current_page: Number(page),
            total_pages: Math.ceil(count / Number(limit)),
            total_items: count,
            items_per_page: Number(limit),
          },
        },
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des posts:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors de la récupération des posts",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }
}

export default new InstagramController()
