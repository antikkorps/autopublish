import Router from "koa-router"
import citationController from "../controllers/citationController"
import {
  flexibleAuthMiddleware,
  optionalAuthMiddleware,
  requireAdmin,
} from "../middleware/authMiddleware"
import {
  expensiveRateLimit,
  generalRateLimit,
  intelligentRateLimit,
} from "../middleware/rateLimitMiddleware"

const router = new Router({ prefix: "/api/citations" })

// Routes publiques (avec auth optionnelle pour des limites plus élevées)
router.get(
  "/",
  optionalAuthMiddleware,
  intelligentRateLimit,
  citationController.getAllCitations
)
router.get("/stats", generalRateLimit, citationController.getCitationStats)
router.get("/:id", generalRateLimit, citationController.getCitationById)

// Génération de citations avec l'IA - AUTHENTIFICATION REQUISE + Rate limiting strict
router.post(
  "/generate",
  flexibleAuthMiddleware,
  expensiveRateLimit,
  citationController.generateCitations
)

// Gestion des citations - AUTHENTIFICATION REQUISE
router.put("/:id/validate", flexibleAuthMiddleware, citationController.validateCitation)
router.delete(
  "/:id",
  flexibleAuthMiddleware,
  requireAdmin,
  citationController.deleteCitation
)

export default router
