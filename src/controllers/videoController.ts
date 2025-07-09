import fs from "fs/promises"
import { Context } from "koa"
import { Op } from "sequelize"
import Citation from "../models/Citation"
import videoService, { CitationData, VideoOptions } from "../services/videoService"
import { PaginationHelper } from "../utils/pagination"

export class VideoController {
  /**
   * Génère une vidéo à partir d'une citation existante
   * POST /api/videos/generate/:citationId
   */
  async generateFromCitation(ctx: Context) {
    try {
      const { citationId } = ctx.params
      const options: VideoOptions = (ctx.request.body as any) || {}

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

      // Préparer les données pour la génération de vidéo
      const citationData: CitationData = {
        content: citation.content,
        author: citation.author || undefined,
        theme: citation.theme,
        hashtags: citation.hashtags,
      }

      // Générer la vidéo
      const generatedVideo = await videoService.generateVideo(citationData, options)

      // Mettre à jour la citation avec le chemin de la vidéo
      await citation.update({
        videoPath: generatedVideo.path,
        videoMetadata: generatedVideo.metadata,
      })

      ctx.status = 201
      ctx.body = {
        success: true,
        message: "Vidéo générée avec succès",
        data: {
          citation: {
            id: citation.id,
            content: citation.content,
            author: citation.author,
            theme: citation.theme,
          },
          video: {
            filename: generatedVideo.filename,
            path: generatedVideo.path,
            metadata: generatedVideo.metadata,
            url: `/videos/generated/${generatedVideo.filename}`, // URL publique
          },
        },
      }
    } catch (error) {
      console.error("Erreur lors de la génération de vidéo:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors de la génération de la vidéo",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }

  /**
   * Génère une vidéo directement à partir de données fournies
   * POST /api/videos/generate
   */
  async generateDirect(ctx: Context) {
    try {
      const body = ctx.request.body as any
      const { citation, options = {} } = body || {}

      if (!citation || !citation.content || !citation.theme) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: "Les champs content et theme sont obligatoires",
        }
        return
      }

      const citationData: CitationData = {
        content: citation.content,
        author: citation.author,
        theme: citation.theme,
        hashtags: citation.hashtags,
      }

      const generatedVideo = await videoService.generateVideo(citationData, options)

      ctx.status = 201
      ctx.body = {
        success: true,
        message: "Vidéo générée avec succès",
        data: {
          video: {
            filename: generatedVideo.filename,
            path: generatedVideo.path,
            metadata: generatedVideo.metadata,
            url: `/videos/generated/${generatedVideo.filename}`,
          },
        },
      }
    } catch (error) {
      console.error("Erreur lors de la génération de vidéo directe:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors de la génération de la vidéo",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }

  /**
   * Génère plusieurs variations d'une vidéo
   * POST /api/videos/variations/:citationId
   */
  async generateVariations(ctx: Context) {
    try {
      const { citationId } = ctx.params
      const body = ctx.request.body as any
      const { options } = body || {}

      const citation = await Citation.findByPk(citationId)
      if (!citation) {
        ctx.status = 404
        ctx.body = {
          success: false,
          message: "Citation non trouvée",
        }
        return
      }

      const citationData: CitationData = {
        content: citation.content,
        author: citation.author || undefined,
        theme: citation.theme,
        hashtags: citation.hashtags,
      }

      const variations = await videoService.generateVariations(citationData, options)

      // Mettre à jour la citation avec les chemins des variations
      const videoPaths = variations.map((v) => v.path)
      await citation.update({
        videoPath: videoPaths[0], // Vidéo principale
        videoMetadata: {
          variations: variations.map((v) => ({
            filename: v.filename,
            path: v.path,
            metadata: v.metadata,
          })),
        },
      })

      ctx.status = 201
      ctx.body = {
        success: true,
        message: `${variations.length} variations de vidéo générées avec succès`,
        data: {
          citation: {
            id: citation.id,
            content: citation.content,
            theme: citation.theme,
          },
          variations: variations.map((v) => ({
            filename: v.filename,
            path: v.path,
            metadata: v.metadata,
            url: `/videos/generated/${v.filename}`,
          })),
        },
      }
    } catch (error) {
      console.error("Erreur lors de la génération des variations de vidéo:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors de la génération des variations de vidéo",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }

  /**
   * Liste toutes les vidéos générées avec pagination
   * GET /api/videos
   */
  async listVideos(ctx: Context) {
    try {
      const paginationParams = PaginationHelper.extractPaginationParams(ctx.query)

      // Récupérer les citations qui ont des vidéos
      const whereClause = {
        videoPath: { [Op.ne]: null },
      }

      const result = await PaginationHelper.paginate(Citation, {
        ...paginationParams,
        where: whereClause,
        attributes: [
          "id",
          "content",
          "author",
          "theme",
          "videoPath",
          "videoMetadata",
          "createdAt",
        ],
        order: [["createdAt", "DESC"]],
      })

      // Transformer les données pour inclure les URLs publiques
      const videosWithUrls = result.data.map((citation: any) => {
        const videoData = citation.toJSON()
        if (videoData.videoPath) {
          const filename = videoData.videoPath.split("/").pop()
          return {
            ...videoData,
            videoUrl: `/videos/generated/${filename}`,
          }
        }
        return videoData
      })

      const links = PaginationHelper.createPaginationLinks(
        ctx.request.URL.toString(),
        result.pagination
      )

      ctx.body = {
        success: true,
        data: videosWithUrls,
        pagination: result.pagination,
        links,
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des vidéos:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors de la récupération des vidéos",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }

  /**
   * Récupère les détails d'une vidéo spécifique
   * GET /api/videos/:citationId
   */
  async getVideo(ctx: Context) {
    try {
      const { citationId } = ctx.params

      const citation = await Citation.findByPk(citationId, {
        attributes: [
          "id",
          "content",
          "author",
          "theme",
          "videoPath",
          "videoMetadata",
          "createdAt",
        ],
      })

      if (!citation || !citation.videoPath) {
        ctx.status = 404
        ctx.body = {
          success: false,
          message: "Vidéo non trouvée",
        }
        return
      }

      const videoData = citation.toJSON()
      const filename = videoData.videoPath!.split("/").pop()

      ctx.body = {
        success: true,
        data: {
          ...videoData,
          videoUrl: `/videos/generated/${filename}`,
        },
      }
    } catch (error) {
      console.error("Erreur lors de la récupération de la vidéo:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors de la récupération de la vidéo",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }

  /**
   * Régénère une vidéo existante avec de nouvelles options
   * PUT /api/videos/regenerate/:citationId
   */
  async regenerateVideo(ctx: Context) {
    try {
      const { citationId } = ctx.params
      const options: VideoOptions = (ctx.request.body as any) || {}

      const citation = await Citation.findByPk(citationId)
      if (!citation) {
        ctx.status = 404
        ctx.body = {
          success: false,
          message: "Citation non trouvée",
        }
        return
      }

      const citationData: CitationData = {
        content: citation.content,
        author: citation.author || undefined,
        theme: citation.theme,
        hashtags: citation.hashtags,
      }

      const generatedVideo = await videoService.generateVideo(citationData, options)

      await citation.update({
        videoPath: generatedVideo.path,
        videoMetadata: generatedVideo.metadata,
      })

      ctx.body = {
        success: true,
        message: "Vidéo régénérée avec succès",
        data: {
          citation: {
            id: citation.id,
            content: citation.content,
            theme: citation.theme,
          },
          video: {
            filename: generatedVideo.filename,
            path: generatedVideo.path,
            metadata: generatedVideo.metadata,
            url: `/videos/generated/${generatedVideo.filename}`,
          },
        },
      }
    } catch (error) {
      console.error("Erreur lors de la régénération de vidéo:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors de la régénération de la vidéo",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }

  /**
   * Supprime une vidéo
   * DELETE /api/videos/:citationId
   */
  async deleteVideo(ctx: Context) {
    try {
      const { citationId } = ctx.params

      const citation = await Citation.findByPk(citationId)
      if (!citation || !citation.videoPath) {
        ctx.status = 404
        ctx.body = {
          success: false,
          message: "Vidéo non trouvée",
        }
        return
      }

      // Supprimer le fichier vidéo
      try {
        await fs.unlink(citation.videoPath)
      } catch (error) {
        console.warn("Impossible de supprimer le fichier vidéo:", error)
      }

      // Mettre à jour la citation
      await citation.update({
        videoPath: null,
        videoMetadata: null,
      })

      ctx.body = {
        success: true,
        message: "Vidéo supprimée avec succès",
      }
    } catch (error) {
      console.error("Erreur lors de la suppression de la vidéo:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors de la suppression de la vidéo",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }
}
