#!/usr/bin/env ts-node

import dotenv from "dotenv"
import sequelize from "../src/config/database"
import {
  DailyConfig,
  DailyGenerationService,
  DEFAULT_CONFIG,
} from "../src/services/dailyGenerationService"

// Charger les variables d'environnement
dotenv.config()

// Fonction utilitaire pour personnaliser la configuration
function getConfigFromArgs(): DailyConfig {
  const args = process.argv.slice(2)
  const config = { ...DEFAULT_CONFIG }

  // Exemples d'arguments de ligne de commande
  args.forEach((arg, index) => {
    if (arg === "--count" && args[index + 1]) {
      config.totalCitations = parseInt(args[index + 1])
    }
    if (arg === "--no-images") {
      config.generateImages = false
    }
    if (arg === "--quality" && args[index + 1]) {
      config.minQualityScore = parseFloat(args[index + 1])
    }
    if (arg === "--lang" && args[index + 1]) {
      config.language = args[index + 1]
    }
  })

  return config
}

// Point d'entrée principal
async function main() {
  const config = getConfigFromArgs()
  const service = new DailyGenerationService(config)

  try {
    const stats = await service.generate()

    if (stats.saved === 0) {
      console.log("⚠️  ATTENTION: Aucune citation sauvée!")
      process.exit(1)
    } else {
      console.log(`🎉 Génération quotidienne terminée avec succès!`)
      process.exit(0)
    }
  } catch (error) {
    console.error("💥 Erreur fatale:", error)
    process.exit(1)
  } finally {
    await sequelize.close().catch(() => {})
  }
}

// Compatible Jest et ES modules
if (typeof require !== "undefined" && require.main === module) {
  main()
} else if (
  typeof import.meta !== "undefined" &&
  import.meta.url === `file://${process.argv[1]}`
) {
  main()
}

// Exports pour les tests
export { DailyConfig, DailyGenerationService, DEFAULT_CONFIG }
