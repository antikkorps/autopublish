import cors from "@koa/cors"
import Koa from "koa"
import bodyParser from "koa-bodyparser"
import Router from "koa-router"
import serve from "koa-static"
import path from "path"
import { fileURLToPath } from "url"

// Configuration de la base de données
import sequelize from "./src/config/database.js"

// Import des modèles pour l'initialisation
import "./src/models/Citation.js"
import "./src/models/Post.js"
import "./src/models/User.js"

// Import des routes
import authRoutes from "./src/routes/authRoutes.js"
import citationRoutes from "./src/routes/citationRoutes.js"
import imageRoutes from "./src/routes/imageRoutes.js"
import instagramRoutes from "./src/routes/instagramRoutes.js"
import postRoutes from "./src/routes/postRoutes.js"

// Import des middlewares de sécurité
import { optionalAuthMiddleware } from "./src/middleware/authMiddleware.js"
import { generalRateLimit } from "./src/middleware/rateLimitMiddleware.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = new Koa()
const router = new Router()

// Configuration CORS sécurisée
app.use(
  cors({
    origin: (ctx: any) => {
      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173", // Vite dev
        "https://autopublish.app", // Production (à ajuster)
      ]

      const origin = ctx.request.header.origin
      if (allowedOrigins.includes(origin)) {
        return origin
      }

      // En dev, permettre toutes les origines localhost
      if (process.env.NODE_ENV !== "production" && origin?.includes("localhost")) {
        return origin
      }

      return false
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    credentials: true,
    maxAge: 86400, // 24 heures
  })
)

// Middlewares globaux
app.use(bodyParser())

// Rate limiting global
app.use(generalRateLimit)

// Authentification optionnelle globale (pour enrichir le contexte)
app.use(optionalAuthMiddleware)

// Servir les fichiers statiques (images générées)
app.use(serve(path.join(__dirname, "public")))

// Routes d'API
router.use("/api/auth", authRoutes.routes())
router.use("/api/citations", citationRoutes.routes())
router.use("/api/posts", postRoutes.routes())
router.use("/api/images", imageRoutes.routes())
router.use("/api/instagram", instagramRoutes.routes())

// Route de santé sécurisée
router.get("/api/health", async (ctx: any) => {
  try {
    // Tester la connexion à la base de données
    await sequelize.authenticate()

    const healthInfo: any = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      database: "connected",
      uptime: process.uptime(),
    }

    // Ajouter des infos utilisateur si authentifié
    if (ctx.user) {
      healthInfo.user = {
        id: ctx.user.id,
        role: ctx.user.role,
        rateLimits: ctx.user.rateLimit,
      }
    }

    ctx.body = {
      success: true,
      data: healthInfo,
    }
  } catch (error) {
    console.error("Health check failed:", error)
    ctx.status = 503
    ctx.body = {
      success: false,
      message: "Service unavailable",
      error: "HEALTH_CHECK_FAILED",
    }
  }
})

// Route d'information sur la sécurité
router.get("/api/security", async (ctx: any) => {
  ctx.body = {
    success: true,
    data: {
      authentication: {
        methods: ["JWT", "API Key"],
        tokenExpiry: "15 minutes",
        refreshTokenExpiry: "7 days",
      },
      rateLimiting: {
        enabled: true,
        general: "1000 requests per 15 minutes",
        authentication: "5 attempts per 15 minutes",
        aiGeneration: "20 requests per hour",
        imageGeneration: "50 requests per hour",
      },
      security: {
        cors: "configured",
        headers: "secured",
        https: process.env.NODE_ENV === "production" ? "enforced" : "optional",
      },
    },
  }
})

app.use(router.routes())
app.use(router.allowedMethods())

// Gestionnaire d'erreurs global
app.on("error", (err: any, ctx: any) => {
  console.error("Server error:", err)

  // Log des erreurs d'authentification
  if (err.status === 401 || err.status === 403) {
    console.warn(
      `Auth error - IP: ${ctx.request.ip}, User: ${
        ctx.user?.email || "anonymous"
      }, Path: ${ctx.path}`
    )
  }
})

// Initialisation de la base de données et démarrage du serveur
const PORT = process.env.PORT || 3000

async function startServer() {
  try {
    console.log("🔄 Initialisation de la base de données...")

    // Synchroniser les modèles avec la base de données
    await sequelize.sync({ alter: true })
    console.log("✅ Base de données synchronisée")

    // Créer un utilisateur admin par défaut en développement
    if (process.env.NODE_ENV !== "production") {
      const { default: User } = await import("./src/models/User.js")
      const adminExists = await User.findOne({ where: { role: "admin" } })

      if (!adminExists) {
        await User.create({
          email: "admin@autopublish.local",
          password: "admin123456", // Sera hashé automatiquement
          name: "Admin AutoPublish",
          role: "admin",
          isActive: true,
          rateLimit: {
            daily: 10000,
            hourly: 1000,
          },
        })
        console.log("👤 Utilisateur admin créé: admin@autopublish.local / admin123456")
      }
    }

    app.listen(PORT, () => {
      console.log(`🚀 Serveur AutoPublish démarré sur le port ${PORT}`)
      console.log(`📱 API disponible sur: http://localhost:${PORT}/api`)
      console.log(`🔐 Authentification: http://localhost:${PORT}/api/auth`)
      console.log(`💡 Santé: http://localhost:${PORT}/api/health`)
      console.log(`🛡️  Sécurité: http://localhost:${PORT}/api/security`)

      if (process.env.NODE_ENV !== "production") {
        console.log(
          "\n🔑 Secrets JWT par défaut en développement - Changez-les en production!"
        )
        console.log("Set JWT_ACCESS_SECRET et JWT_REFRESH_SECRET dans votre .env")
      }
    })
  } catch (error) {
    console.error("❌ Erreur lors du démarrage du serveur:", error)
    process.exit(1)
  }
}

startServer()
