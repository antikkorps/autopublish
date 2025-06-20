import { jest } from "@jest/globals"
import dotenv from "dotenv"

// Charger les variables d'environnement de test
dotenv.config({ path: ".env.test" })

// Configuration des variables d'environnement pour les tests
process.env.NODE_ENV = "test"
process.env.JWT_SECRET = "test_jwt_secret_key_123456789"
process.env.JWT_REFRESH_SECRET = "test_jwt_refresh_secret_key_123456789"

// Mock de tous les modules externes avant leur import
jest.mock("../src/config/database", () => ({
  sync: jest.fn().mockResolvedValue(undefined),
  authenticate: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  define: jest.fn(),
  models: {},
}))

jest.mock("../src/models/User", () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  findByPk: jest.fn(),
  findAll: jest.fn(),
  destroy: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
  findByEmail: jest.fn(),
  hashPassword: jest.fn(),
  generateApiKey: jest.fn(),
  init: jest.fn(),
  hasMany: jest.fn(),
  belongsTo: jest.fn(),
}))

jest.mock("../src/models/Citation", () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  findByPk: jest.fn(),
  findAll: jest.fn(),
  destroy: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
  init: jest.fn(),
  belongsTo: jest.fn(),
}))

jest.mock("../src/models/Post", () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  findByPk: jest.fn(),
  findAll: jest.fn(),
  destroy: jest.fn(),
  update: jest.fn(),
  init: jest.fn(),
  belongsTo: jest.fn(),
  hasMany: jest.fn(),
}))

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockImplementation(async (password) => `hashed_${password}`),
  compare: jest.fn().mockResolvedValue(true),
}))

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("mock_jwt_token"),
  verify: jest.fn().mockReturnValue({
    userId: 1,
    email: "test@example.com",
    role: "user",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
  }),
  TokenExpiredError: class TokenExpiredError extends Error {
    name = "TokenExpiredError"
  },
  JsonWebTokenError: class JsonWebTokenError extends Error {
    name = "JsonWebTokenError"
  },
}))

// Helper simple pour créer un mock user
const createMockUser = (data = {}) =>
  ({
    id: 1,
    email: "test@example.com",
    name: "Test User",
    role: "user",
    isActive: true,
    rateLimit: { daily: 100, hourly: 20 },
    apiKey: null,
    lastLogin: null,
    password: "hashed_password",
    validatePassword: jest.fn().mockResolvedValue(true),
    updateLastLogin: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    reload: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    changed: jest.fn().mockReturnValue(false),
    toSafeJSON: jest.fn().mockReturnValue({
      id: 1,
      email: "test@example.com",
      name: "Test User",
      role: "user",
      isActive: true,
      rateLimit: { daily: 100, hourly: 20 },
      lastLogin: null,
    }),
    ...data,
  }(
    // Variables globales pour les tests
    global as any
  ).createMockUser = createMockUser)

console.log("🧪 Setup des tests simple initialisé")
