import Router from "koa-router"
import instagramController from "../controllers/instagramController"
import { authMiddleware } from "../middleware/authMiddleware"

const router = new Router()

// Toutes les routes Instagram nécessitent une authentification
router.use(authMiddleware)

// Test de connexion Instagram
router.get("/test", instagramController.testConnection)

// Vérification des limites de publication
router.get("/limits", instagramController.checkLimits)

// Publication d'une citation sur Instagram
router.post("/publish/:citationId", instagramController.publishCitation)

// Récupération des métriques d'un post
router.get("/metrics/:postId", instagramController.getPostMetrics)

// Liste des posts Instagram
router.get("/posts", instagramController.listPosts)

export default router
