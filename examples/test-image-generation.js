/**
 * Script d'exemple pour tester la génération d'images
 * Usage: node examples/test-image-generation.js
 */

// Test de l'API de génération d'images
async function testImageGeneration() {
  const baseUrl = "http://localhost:3000/api"

  console.log("🎨 Test de génération d'images pour AutoPublish Instagram")
  console.log("=".repeat(60))

  try {
    // 1. Générer une citation avec l'IA
    console.log("\n1. Génération d'une citation...")
    const citationResponse = await fetch(`${baseUrl}/citations/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        theme: "motivation",
        tone: "inspirant",
        length: "medium",
      }),
    })

    if (!citationResponse.ok) {
      throw new Error(`Erreur citation: ${citationResponse.status}`)
    }

    const citationData = await citationResponse.json()
    const citation = citationData.data
    console.log(`✅ Citation générée: "${citation.content}"`)
    console.log(`   Auteur: ${citation.author || "Anonyme"}`)
    console.log(`   Thème: ${citation.theme}`)

    // 2. Générer une image à partir de la citation
    console.log("\n2. Génération d'une image...")
    const imageResponse = await fetch(`${baseUrl}/images/generate/${citation.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: "minimal",
        includeAuthor: true,
        includeBranding: true,
      }),
    })

    if (!imageResponse.ok) {
      throw new Error(`Erreur image: ${imageResponse.status}`)
    }

    const imageData = await imageResponse.json()
    const image = imageData.data.image
    console.log(`✅ Image générée: ${image.filename}`)
    console.log(`   URL: http://localhost:3000${image.url}`)
    console.log(`   Dimensions: ${image.metadata.width}x${image.metadata.height}`)
    console.log(`   Template: ${image.metadata.template}`)

    // 3. Générer des variations
    console.log("\n3. Génération de variations...")
    const variationsResponse = await fetch(
      `${baseUrl}/images/variations/${citation.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templates: ["gradient", "modern", "elegant"],
        }),
      }
    )

    if (!variationsResponse.ok) {
      throw new Error(`Erreur variations: ${variationsResponse.status}`)
    }

    const variationsData = await variationsResponse.json()
    const variations = variationsData.data.variations
    console.log(`✅ ${variations.length} variations générées:`)

    variations.forEach((variation, index) => {
      console.log(
        `   ${index + 1}. ${variation.filename} (${variation.metadata.template})`
      )
      console.log(`      URL: http://localhost:3000${variation.url}`)
    })

    // 4. Statistiques
    console.log("\n4. Statistiques des images...")
    const statsResponse = await fetch(`${baseUrl}/images/stats`)
    const stats = await statsResponse.json()

    console.log(`✅ Statistiques:`)
    console.log(`   Total images: ${stats.data.totalImages}`)
    console.log(`   Images 24h: ${stats.data.recentImages24h}`)
    console.log(`   Templates disponibles: ${stats.data.availableTemplates.join(", ")}`)

    // 5. Test génération directe
    console.log("\n5. Test génération directe...")
    const directResponse = await fetch(`${baseUrl}/images/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        citation: {
          content:
            "Le succès n'est pas final, l'échec n'est pas fatal : c'est le courage de continuer qui compte.",
          author: "Winston Churchill",
          theme: "success",
        },
        options: {
          template: "elegant",
          width: 800,
          height: 800,
        },
      }),
    })

    if (!directResponse.ok) {
      throw new Error(`Erreur génération directe: ${directResponse.status}`)
    }

    const directData = await directResponse.json()
    console.log(`✅ Image directe générée: ${directData.data.image.filename}`)
    console.log(`   URL: http://localhost:3000${directData.data.image.url}`)

    console.log("\n🎉 Test complet réussi !")
    console.log(
      "\nVous pouvez maintenant ouvrir votre navigateur et visiter les URLs affichées"
    )
    console.log("pour voir les images générées.")
  } catch (error) {
    console.error("❌ Erreur lors du test:", error.message)
    console.log("\n💡 Assurez-vous que le serveur est démarré avec: npm run dev")
  }
}

// Fonctions utilitaires pour tester différents scénarios
async function testAllThemes() {
  const themes = [
    "motivation",
    "success",
    "love",
    "life",
    "wisdom",
    "happiness",
    "inspiration",
  ]
  const baseUrl = "http://localhost:3000/api"

  console.log("\n🎨 Test de tous les thèmes disponibles")
  console.log("=".repeat(50))

  for (const theme of themes) {
    try {
      console.log(`\nTest du thème: ${theme}`)

      // Générer citation
      const citationResponse = await fetch(`${baseUrl}/citations/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, length: "short" }),
      })

      if (!citationResponse.ok) continue

      const citationData = await citationResponse.json()
      const citation = citationData.data

      // Générer image
      const imageResponse = await fetch(`${baseUrl}/images/generate/${citation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: "minimal" }),
      })

      if (imageResponse.ok) {
        const imageData = await imageResponse.json()
        console.log(`✅ ${theme}: ${imageData.data.image.filename}`)
      }
    } catch (error) {
      console.log(`❌ ${theme}: Erreur`)
    }
  }
}

async function testAllTemplates() {
  const templates = ["minimal", "gradient", "modern", "elegant"]
  const baseUrl = "http://localhost:3000/api"

  console.log("\n🎨 Test de tous les templates disponibles")
  console.log("=".repeat(50))

  const testCitation = {
    content: "L'art de vivre consiste à savoir profiter de chaque moment.",
    author: "Test Author",
    theme: "life",
  }

  for (const template of templates) {
    try {
      console.log(`\nTest du template: ${template}`)

      const response = await fetch(`${baseUrl}/images/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citation: testCitation,
          options: { template },
        }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log(`✅ ${template}: ${data.data.image.filename}`)
        console.log(`   URL: http://localhost:3000${data.data.image.url}`)
      }
    } catch (error) {
      console.log(`❌ ${template}: Erreur`)
    }
  }
}

// Exécution selon l'argument
const command = process.argv[2]

switch (command) {
  case "themes":
    testAllThemes()
    break
  case "templates":
    testAllTemplates()
    break
  default:
    testImageGeneration()
}

// Exemple d'utilisation:
// node examples/test-image-generation.js          # Test complet
// node examples/test-image-generation.js themes   # Test tous les thèmes
// node examples/test-image-generation.js templates # Test tous les templates
