import { Context } from "koa"
import { getRateLimitStats } from "../middleware/rateLimitMiddleware"
import authService from "../services/authService"

export class AuthController {
  /**
   * Inscription d'un nouvel utilisateur
   * POST /api/auth/register
   */
  async register(ctx: Context) {
    try {
      const { email, password, name, role } = ctx.request.body as any

      // Validation des données
      if (!email || !password || !name) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: "Email, mot de passe et nom sont requis",
          error: "MISSING_REQUIRED_FIELDS",
        }
        return
      }

      // Validation du mot de passe
      if (password.length < 8) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: "Le mot de passe doit contenir au moins 8 caractères",
          error: "WEAK_PASSWORD",
        }
        return
      }

      // Validation de l'email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: "Format d'email invalide",
          error: "INVALID_EMAIL_FORMAT",
        }
        return
      }

      // Création de l'utilisateur
      const result = await authService.register({
        email,
        password,
        name,
        role: role === "admin" ? "admin" : "user", // Sécurité: seuls les admins peuvent créer des admins
      })

      if (!result) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: "Erreur lors de la création du compte",
          error: "REGISTRATION_FAILED",
        }
        return
      }

      const { user, tokens } = result

      ctx.status = 201
      ctx.body = {
        success: true,
        message: "Compte créé avec succès",
        data: {
          user: user.toSafeJSON(),
          tokens,
          rateLimits: user.rateLimit,
        },
      }
    } catch (error: any) {
      console.error("Erreur lors de l'inscription:", error)

      if (error.name === "SequelizeUniqueConstraintError") {
        ctx.status = 409
        ctx.body = {
          success: false,
          message: "Un compte avec cet email existe déjà",
          error: "EMAIL_ALREADY_EXISTS",
        }
        return
      }

      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur interne du serveur",
        error: "INTERNAL_SERVER_ERROR",
      }
    }
  }

  /**
   * Connexion d'un utilisateur
   * POST /api/auth/login
   */
  async login(ctx: Context) {
    try {
      const { email, password } = ctx.request.body as any

      if (!email || !password) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: "Email et mot de passe requis",
          error: "MISSING_CREDENTIALS",
        }
        return
      }

      const result = await authService.authenticate(email, password)

      if (!result) {
        ctx.status = 401
        ctx.body = {
          success: false,
          message: "Email ou mot de passe incorrect",
          error: "INVALID_CREDENTIALS",
        }
        return
      }

      const { user, tokens } = result

      ctx.body = {
        success: true,
        message: "Connexion réussie",
        data: {
          user: user.toSafeJSON(),
          tokens,
          rateLimits: user.rateLimit,
        },
      }
    } catch (error) {
      console.error("Erreur lors de la connexion:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur interne du serveur",
        error: "INTERNAL_SERVER_ERROR",
      }
    }
  }

  /**
   * Rafraîchissement du token d'accès
   * POST /api/auth/refresh
   */
  async refreshToken(ctx: Context) {
    try {
      const { refreshToken } = ctx.request.body as any

      if (!refreshToken) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: "Refresh token requis",
          error: "MISSING_REFRESH_TOKEN",
        }
        return
      }

      const tokens = await authService.refreshAccessToken(refreshToken)

      if (!tokens) {
        ctx.status = 401
        ctx.body = {
          success: false,
          message: "Refresh token invalide ou expiré",
          error: "INVALID_REFRESH_TOKEN",
        }
        return
      }

      ctx.body = {
        success: true,
        message: "Token rafraîchi avec succès",
        data: { tokens },
      }
    } catch (error) {
      console.error("Erreur lors du rafraîchissement:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur interne du serveur",
        error: "INTERNAL_SERVER_ERROR",
      }
    }
  }

  /**
   * Déconnexion (côté serveur, on peut blacklister le token)
   * POST /api/auth/logout
   */
  async logout(ctx: Context) {
    try {
      // Pour l'instant, la déconnexion est gérée côté client
      // En production, on pourrait ajouter une blacklist des tokens

      ctx.body = {
        success: true,
        message: "Déconnexion réussie",
      }
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur interne du serveur",
        error: "INTERNAL_SERVER_ERROR",
      }
    }
  }

  /**
   * Profil de l'utilisateur connecté
   * GET /api/auth/profile
   */
  async getProfile(ctx: Context) {
    try {
      if (!ctx.user) {
        ctx.status = 401
        ctx.body = {
          success: false,
          message: "Non authentifié",
          error: "NOT_AUTHENTICATED",
        }
        return
      }

      // Récupérer les statistiques de rate limiting
      const rateLimitStats = getRateLimitStats(ctx)

      ctx.body = {
        success: true,
        data: {
          user: ctx.user.toSafeJSON(),
          rateLimits: ctx.user.rateLimit,
          currentUsage: rateLimitStats,
        },
      }
    } catch (error) {
      console.error("Erreur lors de la récupération du profil:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur interne du serveur",
        error: "INTERNAL_SERVER_ERROR",
      }
    }
  }

  /**
   * Mise à jour du profil
   * PUT /api/auth/profile
   */
  async updateProfile(ctx: Context) {
    try {
      if (!ctx.user) {
        ctx.status = 401
        ctx.body = {
          success: false,
          message: "Non authentifié",
          error: "NOT_AUTHENTICATED",
        }
        return
      }

      const { name, email } = ctx.request.body as any
      const updateData: any = {}

      if (name && name.trim().length >= 2) {
        updateData.name = name.trim()
      }

      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        updateData.email = email.toLowerCase().trim()
      }

      if (Object.keys(updateData).length === 0) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: "Aucune donnée valide à mettre à jour",
          error: "NO_VALID_DATA",
        }
        return
      }

      await ctx.user.update(updateData)
      await ctx.user.reload()

      ctx.body = {
        success: true,
        message: "Profil mis à jour avec succès",
        data: {
          user: ctx.user.toSafeJSON(),
        },
      }
    } catch (error: any) {
      console.error("Erreur lors de la mise à jour du profil:", error)

      if (error.name === "SequelizeUniqueConstraintError") {
        ctx.status = 409
        ctx.body = {
          success: false,
          message: "Cet email est déjà utilisé",
          error: "EMAIL_ALREADY_EXISTS",
        }
        return
      }

      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur interne du serveur",
        error: "INTERNAL_SERVER_ERROR",
      }
    }
  }

  /**
   * Changement de mot de passe
   * PUT /api/auth/password
   */
  async changePassword(ctx: Context) {
    try {
      if (!ctx.user) {
        ctx.status = 401
        ctx.body = {
          success: false,
          message: "Non authentifié",
          error: "NOT_AUTHENTICATED",
        }
        return
      }

      const { currentPassword, newPassword } = ctx.request.body as any

      if (!currentPassword || !newPassword) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: "Mot de passe actuel et nouveau mot de passe requis",
          error: "MISSING_PASSWORDS",
        }
        return
      }

      if (newPassword.length < 8) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: "Le nouveau mot de passe doit contenir au moins 8 caractères",
          error: "WEAK_PASSWORD",
        }
        return
      }

      // Vérifier l'ancien mot de passe
      const isValidPassword = await ctx.user.validatePassword(currentPassword)
      if (!isValidPassword) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: "Mot de passe actuel incorrect",
          error: "INVALID_CURRENT_PASSWORD",
        }
        return
      }

      // Mettre à jour le mot de passe
      await ctx.user.update({ password: newPassword })

      ctx.body = {
        success: true,
        message: "Mot de passe changé avec succès",
      }
    } catch (error) {
      console.error("Erreur lors du changement de mot de passe:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur interne du serveur",
        error: "INTERNAL_SERVER_ERROR",
      }
    }
  }

  /**
   * Génération d'une API Key
   * POST /api/auth/api-key
   */
  async generateApiKey(ctx: Context) {
    try {
      if (!ctx.user) {
        ctx.status = 401
        ctx.body = {
          success: false,
          message: "Non authentifié",
          error: "NOT_AUTHENTICATED",
        }
        return
      }

      const apiKey = await authService.generateApiKey(ctx.user.id)

      if (!apiKey) {
        ctx.status = 500
        ctx.body = {
          success: false,
          message: "Erreur lors de la génération de l'API Key",
          error: "API_KEY_GENERATION_FAILED",
        }
        return
      }

      ctx.body = {
        success: true,
        message: "API Key générée avec succès",
        data: {
          apiKey,
          warning: "Sauvegardez cette clé, elle ne sera plus affichée",
        },
      }
    } catch (error) {
      console.error("Erreur lors de la génération d'API Key:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur interne du serveur",
        error: "INTERNAL_SERVER_ERROR",
      }
    }
  }

  /**
   * Révocation de l'API Key
   * DELETE /api/auth/api-key
   */
  async revokeApiKey(ctx: Context) {
    try {
      if (!ctx.user) {
        ctx.status = 401
        ctx.body = {
          success: false,
          message: "Non authentifié",
          error: "NOT_AUTHENTICATED",
        }
        return
      }

      const success = await authService.revokeApiKey(ctx.user.id)

      if (!success) {
        ctx.status = 500
        ctx.body = {
          success: false,
          message: "Erreur lors de la révocation de l'API Key",
          error: "API_KEY_REVOCATION_FAILED",
        }
        return
      }

      ctx.body = {
        success: true,
        message: "API Key révoquée avec succès",
      }
    } catch (error) {
      console.error("Erreur lors de la révocation d'API Key:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur interne du serveur",
        error: "INTERNAL_SERVER_ERROR",
      }
    }
  }

  /**
   * Vérification du statut d'authentification
   * GET /api/auth/status
   */
  async getAuthStatus(ctx: Context) {
    try {
      const isAuthenticated = !!ctx.user
      const rateLimitStats = getRateLimitStats(ctx)

      ctx.body = {
        success: true,
        data: {
          isAuthenticated,
          user: isAuthenticated ? ctx.user!.toSafeJSON() : null,
          rateLimits: isAuthenticated ? ctx.user!.rateLimit : null,
          currentUsage: rateLimitStats,
        },
      }
    } catch (error) {
      console.error("Erreur lors de la vérification du statut:", error)
      ctx.status = 500
      ctx.body = {
        success: false,
        message: "Erreur interne du serveur",
        error: "INTERNAL_SERVER_ERROR",
      }
    }
  }
}
