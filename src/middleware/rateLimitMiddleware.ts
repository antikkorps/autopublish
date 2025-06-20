import { Context, Next } from "koa"

// Interface pour le store de rate limiting
interface RateLimitStore {
  [key: string]: {
    requests: number
    resetTime: number
    lastRequest: number
  }
}

// Store en mémoire (pour dev - en production utiliser Redis)
const rateLimitStore: RateLimitStore = {}

interface RateLimitOptions {
  windowMs: number // Fenêtre de temps en millisecondes
  maxRequests: number // Nombre max de requêtes dans la fenêtre
  message?: string // Message d'erreur personnalisé
  keyGenerator?: (ctx: Context) => string // Fonction pour générer la clé
  skip?: (ctx: Context) => boolean // Fonction pour ignorer certaines requêtes
  onLimitReached?: (ctx: Context) => void // Callback quand la limite est atteinte
}

/**
 * Générateur de clé par défaut (IP + User ID si authentifié)
 */
const defaultKeyGenerator = (ctx: Context): string => {
  const ip = ctx.request.ip || ctx.request.socket.remoteAddress || "unknown"
  const userId = ctx.user?.id || "anonymous"
  return `${ip}:${userId}`
}

/**
 * Nettoyage périodique du store
 */
const cleanupStore = () => {
  const now = Date.now()
  Object.keys(rateLimitStore).forEach((key) => {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key]
    }
  })
}

// Nettoyer le store toutes les 10 minutes
setInterval(cleanupStore, 10 * 60 * 1000)

/**
 * Middleware de rate limiting générique
 */
export const createRateLimit = (options: RateLimitOptions) => {
  const {
    windowMs,
    maxRequests,
    message = "Trop de requêtes, veuillez réessayer plus tard",
    keyGenerator = defaultKeyGenerator,
    skip,
    onLimitReached,
  } = options

  return async (ctx: Context, next: Next) => {
    try {
      // Vérifier si on doit ignorer cette requête
      if (skip && skip(ctx)) {
        await next()
        return
      }

      const key = keyGenerator(ctx)
      const now = Date.now()

      // Récupérer ou créer l'entrée du store
      let entry = rateLimitStore[key]

      if (!entry || entry.resetTime < now) {
        // Nouvelle fenêtre de temps
        entry = {
          requests: 0,
          resetTime: now + windowMs,
          lastRequest: now,
        }
        rateLimitStore[key] = entry
      }

      // Incrémenter le compteur
      entry.requests++
      entry.lastRequest = now

      // Ajouter les headers de rate limiting
      ctx.set("X-RateLimit-Limit", maxRequests.toString())
      ctx.set(
        "X-RateLimit-Remaining",
        Math.max(0, maxRequests - entry.requests).toString()
      )
      ctx.set("X-RateLimit-Reset", Math.ceil(entry.resetTime / 1000).toString())

      // Vérifier si la limite est dépassée
      if (entry.requests > maxRequests) {
        if (onLimitReached) {
          onLimitReached(ctx)
        }

        ctx.status = 429
        ctx.body = {
          success: false,
          message,
          error: "RATE_LIMIT_EXCEEDED",
          rateLimitInfo: {
            limit: maxRequests,
            windowMs,
            retryAfter: Math.ceil((entry.resetTime - now) / 1000),
          },
        }
        return
      }

      await next()
    } catch (error) {
      console.error("Erreur dans le rate limiting:", error)
      await next() // Continuer en cas d'erreur du rate limiting
    }
  }
}

/**
 * Rate limiting pour les requêtes générales
 */
export const generalRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 1000, // 1000 requêtes par 15 minutes
  message: "Trop de requêtes générales",
})

/**
 * Rate limiting strict pour les endpoints coûteux (IA)
 */
