import { Context, Next } from "koa"
import User from "../models/User"
import authService from "../services/authService"

// Étendre le contexte Koa pour inclure l'utilisateur
declare module "koa" {
  interface Context {
    user?: User
    isAuthenticated?: boolean
  }
}

export interface AuthenticatedContext extends Context {
  user: User
  isAuthenticated: true
}

/**
 * Middleware d'authentification JWT
 */
export const authMiddleware = async (ctx: Context, next: Next) => {
  try {
    const authHeader = ctx.headers.authorization
    const token = authService.extractTokenFromHeader(authHeader)

    if (!token) {
      ctx.status = 401
      ctx.body = {
        success: false,
        message: "Token d'authentification requis",
        error: "MISSING_TOKEN",
      }
      return
    }

    const decoded = authService.verifyAccessToken(token)
    if (!decoded) {
      ctx.status = 401
      ctx.body = {
        success: false,
        message: "Token invalide ou expiré",
        error: "INVALID_TOKEN",
      }
      return
    }

    // Charger l'utilisateur complet
    const user = await User.findByPk(decoded.userId)
    if (!user || !user.isActive) {
      ctx.status = 401
      ctx.body = {
        success: false,
        message: "Utilisateur non trouvé ou inactif",
        error: "USER_NOT_FOUND",
      }
      return
    }

    ctx.user = user
    ctx.isAuthenticated = true
    await next()
  } catch (error) {
    console.error("Erreur dans authMiddleware:", error)
    ctx.status = 500
    ctx.body = {
      success: false,
      message: "Erreur d'authentification",
      error: "AUTH_ERROR",
    }
  }
}

/**
 * Middleware d'authentification optionnelle (ne bloque pas si pas de token)
 */
export const optionalAuthMiddleware = async (ctx: Context, next: Next) => {
  try {
    const authHeader = ctx.headers.authorization
    const token = authService.extractTokenFromHeader(authHeader)

    if (token) {
      const decoded = authService.verifyAccessToken(token)
      if (decoded) {
        const user = await User.findByPk(decoded.userId)
        if (user && user.isActive) {
          ctx.user = user
          ctx.isAuthenticated = true
        }
      }
    }

    await next()
  } catch (error) {
    console.error("Erreur dans optionalAuthMiddleware:", error)
    await next()
  }
}

/**
 * Middleware d'authentification par API Key
 */
export const apiKeyMiddleware = async (ctx: Context, next: Next) => {
  try {
    const apiKey = ctx.headers["x-api-key"] as string

    if (!apiKey) {
      ctx.status = 401
      ctx.body = {
        success: false,
        message: "API Key requise",
        error: "MISSING_API_KEY",
      }
      return
    }

    const user = await authService.authenticateWithApiKey(apiKey)
    if (!user) {
      ctx.status = 401
      ctx.body = {
        success: false,
        message: "API Key invalide",
        error: "INVALID_API_KEY",
      }
      return
    }

    ctx.user = user
    ctx.isAuthenticated = true
    await next()
  } catch (error) {
    console.error("Erreur dans apiKeyMiddleware:", error)
    ctx.status = 500
    ctx.body = {
      success: false,
      message: "Erreur d'authentification API Key",
      error: "API_KEY_ERROR",
    }
  }
}

/**
 * Middleware d'authentification flexible (JWT ou API Key)
 */
export const flexibleAuthMiddleware = async (ctx: Context, next: Next) => {
  const authHeader = ctx.headers.authorization
  const apiKey = ctx.headers["x-api-key"] as string

  if (authHeader) {
    // Essayer l'authentification JWT
    await authMiddleware(ctx, next)
  } else if (apiKey) {
    // Essayer l'authentification API Key
    await apiKeyMiddleware(ctx, next)
  } else {
    ctx.status = 401
    ctx.body = {
      success: false,
      message: "Authentification requise (JWT ou API Key)",
      error: "NO_AUTH_METHOD",
    }
  }
}

/**
 * Middleware de vérification de rôle admin
 */
export const requireAdmin = async (ctx: Context, next: Next) => {
  if (!ctx.user) {
    ctx.status = 401
    ctx.body = {
      success: false,
      message: "Authentification requise",
      error: "NOT_AUTHENTICATED",
    }
    return
  }

  if (ctx.user.role !== "admin") {
    ctx.status = 403
    ctx.body = {
      success: false,
      message: "Accès admin requis",
      error: "INSUFFICIENT_PERMISSIONS",
    }
    return
  }

  await next()
}

/**
 * Middleware de vérification de compte actif
 */
export const requireActiveUser = async (ctx: Context, next: Next) => {
  if (!ctx.user) {
    ctx.status = 401
    ctx.body = {
      success: false,
      message: "Authentification requise",
      error: "NOT_AUTHENTICATED",
    }
    return
  }

  if (!ctx.user.isActive) {
    ctx.status = 403
    ctx.body = {
      success: false,
      message: "Compte désactivé",
      error: "ACCOUNT_DISABLED",
    }
    return
  }

  await next()
}
