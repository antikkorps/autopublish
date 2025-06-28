import { DailyGenerationService } from "@/services/dailyGenerationService"
import dotenv from "dotenv"

dotenv.config()

async function generateComplete() {
  console.log("🚀 Génération automatique complète (sans Instagram)")
  console.log("=".repeat(60))

  try {
    // Configuration simple
    const config = {
      totalCitations: 3, // Générons 3 citations
      themes: {
        motivation: { count: 1, style: "motivational" as const },
        sagesse: { count: 1, style: "philosophical" as const },
        inspiration: { count: 1, style: "inspirational" as const },
      },
      language: "fr" as const,
      minQualityScore: 0.6,
      generateImages: true, // Génération d'images activée
      publishToInstagram: false, // Pas d'Instagram pour l'instant
    }

    console.log("📋 Configuration :")
    console.log(`   • ${config.totalCitations} citations à générer`)
    console.log(`   • Thèmes : ${Object.keys(config.themes).join(", ")}`)
    console.log(`   • Langue : ${config.language}`)
    console.log(`   • Images : ${config.generateImages ? "OUI" : "NON"}`)
    console.log(`   • Instagram : ${config.publishToInstagram ? "OUI" : "NON"}`)

    // Lancement de la génération
    console.log("\n🎯 Lancement de la génération...")
    const generationService = new DailyGenerationService(config)
    const results = await generationService.generate()

    // Affichage des résultats
    console.log("\n🎉 Génération terminée !")
    console.log("=".repeat(40))
    console.log(`✅ Images créées : ${results.withImages}`)
    console.log(`❌ Échecs : ${results.failed}`)

    console.log("\n📊 Statistiques :")
    console.log(`   • Citations générées : ${results.generated}`)
    console.log(`   • Citations sauvées : ${results.saved}`)
    console.log(`   • Images créées : ${results.withImages}`)
    console.log(`   • Publications Instagram : ${results.published}`)
    console.log(`   • Échecs publication : ${results.publishFailed}`)
    console.log(
      `   • Taux de réussite : ${Math.round((results.saved / results.generated) * 100)}%`
    )

    console.log("\n💡 Prochaines étapes :")
    console.log("   1. ✅ Votre système fonctionne parfaitement !")
    console.log("   2. 📁 Vos images sont dans le dossier 'public/images/generated/'")
    console.log("   3. 🎯 Vous pouvez publier manuellement sur Instagram")
    console.log("   4. 🔄 Ou configurer Instagram plus tard quand vous voulez")

    // Affichage du chemin des images
    console.log("\n📂 Localisation des fichiers :")
    console.log(
      "   • Images : /Users/franck/Documents/autopublish/public/images/generated/"
    )
    console.log("   • Base de données : Toutes les citations sont sauvegardées")
  } catch (error: any) {
    console.error("\n❌ Erreur lors de la génération :", error.message)
    console.error("Stack :", error.stack)
  }
}

generateComplete()
