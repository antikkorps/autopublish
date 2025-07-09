import Router from "koa-router"
import { VideoController } from "../controllers/videoController"
import { authMiddleware } from "../middleware/authMiddleware"
import { expensiveRateLimit } from "../middleware/rateLimitMiddleware"

const router = new Router({ prefix: "/api/videos" })
const videoController = new VideoController()

// Middleware d'authentification pour toutes les routes
router.use(authMiddleware)

// Middleware de rate limiting pour la génération de vidéos
router.use("/generate", expensiveRateLimit) // 20 requêtes par heure
router.use("/variations", expensiveRateLimit) // 20 requêtes par heure

// Routes pour la génération de vidéos
router.post("/generate", videoController.generateDirect.bind(videoController))
router.post(
  "/generate/:citationId",
  videoController.generateFromCitation.bind(videoController)
)
router.post(
  "/variations/:citationId",
  videoController.generateVariations.bind(videoController)
)

// Routes pour la gestion des vidéos
router.get("/", videoController.listVideos.bind(videoController))
router.get("/:citationId", videoController.getVideo.bind(videoController))
router.put(
  "/regenerate/:citationId",
  videoController.regenerateVideo.bind(videoController)
)
router.delete("/:citationId", videoController.deleteVideo.bind(videoController))

export default router
