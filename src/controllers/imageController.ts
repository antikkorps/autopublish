import { Context } from "koa"
import { Op } from "sequelize"
import Citation from "../models/Citation"
import imageService, {
  CitationData,
  ImageGenerationOptions,
} from "../services/imageService"
import { PaginationHelper } from "../utils/pagination"

export class ImageController {
  /**
   * Génère une image à partir d'une citation existante
   * POST /api/images/generate/:citationId
   */
  async generateFromCitation(ctx: Context) {
    try {
      const { citationId } = ctx.params
      const options: ImageGenerationOptions = (ctx.request.body as any) || {}

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

      // Préparer les données pour la génération d'image
      const citationData: CitationData = {
        content: citation.content,
        author: citation.author || undefined,
        theme: citation.theme,
        hashtags: citation.hashtags,
      }

      // Générer l'image
      const generatedImage = await imageService.generateImage(citationData, options)

      // Mettre à jour la citation avec le chemin de l'image
      await citation.update({
        imagePath: generatedImage.path,
        imageMetadata: generatedImage.metadata,
      })

      ctx.status = 201
      ctx.body = {
        success: true,
        message: "Image générée avec succès",
        data: {
          citation: {
            id: citation.id,
            content: citation.content,
            author: citation.author,
            theme: citation.theme,
          },
          image: {
            filename: generatedImage.filename,
            path: generatedImage.path,
            metadata: generatedImage.metadata,
            url: `/images/generated/${generatedImage.filename}`, // URL publique
          },
        },
      }
    } catch (error) {
      console.error("Erreur lors de la génération d'image:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors de la génération de l'image",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }

  /**
   * Génère une image directement à partir de données fournies
   * POST /api/images/generate
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

      const generatedImage = await imageService.generateImage(citationData, options)

      ctx.status = 201
      ctx.body = {
        success: true,
        message: "Image générée avec succès",
        data: {
          image: {
            filename: generatedImage.filename,
            path: generatedImage.path,
            metadata: generatedImage.metadata,
            url: `/images/generated/${generatedImage.filename}`,
          },
        },
      }
    } catch (error) {
      console.error("Erreur lors de la génération d'image directe:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors de la génération de l'image",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }

  /**
   * Génère plusieurs variations d'une citation
   * POST /api/images/variations/:citationId
   */
  async generateVariations(ctx: Context) {
    try {
      const { citationId } = ctx.params
      const body = ctx.request.body as any
      const { templates } = body || {}

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

      const variations = await imageService.generateVariations(citationData, templates)

      // Mettre à jour la citation avec les chemins des variations
      const imagePaths = variations.map((v) => v.path)
      await citation.update({
        imagePath: imagePaths[0], // Image principale
        imageMetadata: {
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
        message: `${variations.length} variations générées avec succès`,
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
            url: `/images/generated/${v.filename}`,
          })),
        },
      }
    } catch (error) {
      console.error("Erreur lors de la génération des variations:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors de la génération des variations",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }

  /**
   * Liste toutes les images générées avec pagination
   * GET /api/images
   */
  async listImages(ctx: Context) {
    try {
      const paginationParams = PaginationHelper.extractPaginationParams(ctx.query)

      // Récupérer les citations qui ont des images
      const whereClause = {
        imagePath: { [Op.ne]: null },
      }

      const result = await PaginationHelper.paginate(Citation, {
        ...paginationParams,
        where: whereClause,
        attributes: [
          "id",
          "content",
          "author",
          "theme",
          "imagePath",
          "imageMetadata",
          "createdAt",
        ],
        order: [["createdAt", "DESC"]],
      })

      // Transformer les données pour inclure les URLs publiques
      const imagesWithUrls = result.data.map((citation: any) => {
        const imageData = citation.toJSON()
        if (imageData.imagePath) {
          const filename = imageData.imagePath.split("/").pop()
          return {
            ...imageData,
            imageUrl: `/images/generated/${filename}`,
          }
        }
        return imageData
      })

      const links = PaginationHelper.createPaginationLinks(
        ctx.request.URL.toString(),
        result.pagination
      )

      ctx.body = {
        success: true,
        data: imagesWithUrls,
        pagination: result.pagination,
        links,
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des images:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors de la récupération des images",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }

  /**
   * Récupère les détails d'une image spécifique
   * GET /api/images/:citationId
   */
  async getImage(ctx: Context) {
    try {
      const { citationId } = ctx.params

      const citation = await Citation.findByPk(citationId, {
        attributes: [
          "id",
          "content",
          "author",
          "theme",
          "imagePath",
          "imageMetadata",
          "createdAt",
        ],
      })

      if (!citation || !citation.imagePath) {
        ctx.status = 404
        ctx.body = {
          success: false,
          message: "Image non trouvée",
        }
        return
      }

      const imageData = citation.toJSON()
      const filename = imageData.imagePath!.split("/").pop()

      ctx.body = {
        success: true,
        data: {
          ...imageData,
          imageUrl: `/images/generated/${filename}`,
        },
      }
    } catch (error) {
      console.error("Erreur lors de la récupération de l'image:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors de la récupération de l'image",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }

  /**
   * Régénère une image existante avec de nouvelles options
   * PUT /api/images/regenerate/:citationId
   */
  async regenerateImage(ctx: Context) {
    try {
      const { citationId } = ctx.params
      const options: ImageGenerationOptions = (ctx.request.body as any) || {}

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

      const generatedImage = await imageService.generateImage(citationData, options)

      await citation.update({
        imagePath: generatedImage.path,
        imageMetadata: generatedImage.metadata,
      })

      ctx.body = {
        success: true,
        message: "Image régénérée avec succès",
        data: {
          citation: {
            id: citation.id,
            content: citation.content,
            theme: citation.theme,
          },
          image: {
            filename: generatedImage.filename,
            path: generatedImage.path,
            metadata: generatedImage.metadata,
            url: `/images/generated/${generatedImage.filename}`,
          },
        },
      }
    } catch (error) {
      console.error("Erreur lors de la régénération d'image:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors de la régénération de l'image",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }

  /**
   * Supprime une image générée
   * DELETE /api/images/:citationId
   */
  async deleteImage(ctx: Context) {
    try {
      const { citationId } = ctx.params

      const citation = await Citation.findByPk(citationId)
      if (!citation || !citation.imagePath) {
        ctx.status = 404
        ctx.body = {
          success: false,
          message: "Image non trouvée",
        }
        return
      }

      // Supprimer le fichier physique
      try {
        const fs = require("fs").promises
        await fs.unlink(citation.imagePath)
      } catch (fileError) {
        console.warn("Fichier image déjà supprimé ou inaccessible:", fileError)
      }

      // Mettre à jour la base de données
      await citation.update({
        imagePath: undefined,
        imageMetadata: undefined,
      })

      ctx.body = {
        success: true,
        message: "Image supprimée avec succès",
      }
    } catch (error) {
      console.error("Erreur lors de la suppression d'image:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors de la suppression de l'image",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }

  /**
   * Nettoie les anciennes images
   * POST /api/images/cleanup
   */
  async cleanupImages(ctx: Context) {
    try {
      const body = ctx.request.body as any
      const { maxAgeHours = 24 } = body || {}

      const deletedCount = await imageService.cleanupOldImages(maxAgeHours)

      ctx.body = {
        success: true,
        message: `${deletedCount} images supprimées lors du nettoyage`,
        data: {
          deletedCount,
          maxAgeHours,
        },
      }
    } catch (error) {
      console.error("Erreur lors du nettoyage:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors du nettoyage des images",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }

  /**
   * Retourne les statistiques des images générées
   * GET /api/images/stats
   */
  async getStats(ctx: Context) {
    try {
      const totalImagesCount = await Citation.count({
        where: { imagePath: { [Op.not]: null } } as any,
      })

      const imagesByTheme = await Citation.findAll({
        attributes: [
          "theme",
          [Citation.sequelize!.fn("COUNT", Citation.sequelize!.col("id")), "count"],
        ],
        where: { imagePath: { [Op.not]: null } } as any,
        group: ["theme"],
        raw: true,
      })

      const recentImagesCount = await Citation.count({
        where: {
          imagePath: { [Op.not]: null },
          createdAt: {
            [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24h
          },
        } as any,
      })

      ctx.body = {
        success: true,
        data: {
          totalImages: totalImagesCount,
          recentImages24h: recentImagesCount,
          imagesByTheme: imagesByTheme.map((item: any) => ({
            theme: item.theme,
            count: parseInt(item.count),
          })),
          availableTemplates: ["minimal", "gradient", "modern", "elegant"],
        },
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des statistiques:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur lors de la récupération des statistiques",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }
    }
  }
}
