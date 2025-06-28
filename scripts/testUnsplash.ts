import dotenv from "dotenv"

dotenv.config()

async function testUnsplash() {
  console.log("🔍 TEST API UNSPLASH")
  console.log("=".repeat(30))

  const accessKey = process.env.UNSPLASH_ACCESS_KEY

  if (!accessKey) {
    console.log("❌ UNSPLASH_ACCESS_KEY manquant")
    return
  }

  console.log(`📋 Clé: ${accessKey.substring(0, 10)}...`)

  try {
    // Test 1: Requête simple sans paramètres
    console.log("\n1️⃣ Test requête simple...")
    const simpleResponse = await fetch("https://api.unsplash.com/photos/random", {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
    })

    console.log(`   Status: ${simpleResponse.status}`)

    if (simpleResponse.ok) {
      const simpleData = await simpleResponse.json()
      console.log(`   ✅ Photo récupérée: ${simpleData.id}`)
      console.log(`   📷 URL: ${simpleData.urls?.small}`)
    } else {
      const errorData = await simpleResponse.json()
      console.log(`   ❌ Erreur: ${JSON.stringify(errorData)}`)
    }

    // Test 2: Requête avec query
    console.log("\n2️⃣ Test avec query 'nature'...")
    const queryResponse = await fetch(
      "https://api.unsplash.com/photos/random?query=nature",
      {
        headers: {
          Authorization: `Client-ID ${accessKey}`,
        },
      }
    )

    console.log(`   Status: ${queryResponse.status}`)

    if (queryResponse.ok) {
      const queryData = await queryResponse.json()
      console.log(`   ✅ Photo nature: ${queryData.id}`)
      console.log(`   📷 URL: ${queryData.urls?.small}`)
    } else {
      const errorData = await queryResponse.json()
      console.log(`   ❌ Erreur: ${JSON.stringify(errorData)}`)
    }

    // Test 3: Vérifier les stats de l'app
    console.log("\n3️⃣ Test des stats de l'application...")
    const statsResponse = await fetch("https://api.unsplash.com/me", {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
    })

    console.log(`   Status: ${statsResponse.status}`)

    if (statsResponse.ok) {
      const statsData = await statsResponse.json()
      console.log(`   ✅ App connectée: ${statsData.username || "OK"}`)
    } else {
      console.log(`   ⚠️  Endpoint /me non disponible avec Client-ID`)
    }
  } catch (error: any) {
    console.error("❌ Erreur réseau:", error.message)
  }

  console.log("\n💡 Solutions si erreur 400:")
  console.log("   • Vérifiez que la clé Unsplash est valide")
  console.log("   • Assurez-vous que l'app Unsplash est en production")
  console.log("   • Vérifiez les quotas (50 requêtes/heure en demo)")
}

testUnsplash()
