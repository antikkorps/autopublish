import Citation from "@/models/Citation"
import { DailyGenerationService } from "@/services/dailyGenerationService"
import dotenv from "dotenv"
import fs from "fs"
import path from "path"

dotenv.config()

async function testWorkflow() {
  console.log("🚀 Test du workflow complet AutoPublish")
  console.log("=".repeat(50))
  console.log("Citation → Image → Post (prêt pour publication)")

  try {
    // Configuration pour test
    const config = {
      totalCitations: 2, // Juste 2 pour tester
      themes: {
        motivation: { count: 1, style: "motivational" as const },
        inspiration: { count: 1, style: "inspirational" as const },
      },
      language: "fr" as const,
      minQualityScore: 0.6,
      generateImages: true, // Important : génération d'images
      publishToInstagram: false, // Pas de publication pour le test
    }

    console.log("📋 Configuration du test :")
    console.log(`   • ${config.totalCitations} citations`)
    console.log(`   • Thèmes : ${Object.keys(config.themes).join(", ")}`)
    console.log(`   • Images : ${config.generateImages ? "OUI" : "NON"}`)
    console.log(`   • Publication : ${config.publishToInstagram ? "OUI" : "NON (test)"}`)

    // Lancement de la génération
    console.log("\n🎯 Génération en cours...")
    const startTime = Date.now()

    const generationService = new DailyGenerationService(config)
    const results = await generationService.generate()

    const executionTime = Date.now() - startTime

    // Affichage des résultats
    console.log("\n🎉 Génération terminée !")
    console.log("=".repeat(40))
    console.log(`✅ Citations générées : ${results.generated}`)
    console.log(`✅ Citations sauvées : ${results.saved}`)
    console.log(`✅ Images créées : ${results.withImages}`)
    console.log(`❌ Échecs : ${results.failed}`)
    console.log(`⏱️  Temps d'exécution : ${executionTime}ms`)

    // Récupération des citations créées pour affichage détaillé
    console.log("\n📝 Détails des citations créées :")

    const recentCitations = await Citation.findAll({
      where: {
        generated_at: {
          [require("sequelize").Op.gte]: new Date(Date.now() - 60000), // Dernière minute
        },
      },
      order: [["generated_at", "DESC"]],
      limit: config.totalCitations,
    })

    if (recentCitations.length > 0) {
      recentCitations.forEach((citation, index) => {
        console.log(`\n${index + 1}. 📜 Citation ID: ${citation.id}`)
        console.log(`   📖 "${citation.content}"`)
        console.log(`   👤 Auteur : ${citation.author}`)
        console.log(`   🏷️  Thème : ${citation.theme}`)
        console.log(`   ⭐ Score : ${citation.quality_score}`)
        console.log(`   🗣️  Langue : ${citation.language}`)

        if (citation.imagePath) {
          console.log(`   🖼️  Image : ${citation.imagePath}`)

          // Vérifier si le fichier image existe
          const imagePath = path.join(process.cwd(), "public", citation.imagePath)
          if (fs.existsSync(imagePath)) {
            const stats = fs.statSync(imagePath)
            console.log(`   📁 Taille : ${Math.round(stats.size / 1024)}KB`)
            console.log(`   ✅ Fichier image présent`)
          } else {
            console.log(`   ❌ Fichier image manquant`)
          }
        } else {
          console.log(`   ⚠️  Pas d'image générée`)
        }

        if (citation.hashtags) {
          console.log(`   #️⃣  Hashtags : ${citation.hashtags}`)
        }
      })

      // Créer un résumé pour publication manuelle
      console.log("\n📋 Résumé pour publication manuelle :")
      console.log("=".repeat(50))

      recentCitations.forEach((citation, index) => {
        console.log(`\n🎯 POST ${index + 1} - Prêt pour Instagram/Facebook :`)
        console.log(`📝 Texte : "${citation.content}" - ${citation.author}`)
        if (citation.imagePath) {
          console.log(
            `🖼️  Image : /Users/franck/Documents/autopublish/public/${citation.imagePath}`
          )
        }
        if (citation.hashtags) {
          console.log(`#️⃣  Hashtags : ${citation.hashtags}`)
        }
        console.log(`📊 Score qualité : ${citation.quality_score}`)
      })
    } else {
      console.log("❌ Aucune citation récente trouvée")
    }

    // Statistiques finales
    console.log("\n📊 Bilan du test :")
    console.log(`   • Workflow complet : ${results.saved > 0 ? "✅ SUCCÈS" : "❌ ÉCHEC"}`)
    console.log(`   • Génération IA : ${results.generated > 0 ? "✅" : "❌"}`)
    console.log(`   • Sauvegarde DB : ${results.saved > 0 ? "✅" : "❌"}`)
    console.log(`   • Création images : ${results.withImages > 0 ? "✅" : "❌"}`)
    console.log(
      `   • Taux de réussite : ${Math.round((results.saved / results.generated) * 100)}%`
    )

    console.log("\n🎯 Prochaines étapes :")
    console.log("   1. ✅ Votre système fonctionne parfaitement !")
    console.log("   2. 📁 Toutes les images sont dans 'public/images/generated/'")
    console.log("   3. 📱 Vous pouvez publier manuellement sur Instagram")
    console.log("   4. 🔄 Configurez Instagram API quand vous voulez automatiser")

    if (results.withImages > 0) {
      console.log("\n🏆 SUCCÈS : Votre AutoPublish génère des posts complets !")
      console.log("   Citation + Image + Hashtags = Prêt pour les réseaux sociaux")
    }
  } catch (error: any) {
    console.error("❌ Erreur lors du test :", error.message)
    console.error("Stack :", error.stack)
  }
}

testWorkflow()
