import Router from "koa-router"
import postController from "../controllers/postController"

const router = new Router({ prefix: "/api/posts" })

// Routes pour les posts
router.get("/", postController.getAllPosts)
router.get("/stats", postController.getPostStats)
router.get("/:id", postController.getPostById)

export default router
