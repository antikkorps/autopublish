import imageService from "@/services/imageService"
import dotenv from "dotenv"

dotenv.config()

async function testImagesFonds() {
  console.log("🖼️  TEST DES IMAGES AVEC FONDS UNSPLASH")
  console.log("=".repeat(50))

  // Vérifier la configuration Unsplash
  const hasUnsplash = !!process.env.UNSPLASH_ACCESS_KEY
  console.log(`Unsplash configuré: ${hasUnsplash ? "✅" : "❌"}`)

  if (!hasUnsplash) {
    console.log("⚠️  Configurez UNSPLASH_ACCESS_KEY pour tester les images de fond")
    return
  }

  // Citations de test pour différents thèmes
  const testCitations = [
    {
      content: "Chaque jour est une nouvelle opportunité de grandir et de s'épanouir.",
      author: "AutoPublish",
      theme: "motivation",
    },
    {
      content: "La beauté de la vie réside dans les petits moments de bonheur.",
      author: "Sage Anonyme",
      theme: "bonheur",
    },
    {
      content: "L'amour est la force la plus puissante de l'univers.",
      author: "Philosophe",
      theme: "amour",
    },
  ]

  console.log(`\n🎨 Test de génération d'images pour ${testCitations.length} citations`)

  for (let i = 0; i < testCitations.length; i++) {
    const citation = testCitations[i]
    console.log(`\n${i + 1}. 📝 Citation: "${citation.content.substring(0, 40)}..."`)
    console.log(`   🏷️  Thème: ${citation.theme}`)
    console.log(`   👤 Auteur: ${citation.author}`)

    try {
      console.log("   🔄 Génération en cours...")

      // Générer les variations (maintenant avec photo Unsplash)
      const images = await imageService.generateVariations(citation, [
        "minimal",
        "gradient",
        "photo",
      ])

      console.log(`   ✅ ${images.length} image(s) générée(s):`)

      images.forEach((image, index) => {
        console.log(`      ${index + 1}. ${image.metadata.template} - ${image.filename}`)
        console.log(`         📁 Taille: ${Math.round(image.buffer.length / 1024)}KB`)
        console.log(
          `         📐 Dimensions: ${image.metadata.width}x${image.metadata.height}`
        )
      })

      // Vérifier si une image avec fond Unsplash a été créée
      const photoImage = images.find((img) => img.metadata.template === "photo")
      if (photoImage) {
        console.log(`   🎉 Image avec fond Unsplash créée: ${photoImage.filename}`)
      } else {
        console.log(`   ⚠️  Pas d'image Unsplash (fallback utilisé)`)
      }
    } catch (error: any) {
      console.log(`   ❌ Erreur: ${error.message}`)
    }
  }

  console.log("\n📊 RÉSUMÉ:")
  console.log("✅ Templates disponibles:")
  console.log("   • minimal - Fond de couleur simple")
  console.log("   • gradient - Dégradé de couleurs")
  console.log("   • photo - Image de fond Unsplash (NOUVEAU)")

  console.log("\n📁 Localisation des images:")
  console.log("   /Users/franck/Documents/autopublish/public/images/generated/")

  console.log("\n💡 Les images avec fond Unsplash:")
  console.log("   • Utilisent des photos réelles liées au thème")
  console.log("   • Ont un overlay sombre pour la lisibilité")
  console.log("   • Texte blanc avec ombre pour le contraste")
  console.log("   • Guillemets et auteur en doré")

  console.log("\n🚀 Prochaines étapes:")
  console.log("   • Vérifiez les images générées")
  console.log("   • Les images photo sont plus attractives pour Instagram")
  console.log("   • Le système choisit automatiquement des images selon le thème")
}

testImagesFonds()
