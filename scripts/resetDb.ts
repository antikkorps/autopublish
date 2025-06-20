import sequelize from "../src/config/database.js"

async function resetDatabase() {
  try {
    console.log("🔄 Réinitialisation de la base de données...")

    // Forcer la recréation de toutes les tables
    await sequelize.sync({ force: true })

    console.log("✅ Base de données réinitialisée avec succès")
    console.log("📋 Tables créées :")
    console.log("  - citations")
    console.log("  - posts")
  } catch (error) {
    console.error("❌ Erreur lors de la réinitialisation:", error)
    process.exit(1)
  } finally {
    await sequelize.close()
    process.exit(0)
  }
}

resetDatabase()
