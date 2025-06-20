import jwt from "jsonwebtoken"
import User from "../models/User"

interface JWTPayload {
  userId: number
  email: string
  role: string
  iat?: number
  exp?: number
}

interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

class AuthService {
  private readonly accessTokenSecret: string
  private readonly refreshTokenSecret: string
  private readonly accessTokenExpiry: string = "15m" // 15 minutes
  private readonly refreshTokenExpiry: string = "7d" // 7 jours

  constructor() {
    this.accessTokenSecret =
      process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-in-production"
    this.refreshTokenSecret =
      process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-in-production"

    if (
      process.env.NODE_ENV === "production" &&
      (this.accessTokenSecret.includes("dev") || this.refreshTokenSecret.includes("dev"))
    ) {
      console.warn("⚠️  ATTENTION: Utilisez des secrets JWT sécurisés en production!")
    }
  }

  /**
   * Génère une paire de tokens pour un utilisateur
   */
  generateTokens(user: User): TokenPair {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    }

    const accessToken = jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: "autopublish-api",
      audience: "autopublish-client",
    })

    const refreshToken = jwt.sign({ userId: user.id }, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiry,
      issuer: "autopublish-api",
      audience: "autopublish-client",
    })

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes en secondes
    }
  }

  /**
   * Vérifie et décode un access token
   */
  verifyAccessToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: "autopublish-api",
        audience: "autopublish-client",
      }) as JWTPayload

      return decoded
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        console.log("Token expiré")
      } else if (error instanceof jwt.JsonWebTokenError) {
        console.log("Token invalide")
      }
      return null
    }
  }

  /**
   * Vérifie et décode un refresh token
   */
  verifyRefreshToken(token: string): { userId: number } | null {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: "autopublish-api",
        audience: "autopublish-client",
      }) as { userId: number }

      return decoded
    } catch (error) {
      return null
    }
  }

  /**
   * Rafraîchit un access token à partir d'un refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenPair | null> {
    const decoded = this.verifyRefreshToken(refreshToken)
    if (!decoded) {
      return null
    }

    const user = await User.findByPk(decoded.userId)
    if (!user || !user.isActive) {
      return null
    }

    return this.generateTokens(user)
  }

  /**
   * Extrait le token du header Authorization
   */
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null
    }

    const parts = authHeader.split(" ")
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return null
    }

    return parts[1]
  }

  /**
   * Authentifie un utilisateur
   */
  async authenticate(
    email: string,
    password: string
  ): Promise<{
    user: User
    tokens: TokenPair
  } | null> {
    const user = await User.findByEmail(email)
    if (!user || !user.isActive) {
      return null
    }

    const isValidPassword = await user.validatePassword(password)
    if (!isValidPassword) {
      return null
    }

    // Mettre à jour le dernier login
    await user.updateLastLogin()

    const tokens = this.generateTokens(user)

    return {
      user,
      tokens,
    }
  }

  /**
   * Crée un nouvel utilisateur
   */
  async register(userData: {
    email: string
    password: string
    name: string
    role?: "admin" | "user"
  }): Promise<{
    user: User
    tokens: TokenPair
  } | null> {
    try {
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await User.findByEmail(userData.email)
      if (existingUser) {
        throw new Error("Un utilisateur avec cet email existe déjà")
      }

      // Créer l'utilisateur
      const user = await User.create({
        email: userData.email,
        password: userData.password,
        name: userData.name,
        role: userData.role || "user",
        isActive: true,
        rateLimit: {
          daily: userData.role === "admin" ? 1000 : 100,
          hourly: userData.role === "admin" ? 100 : 20,
        },
      })

      const tokens = this.generateTokens(user)

      return {
        user,
        tokens,
      }
    } catch (error) {
      console.error("Erreur lors de l'inscription:", error)
      return null
    }
  }

  /**
   * Génère une API key pour un utilisateur
   */
  async generateApiKey(userId: number): Promise<string | null> {
    try {
      const user = await User.findByPk(userId)
      if (!user) {
        return null
      }

      const apiKey = User.generateApiKey()
      await user.update({ apiKey })

      return apiKey
    } catch (error) {
      console.error("Erreur lors de la génération de l'API key:", error)
      return null
    }
  }

  /**
   * Authentifie avec une API key
   */
  async authenticateWithApiKey(apiKey: string): Promise<User | null> {
    try {
      const user = await User.findOne({
        where: {
          apiKey,
          isActive: true,
        },
      })

      return user
    } catch (error) {
      console.error("Erreur lors de l'authentification API key:", error)
      return null
    }
  }

  /**
   * Révoque l'API key d'un utilisateur
   */
  async revokeApiKey(userId: number): Promise<boolean> {
    try {
      const user = await User.findByPk(userId)
      if (!user) {
        return false
      }

      await user.update({ apiKey: null })
      return true
    } catch (error) {
      console.error("Erreur lors de la révocation de l'API key:", error)
      return false
    }
  }
}

export default new AuthService()
