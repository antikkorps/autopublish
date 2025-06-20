/** @type {import('jest').Config} */
export default {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/config/database.ts", // Exclu car mocké
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        isolatedModules: true,
        diagnostics: false,
        tsconfig: {
          module: "commonjs",
          target: "es2020",
          strict: false,
          skipLibCheck: true,
          noImplicitAny: false,
        },
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@/controllers/(.*)$": "<rootDir>/src/controllers/$1",
    "^@/models/(.*)$": "<rootDir>/src/models/$1",
    "^@/services/(.*)$": "<rootDir>/src/services/$1",
    "^@/middleware/(.*)$": "<rootDir>/src/middleware/$1",
    "^@/routes/(.*)$": "<rootDir>/src/routes/$1",
    "^@/utils/(.*)$": "<rootDir>/src/utils/$1",
    "^@/config/(.*)$": "<rootDir>/src/config/$1",
    "^@tests/(.*)$": "<rootDir>/tests/$1",
  },
  testTimeout: 10000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: false,
}
