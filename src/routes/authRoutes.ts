import Router from "koa-router"
import { AuthController } from "../controllers/authController"
import { authMiddleware, optionalAuthMiddleware } from "../middleware/authMiddleware"
import { authRateLimit, generalRateLimit } from "../middleware/rateLimitMiddleware"

const router = new Router({ prefix: "/auth" })
const authController = new AuthController()

// Routes publiques avec rate limiting strict
router.post("/register", authRateLimit, authController.register.bind(authController))
router.post("/login", authRateLimit, authController.login.bind(authController))
router.post(
  "/refresh",
  generalRateLimit,
  authController.refreshToken.bind(authController)
)

// Routes publiques avec auth optionnelle
router.get(
  "/status",
  optionalAuthMiddleware,
  authController.getAuthStatus.bind(authController)
)

// Routes protégées
router.post("/logout", authMiddleware, authController.logout.bind(authController))
router.get("/profile", authMiddleware, authController.getProfile.bind(authController))
router.put("/profile", authMiddleware, authController.updateProfile.bind(authController))
router.put(
  "/password",
  authMiddleware,
  authController.changePassword.bind(authController)
)

// Gestion des API Keys
router.post(
  "/api-key",
  authMiddleware,
  authController.generateApiKey.bind(authController)
)
router.delete(
  "/api-key",
  authMiddleware,
  authController.revokeApiKey.bind(authController)
)

export default router
