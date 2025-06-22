import * as dotenv from "dotenv"
import { Sequelize } from "sequelize"

dotenv.config()

// Détection de l'environnement de test
const isTestEnvironment =
  process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined

let sequelize: Sequelize

if (isTestEnvironment) {
  // Configuration pour les tests - utilise une base de données locale simple
  sequelize = new Sequelize({
    dialect: "postgres",
    host: process.env.TEST_DB_HOST || "localhost",
    port: parseInt(process.env.TEST_DB_PORT || "5432"),
    database: process.env.TEST_DB_NAME || "autopublish_test",
    username: process.env.TEST_DB_USER || "postgres",
    password: process.env.TEST_DB_PASSWORD || "",
    logging: false, // Pas de logs en mode test
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  })
} else {
  // Configuration pour production/développement (comme avant)
  sequelize = process.env.DATABASE_URL
    ? new Sequelize(process.env.DATABASE_URL, {
        dialect: "postgres",
        logging: process.env.NODE_ENV === "development" ? console.log : false,
        pool: {
          max: 10,
          min: 0,
          acquire: 30000,
          idle: 10000,
        },
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false, // Nécessaire pour Neon
          },
        },
      })
    : new Sequelize({
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432"),
        database: process.env.DB_NAME || "autopublish",
        username: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "",
        dialect: "postgres",
        logging: process.env.NODE_ENV === "development" ? console.log : false,
        pool: {
          max: 10,
          min: 0,
          acquire: 30000,
          idle: 10000,
        },
      })
}

export default sequelize
