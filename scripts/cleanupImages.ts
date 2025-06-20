#!/usr/bin/env ts-node

import dotenv from "dotenv"
import { promises as fs } from "fs"
import path from "path"
import sequelize from "../src/config/database"

dotenv.config()

class ImageCleanup {
  private readonly imageDir: string
  private stats = {
    scanned: 0,
    deleted: 0,
    errors: 0,
    spaceSaved: 0, // en bytes
  }

  constructor() {
    this.imageDir = path.join(process.cwd(), "public", "images", "generated")
  }

  async run(maxAgeHours: number = 168): Promise<void> {
    // 7 jours par défaut
    console.log("🧹 Démarrage du nettoyage des images anciennes...")
    console.log(`📅 Suppression des images de plus de ${maxAgeHours} heures`)

    try {
      await sequelize.authenticate()
      console.log("✅ Connexion à la base de données établie")

      await this.cleanupImages(maxAgeHours)
      this.displayStats()
    } catch (error) {
      console.error("❌ Erreur lors du nettoyage:", error)
      process.exit(1)
    } finally {
      await sequelize.close()
    }
  }

  private async cleanupImages(maxAgeHours: number): Promise<void> {
    try {
      // Vérifier que le dossier existe
      const exists = await fs
        .access(this.imageDir)
        .then(() => true)
        .catch(() => false)
      if (!exists) {
        console.log("📁 Dossier d'images n'existe pas encore")
        return
      }

      // Lire tous les fichiers
      const files = await fs.readdir(this.imageDir)
      console.log(`📊 ${files.length} fichiers trouvés dans ${this.imageDir}`)

      const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000

      for (const filename of files) {
        await this.processFile(filename, cutoffTime)
      }
    } catch (error) {
      console.error("❌ Erreur lors du scan du dossier:", error)
      throw error
    }
  }

  private async processFile(filename: string, cutoffTime: number): Promise<void> {
    const filePath = path.join(this.imageDir, filename)
    this.stats.scanned++

    try {
      const stats = await fs.stat(filePath)

      // Vérifier si le fichier est trop ancien
      if (stats.mtime.getTime() < cutoffTime) {
        const fileSize = stats.size
        await fs.unlink(filePath)

        this.stats.deleted++
        this.stats.spaceSaved += fileSize

        console.log(`   🗑️  Supprimé: ${filename} (${this.formatBytes(fileSize)})`)
      }
    } catch (error) {
      console.error(`   ❌ Erreur avec le fichier ${filename}:`, error)
      this.stats.errors++
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B"

    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  private displayStats(): void {
    console.log("\n" + "=".repeat(50))
    console.log("🧹 STATISTIQUES DE NETTOYAGE")
    console.log("=".repeat(50))
    console.log(`📊 Fichiers scannés: ${this.stats.scanned}`)
    console.log(`🗑️  Fichiers supprimés: ${this.stats.deleted}`)
    console.log(`💾 Espace libéré: ${this.formatBytes(this.stats.spaceSaved)}`)
    console.log(`❌ Erreurs: ${this.stats.errors}`)
    console.log("=".repeat(50))

    if (this.stats.deleted > 0) {
      console.log(`✅ Nettoyage terminé avec succès!`)
    } else {
      console.log(`ℹ️  Aucun fichier à supprimer`)
    }
  }
}

// Fonction utilitaire pour parser les arguments
function parseArgs(): { maxAgeHours: number } {
  const args = process.argv.slice(2)
  let maxAgeHours = 168 // 7 jours par défaut

  args.forEach((arg, index) => {
    if (arg === "--max-age" && args[index + 1]) {
      maxAgeHours = parseInt(args[index + 1])
    }
  })

  return { maxAgeHours }
}

async function main() {
  const { maxAgeHours } = parseArgs()
  const cleanup = new ImageCleanup()

  try {
    await cleanup.run(maxAgeHours)
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

export { ImageCleanup }
