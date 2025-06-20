import Router from "koa-router"
import { ImageController } from "../controllers/imageController"
import {
  flexibleAuthMiddleware,
  optionalAuthMiddleware,
  requireAdmin,
} from "../middleware/authMiddleware"
import {
  generalRateLimit,
  imageGenerationRateLimit,
  intelligentRateLimit,
} from "../middleware/rateLimitMiddleware"

const router = new Router({ prefix: "/images" })
const imageController = new ImageController()

// Routes publiques (avec auth optionnelle pour des limites plus élevées)
router.get(
  "/",
  optionalAuthMiddleware,
  intelligentRateLimit,
  imageController.listImages.bind(imageController)
)
router.get("/stats", generalRateLimit, imageController.getStats.bind(imageController))
router.get(
  "/:citationId",
  generalRateLimit,
  imageController.getImage.bind(imageController)
)

// Génération d'images - AUTHENTIFICATION REQUISE + Rate limiting strict
router.post(
  "/generate/:citationId",
  flexibleAuthMiddleware,
  imageGenerationRateLimit,
  imageController.generateFromCitation.bind(imageController)
)
router.post(
  "/generate",
  flexibleAuthMiddleware,
  imageGenerationRateLimit,
  imageController.generateDirect.bind(imageController)
)
router.post(
  "/variations/:citationId",
  flexibleAuthMiddleware,
  imageGenerationRateLimit,
  imageController.generateVariations.bind(imageController)
)

// Modifications d'images - AUTHENTIFICATION REQUISE
router.put(
  "/regenerate/:citationId",
  flexibleAuthMiddleware,
  imageGenerationRateLimit,
  imageController.regenerateImage.bind(imageController)
)
router.delete(
  "/:citationId",
  flexibleAuthMiddleware,
  imageController.deleteImage.bind(imageController)
)

// Maintenance - ADMIN SEULEMENT
router.post(
  "/cleanup",
  flexibleAuthMiddleware,
  requireAdmin,
  imageController.cleanupImages.bind(imageController)
)

export default router
