#!/usr/bin/env ts-node

import dotenv from "dotenv"
import { promises as fs } from "fs"
import path from "path"
import { Op } from "sequelize"
import sequelize from "../src/config/database"
import Citation from "../src/models/Citation"

dotenv.config()

interface HealthStatus {
  database: boolean
  apiKeys: boolean
  diskSpace: boolean
  recentGeneration: boolean
  imageDirectory: boolean
}

class HealthChecker {
  private status: HealthStatus = {
    database: false,
    apiKeys: false,
    diskSpace: false,
    recentGeneration: false,
    imageDirectory: false,
  }

  async run(): Promise<void> {
    console.log("🏥 Vérification de santé du système AutoPublish...")
    console.log("=" + "=".repeat(48))

    try {
      await this.checkDatabase()
      await this.checkApiKeys()
      await this.checkDiskSpace()
      await this.checkRecentGeneration()
      await this.checkImageDirectory()

      this.displayResults()
    } catch (error) {
      console.error("❌ Erreur lors de la vérification:", error)
      process.exit(1)
    } finally {
      await sequelize.close().catch(() => {})
    }
  }

  private async checkDatabase(): Promise<void> {
    console.log("\n🗄️  Vérification de la base de données...")

    try {
      await sequelize.authenticate()

      // Tester une requête simple
      const count = await Citation.count()
      console.log(`   ✅ Connexion OK - ${count} citations en base`)

      this.status.database = true
    } catch (error) {
      console.log(`   ❌ Erreur de connexion: ${error}`)
      this.status.database = false
    }
  }

  private async checkApiKeys(): Promise<void> {
    console.log("\n🔑 Vérification des clés API...")

    const openaiKey = process.env.OPENAI_API_KEY
    const claudeKey = process.env.CLAUDE_API_KEY

    if (openaiKey && openaiKey.length > 10) {
      console.log("   ✅ Clé OpenAI configurée")
    } else {
      console.log("   ⚠️  Clé OpenAI manquante ou invalide")
    }

    if (claudeKey && claudeKey.length > 10) {
      console.log("   ✅ Clé Claude configurée")
    } else {
      console.log("   ⚠️  Clé Claude manquante ou invalide")
    }

    // Au moins une clé doit être présente
    this.status.apiKeys = Boolean(
      (openaiKey && openaiKey.length > 10) || (claudeKey && claudeKey.length > 10)
    )

    if (!this.status.apiKeys) {
      console.log("   ❌ Aucune clé API valide trouvée")
    }
  }

  private async checkDiskSpace(): Promise<void> {
    console.log("\n💾 Vérification de l'espace disque...")

    try {
      const imageDir = path.join(process.cwd(), "public", "images", "generated")

      // Créer le dossier s'il n'existe pas
      await fs.mkdir(imageDir, { recursive: true })

      // Calculer la taille du dossier
      const size = await this.calculateDirectorySize(imageDir)
      const sizeFormatted = this.formatBytes(size)

      console.log(`   📁 Taille du dossier images: ${sizeFormatted}`)

      // Vérifier l'espace libre (simple test d'écriture)
      const testFile = path.join(imageDir, ".health-test")
      await fs.writeFile(testFile, "test")
      await fs.unlink(testFile)

      console.log("   ✅ Espace disque suffisant")
      this.status.diskSpace = true
    } catch (error) {
      console.log(`   ❌ Problème d'espace disque: ${error}`)
      this.status.diskSpace = false
    }
  }

  private async checkRecentGeneration(): Promise<void> {
    console.log("\n📅 Vérification de la génération récente...")

    try {
      // Chercher des citations générées dans les dernières 48h
      const twoDaysAgo = new Date()
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

      const recentCitations = await Citation.count({
        where: {
          generated_at: {
            [Op.gte]: twoDaysAgo,
          },
        },
      })

      if (recentCitations > 0) {
        console.log(`   ✅ ${recentCitations} citations générées dans les dernières 48h`)
        this.status.recentGeneration = true
      } else {
        console.log("   ⚠️  Aucune citation générée récemment")
        this.status.recentGeneration = false
      }
    } catch (error) {
      console.log(`   ❌ Erreur vérification génération: ${error}`)
      this.status.recentGeneration = false
    }
  }

  private async checkImageDirectory(): Promise<void> {
    console.log("\n🖼️  Vérification du dossier d'images...")

    try {
      const imageDir = path.join(process.cwd(), "public", "images", "generated")

      const exists = await fs
        .access(imageDir)
        .then(() => true)
        .catch(() => false)
      if (!exists) {
        await fs.mkdir(imageDir, { recursive: true })
        console.log("   ✅ Dossier d'images créé")
      } else {
        const files = await fs.readdir(imageDir)
        console.log(`   ✅ Dossier d'images OK - ${files.length} fichiers`)
      }

      this.status.imageDirectory = true
    } catch (error) {
      console.log(`   ❌ Problème avec le dossier d'images: ${error}`)
      this.status.imageDirectory = false
    }
  }

  private async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0

    try {
      const files = await fs.readdir(dirPath)

      for (const file of files) {
        const filePath = path.join(dirPath, file)
        const stats = await fs.stat(filePath)

        if (stats.isFile()) {
          totalSize += stats.size
        }
      }
    } catch (error) {
      // Dossier vide ou n'existe pas
    }

    return totalSize
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B"

    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  private displayResults(): void {
    console.log("\n" + "=".repeat(50))
    console.log("🏥 RÉSULTATS DE LA VÉRIFICATION DE SANTÉ")
    console.log("=".repeat(50))

    const checks = [
      { name: "Base de données", status: this.status.database },
      { name: "Clés API", status: this.status.apiKeys },
      { name: "Espace disque", status: this.status.diskSpace },
      { name: "Génération récente", status: this.status.recentGeneration },
      { name: "Dossier d'images", status: this.status.imageDirectory },
    ]

    let allGood = true

    checks.forEach((check) => {
      const icon = check.status ? "✅" : "❌"
      console.log(`${icon} ${check.name}`)
      if (!check.status) allGood = false
    })

    console.log("=".repeat(50))

    if (allGood) {
      console.log("🎉 Système en parfaite santé!")
      process.exit(0)
    } else {
      console.log("⚠️  Attention: Certains problèmes détectés")
      process.exit(1)
    }
  }
}

async function main() {
  const healthChecker = new HealthChecker()

  try {
    await healthChecker.run()
  } catch (error) {
    console.error("💥 Erreur fatale:", error)
    process.exit(1)
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

export { HealthChecker }
