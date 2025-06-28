import Citation from "@/models/Citation"
import aiService from "@/services/aiService"
import { DailyGenerationService } from "@/services/dailyGenerationService"
import imageService from "@/services/imageService"
import dotenv from "dotenv"
import { Op } from "sequelize"

dotenv.config()

async function diagnosticComplet() {
  console.log("🔍 DIAGNOSTIC COMPLET - AutoPublish")
  console.log("=".repeat(60))
  console.log("Test de toutes les fonctionnalités du système")

  const results = {
    openai: false,
    unsplash: false,
    instagram: false,
    workflow: false,
    details: {} as any,
  }

  try {
    // 1. CONFIGURATION
    console.log("\n1️⃣ VÉRIFICATION DE LA CONFIGURATION")
    console.log("-".repeat(40))

    const hasOpenAI = !!process.env.OPENAI_API_KEY
    const hasUnsplash = !!process.env.UNSPLASH_ACCESS_KEY
    const hasInstagram =
      !!process.env.INSTAGRAM_ACCESS_TOKEN && !!process.env.INSTAGRAM_ACCOUNT_ID

    console.log(`   OpenAI API Key: ${hasOpenAI ? "✅ Configuré" : "❌ Manquant"}`)
    console.log(`   Unsplash Key: ${hasUnsplash ? "✅ Configuré" : "❌ Manquant"}`)
    console.log(`   Instagram Token: ${hasInstagram ? "✅ Configuré" : "❌ Manquant"}`)

    // 2. TEST OPENAI
    console.log("\n2️⃣ TEST OPENAI (GÉNÉRATION IA)")
    console.log("-".repeat(40))

    if (hasOpenAI) {
      try {
        const citations = await aiService.generateCitations(
          {
            theme: "test",
            language: "fr",
            count: 1,
            style: "motivational",
          },
          "openai"
        )

        if (citations.length > 0) {
          console.log("   ✅ OpenAI fonctionne parfaitement")
          console.log(
            `   📝 Citation générée: "${citations[0].content.substring(0, 50)}..."`
          )
          console.log(`   ⭐ Score qualité: ${citations[0].quality_score}`)
          results.openai = true
          results.details.openai = citations[0]
        } else {
          console.log("   ❌ OpenAI ne génère pas de citations")
        }
      } catch (error: any) {
        console.log("   ❌ Erreur OpenAI:", error.message)
      }
    } else {
      console.log("   ⚠️  OpenAI non configuré - test ignoré")
    }

    // 3. TEST UNSPLASH
    console.log("\n3️⃣ TEST UNSPLASH (GÉNÉRATION D'IMAGES)")
    console.log("-".repeat(40))

    if (hasUnsplash && results.openai) {
      try {
        const testCitation = results.details.openai
        const images = await imageService.generateVariations(testCitation, ["minimal"])

        if (images.length > 0) {
          console.log("   ✅ Unsplash fonctionne parfaitement")
          console.log(`   🖼️  ${images.length} image(s) générée(s)`)
          console.log(`   📁 Fichier: ${images[0].filename}`)
          results.unsplash = true
          results.details.unsplash = images[0]
        } else {
          console.log("   ❌ Unsplash ne génère pas d'images")
        }
      } catch (error: any) {
        console.log("   ❌ Erreur Unsplash:", error.message)
      }
    } else {
      console.log("   ⚠️  Unsplash non configuré ou OpenAI requis - test ignoré")
    }

    // 4. TEST INSTAGRAM
    console.log("\n4️⃣ TEST INSTAGRAM (API CONNEXION)")
    console.log("-".repeat(40))

    if (hasInstagram) {
      const token = process.env.INSTAGRAM_ACCESS_TOKEN!
      const accountId = process.env.INSTAGRAM_ACCOUNT_ID!

      console.log(
        `   📋 Token format: ${
          token.startsWith("EAA")
            ? "✅ Facebook"
            : token.startsWith("IGAA")
            ? "❌ Instagram (utiliser Facebook)"
            : "❓ Inconnu"
        }`
      )
      console.log(`   📋 Account ID: ${accountId.substring(0, 10)}...`)

      // Test de base du token
      try {
        const response = await fetch(
          `https://graph.facebook.com/v21.0/me?access_token=${token}`
        )
        const data = await response.json()

        if (response.ok) {
          console.log("   ✅ Token Facebook valide")
          console.log(`   👤 Nom: ${data.name}`)

          // Test des permissions
          const debugResponse = await fetch(
            `https://graph.facebook.com/debug_token?input_token=${token}&access_token=${token}`
          )
          const debugData = await debugResponse.json()

          if (debugResponse.ok && debugData.data) {
            const scopes = debugData.data.scopes || []
            const requiredScopes = [
              "pages_show_list",
              "pages_read_engagement",
              "instagram_basic",
            ]

            console.log("   📋 Permissions:")
            requiredScopes.forEach((scope) => {
              const hasScope = scopes.includes(scope)
              console.log(`      ${hasScope ? "✅" : "❌"} ${scope}`)
            })

            // Test des pages
            const pagesResponse = await fetch(
              `https://graph.facebook.com/v21.0/me/accounts?access_token=${token}`
            )
            const pagesData = await pagesResponse.json()

            if (pagesResponse.ok && pagesData.data) {
              console.log(`   📄 Pages Facebook: ${pagesData.data.length}`)

              if (pagesData.data.length > 0) {
                for (const page of pagesData.data) {
                  console.log(`      📄 ${page.name}`)

                  // Chercher Instagram lié
                  const instagramResponse = await fetch(
                    `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
                  )
                  const instagramData = await instagramResponse.json()

                  if (instagramData.instagram_business_account) {
                    const igId = instagramData.instagram_business_account.id
                    console.log(`         🔗 Instagram lié: ${igId}`)

                    if (igId === accountId) {
                      console.log("         ✅ Correspond à votre ACCOUNT_ID !")
                      results.instagram = true
                      results.details.instagram = {
                        pageToken: page.access_token,
                        accountId: igId,
                        pageName: page.name,
                      }
                    }
                  }
                }

                if (!results.instagram) {
                  console.log("   ⚠️  Aucun compte Instagram correspondant trouvé")
                }
              } else {
                console.log("   ❌ Aucune page Facebook accessible")
                console.log("   💡 Vérifiez que vous êtes admin de la page")
              }
            } else {
              console.log(
                "   ❌ Impossible d'accéder aux pages:",
                pagesData.error?.message
              )
            }
          }
        } else {
          console.log("   ❌ Token invalide:", data.error?.message)
        }
      } catch (error: any) {
        console.log("   ❌ Erreur test Instagram:", error.message)
      }
    } else {
      console.log("   ⚠️  Instagram non configuré - test ignoré")
    }

    // 5. TEST WORKFLOW COMPLET
    console.log("\n5️⃣ TEST WORKFLOW COMPLET")
    console.log("-".repeat(40))

    if (results.openai && results.unsplash) {
      try {
        console.log("   🚀 Test du workflow Citation → Image → Post...")

        const config = {
          totalCitations: 1,
          themes: { motivation: { count: 1, style: "motivational" as const } },
          language: "fr" as const,
          minQualityScore: 0.5,
          generateImages: true,
          publishToInstagram: false, // Pas de publication pour le test
        }

        const generationService = new DailyGenerationService(config)
        const workflowResults = await generationService.generate()

        if (workflowResults.saved > 0 && workflowResults.withImages > 0) {
          console.log("   ✅ Workflow complet fonctionne parfaitement")
          console.log(`   📝 Citations: ${workflowResults.saved}`)
          console.log(`   🖼️  Images: ${workflowResults.withImages}`)
          results.workflow = true

          // Récupérer la dernière citation créée
          const lastCitation = await Citation.findOne({
            where: {
              generated_at: {
                [Op.gte]: new Date(Date.now() - 60000),
              },
            },
            order: [["generated_at", "DESC"]],
          })

          if (lastCitation) {
            results.details.workflow = {
              citation: lastCitation.content,
              author: lastCitation.author,
              imagePath: lastCitation.imagePath,
              score: lastCitation.quality_score,
            }
          }
        } else {
          console.log("   ❌ Workflow incomplet")
        }
      } catch (error: any) {
        console.log("   ❌ Erreur workflow:", error.message)
      }
    } else {
      console.log("   ⚠️  Workflow nécessite OpenAI + Unsplash - test ignoré")
    }

    // 6. RÉSUMÉ FINAL
    console.log("\n" + "=".repeat(60))
    console.log("📊 RÉSUMÉ DU DIAGNOSTIC")
    console.log("=".repeat(60))

    const totalTests = 4
    const passedTests = [
      results.openai,
      results.unsplash,
      results.instagram,
      results.workflow,
    ].filter(Boolean).length

    console.log(`🎯 Tests réussis: ${passedTests}/${totalTests}`)
    console.log(`📈 Taux de réussite: ${Math.round((passedTests / totalTests) * 100)}%`)

    console.log("\n📋 ÉTAT DES SERVICES:")
    console.log(`   OpenAI (IA): ${results.openai ? "✅ FONCTIONNEL" : "❌ PROBLÈME"}`)
    console.log(
      `   Unsplash (Images): ${results.unsplash ? "✅ FONCTIONNEL" : "❌ PROBLÈME"}`
    )
    console.log(
      `   Instagram (API): ${results.instagram ? "✅ FONCTIONNEL" : "❌ PROBLÈME"}`
    )
    console.log(
      `   Workflow complet: ${results.workflow ? "✅ FONCTIONNEL" : "❌ PROBLÈME"}`
    )

    if (results.workflow) {
      console.log("\n🏆 SUCCÈS: Votre AutoPublish fonctionne !")
      console.log("   Citation + Image + Post = Prêt pour publication")

      if (results.details.workflow) {
        console.log("\n📝 DERNIER POST GÉNÉRÉ:")
        console.log(`   Citation: "${results.details.workflow.citation}"`)
        console.log(`   Auteur: ${results.details.workflow.author}`)
        console.log(`   Score: ${results.details.workflow.score}`)
        if (results.details.workflow.imagePath) {
          console.log(`   Image: ${results.details.workflow.imagePath}`)
        }
      }
    }

    if (results.instagram) {
      console.log("\n🎉 BONUS: Instagram API prête pour publication automatique !")
    } else if (hasInstagram) {
      console.log("\n💡 INSTAGRAM: Configuration à ajuster")
      console.log("   1. Vérifiez que l'app Facebook est 'Live'")
      console.log("   2. Assurez-vous d'être admin de la page Facebook")
      console.log("   3. Utilisez un token Facebook (EAA...) pas Instagram (IGAA...)")
    }

    console.log("\n🚀 PROCHAINES ÉTAPES:")
    if (!results.openai) console.log("   • Configurer OpenAI API Key")
    if (!results.unsplash) console.log("   • Configurer Unsplash Access Key")
    if (!results.instagram && hasInstagram)
      console.log("   • Corriger la configuration Instagram")
    if (results.workflow) console.log("   • Votre système est prêt pour la production !")
  } catch (error: any) {
    console.error("❌ Erreur générale:", error.message)
  }
}

diagnosticComplet()