export const expensiveRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  maxRequests: 20, // 20 requêtes par heure
  message: "Trop de requêtes pour les endpoints IA, limite: 20/heure",
  keyGenerator: (ctx: Context) => {
    // Utiliser les limites personnalisées de l'utilisateur si authentifié
    if (ctx.user) {
      return `ai:${ctx.user.id}`
    }
    return `ai:${ctx.request.ip}`
  },
  onLimitReached: (ctx: Context) => {
    console.warn(`Rate limit IA atteint pour ${ctx.user?.email || ctx.request.ip}`)
  },
})

/**
 * Rate limiting intelligent basé sur l'utilisateur
 */
export const userBasedRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  maxRequests: 100, // Par défaut, sera override
  keyGenerator: (ctx: Context) => {
    if (ctx.user) {
      return `user:${ctx.user.id}`
    }
    return `ip:${ctx.request.ip}`
  },
  skip: (ctx: Context) => {
    // Les admins ont des limites plus élevées
    return ctx.user?.role === "admin"
  },
})

/**
 * Middleware de rate limiting intelligent qui s'adapte à l'utilisateur
 */
export const intelligentRateLimit = async (ctx: Context, next: Next) => {
  if (!ctx.user) {
    // Utilisateur non authentifié - limite stricte
    await createRateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 50, // 50 requêtes
      message: "Veuillez vous authentifier pour des limites plus élevées",
    })(ctx, next)
    return
  }

  // Utiliser les limites personnalisées de l'utilisateur
  const userLimits = ctx.user.rateLimit
  const hourlyLimit = createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 heure
    maxRequests: userLimits.hourly,
    keyGenerator: () => `hourly:${ctx.user!.id}`,
    message: `Limite horaire atteinte (${userLimits.hourly} requêtes/heure)`,
  })

  const dailyLimit = createRateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 heures
    maxRequests: userLimits.daily,
    keyGenerator: () => `daily:${ctx.user!.id}`,
    message: `Limite quotidienne atteinte (${userLimits.daily} requêtes/jour)`,
  })

  // Vérifier d'abord la limite horaire, puis la limite quotidienne
  await hourlyLimit(ctx, async () => {
    await dailyLimit(ctx, next)
  })
}

/**
 * Rate limiting spécial pour les endpoints d'authentification
 */
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 tentatives de connexion
  message: "Trop de tentatives de connexion, réessayez dans 15 minutes",
  keyGenerator: (ctx: Context) => {
    const ip = ctx.request.ip || "unknown"
    const email = (ctx.request.body as any)?.email || "unknown"
    return `auth:${ip}:${email}`
  },
  onLimitReached: (ctx: Context) => {
    const ip = ctx.request.ip
    const email = (ctx.request.body as any)?.email
    console.warn(
      `Tentatives de connexion multiples détectées - IP: ${ip}, Email: ${email}`
    )
  },
})

/**
 * Rate limiting pour la génération d'images
 */
export const imageGenerationRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  maxRequests: 50, // 50 images par heure
  message: "Limite de génération d'images atteinte (50/heure)",
  keyGenerator: (ctx: Context) => {
    if (ctx.user) {
      return `images:${ctx.user.id}`
    }
    return `images:${ctx.request.ip}`
  },
})

/**
 * Middleware pour obtenir les statistiques de rate limiting
 */
export const getRateLimitStats = (ctx: Context) => {
  const userKey = ctx.user ? `user:${ctx.user.id}` : `ip:${ctx.request.ip}`
  const entry = rateLimitStore[userKey]

  if (!entry) {
    return {
      requests: 0,
      limit: ctx.user?.rateLimit.hourly || 50,
      remaining: ctx.user?.rateLimit.hourly || 50,
      resetTime: Date.now() + 60 * 60 * 1000,
    }
  }

  const limit = ctx.user?.rateLimit.hourly || 50
  return {
    requests: entry.requests,
    limit,
    remaining: Math.max(0, limit - entry.requests),
    resetTime: entry.resetTime,
  }
}
