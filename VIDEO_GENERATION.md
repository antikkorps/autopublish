# 🎬 Génération de Vidéos AutoPublish

## Vue d'ensemble

AutoPublish peut maintenant générer des vidéos courtes de 30 secondes à partir de vos citations inspirantes. Ces vidéos sont parfaitement adaptées pour les réseaux sociaux comme Instagram Stories/Reels, TikTok, et YouTube Shorts.

## ✨ Fonctionnalités

### 🎥 Types de Vidéos

- **Instagram/TikTok** : Format 9:16 (1080x1920) pour Stories et Reels
- **Square** : Format 1:1 (1080x1080) pour posts carrés
- **Durée personnalisable** : De 10 à 60 secondes

### 🎭 Animations

- **Fade-in** : Apparition progressive du texte
- **Slide-in** : Glissement depuis le bas
- **Typewriter** : Effet machine à écrire caractère par caractère

### 🎨 Fonds

- **Gradient** : Dégradés colorés selon le thème
- **Image** : Photos Unsplash avec overlay semi-transparent
- **Solid** : Couleurs unies

### 🎯 Thèmes Supportés

- motivation, sagesse, amour, success, bonheur
- inspiration, vie, philosophie, parentalite
- education, famille, enfance

## 🚀 Utilisation

### Script de Génération

```bash
# Génération simple (1 vidéo Instagram)
npm run generate-videos

# Génération avec options
npm run generate-videos -- --count 3 --format instagram --animation fade-in

# Vidéo pour TikTok avec effet typewriter
npm run generate-videos -- --format tiktok --animation typewriter --duration 20

# Vidéo carrée pour parentalité
npm run generate-videos -- --theme parentalite --format square --background image

# Mode test (sans sauvegarde en base)
npm run generate-videos -- --count 1 --no-db --animation slide-in
```

### Options Disponibles

| Option         | Description         | Valeurs                       | Défaut     |
| -------------- | ------------------- | ----------------------------- | ---------- |
| `--count`      | Nombre de vidéos    | 1-10                          | 1          |
| `--format`     | Format vidéo        | instagram, tiktok, square     | instagram  |
| `--animation`  | Type d'animation    | fade-in, slide-in, typewriter | fade-in    |
| `--background` | Type de fond        | gradient, image, solid        | gradient   |
| `--duration`   | Durée en secondes   | 10-60                         | 30         |
| `--theme`      | Thème des citations | Voir liste ci-dessus          | motivation |
| `--no-db`      | Pas de sauvegarde   | -                             | false      |

## 🔌 API REST

### Générer une vidéo à partir d'une citation existante

```http
POST /api/videos/generate/:citationId
Authorization: Bearer <token>
Content-Type: application/json

{
  "duration": 30,
  "format": "instagram",
  "animation": "fade-in",
  "background": "gradient",
  "quality": "medium"
}
```

### Générer une vidéo directement

```http
POST /api/videos/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "citation": {
    "content": "Votre citation inspirante ici",
    "author": "Nom de l'auteur",
    "theme": "motivation",
    "hashtags": ["#motivation", "#inspiration"]
  },
  "options": {
    "duration": 30,
    "format": "instagram",
    "animation": "fade-in"
  }
}
```

### Générer plusieurs variations

```http
POST /api/videos/variations/:citationId
Authorization: Bearer <token>
Content-Type: application/json

{
  "options": [
    {
      "format": "instagram",
      "animation": "fade-in"
    },
    {
      "format": "square",
      "animation": "slide-in"
    },
    {
      "format": "tiktok",
      "animation": "typewriter"
    }
  ]
}
```

### Lister les vidéos

```http
GET /api/videos?page=1&limit=10
Authorization: Bearer <token>
```

### Récupérer une vidéo

```http
GET /api/videos/:citationId
Authorization: Bearer <token>
```

## 🔧 Intégration dans le Workflow Quotidien

### Configuration

Pour activer la génération automatique de vidéos dans le workflow quotidien :

```typescript
import { DailyGenerationService } from "./src/services/dailyGenerationService"

const service = new DailyGenerationService({
  generateVideos: true, // Activer la génération de vidéos
  generateImages: true, // Garder les images aussi
  themes: {
    motivation: { count: 2, style: "motivational" },
    parentalite: { count: 1, style: "inspirational" },
    // ... autres thèmes
  },
})

await service.generate()
```

### Statistiques

Le service de génération quotidienne inclut maintenant les statistiques de vidéos :

```typescript
const stats = await service.generate()
console.log(`Vidéos générées: ${stats.withVideos}`)
```

## 📁 Structure des Fichiers

```
public/
└── videos/
    └── generated/
        ├── video-motivation-1234567890.mp4
        ├── video-parentalite-1234567891.mp4
        └── ...

temp/
└── videos/
    ├── frames-1234567890/
    │   ├── frame-000000.png
    │   ├── frame-000001.png
    │   └── ...
    └── video-1234567890.mp4
```

## 🗄️ Base de Données

### Nouveaux Champs dans le Modèle Citation

```sql
ALTER TABLE citations ADD COLUMN video_path VARCHAR(500);
ALTER TABLE citations ADD COLUMN video_metadata JSON;
```

### Exemple de Métadonnées

```json
{
  "duration": 30,
  "format": "instagram",
  "resolution": "1080x1920",
  "size": 183774,
  "theme": "parentalite",
  "animation": "fade-in",
  "background": "gradient"
}
```

## ⚡ Performance

### Optimisations

- **Compression H.264** : Optimisée pour les réseaux sociaux
- **Frames temporaires** : Nettoyage automatique après génération
- **Rate limiting** : 20 requêtes par heure pour éviter la surcharge
- **Cache** : Réutilisation des images Unsplash

### Temps de Génération

- **Vidéo 30s** : ~2-3 minutes
- **Vidéo 15s** : ~1-2 minutes
- **Variations multiples** : Temps proportionnel

## 🔒 Sécurité

### Rate Limiting

- **Génération** : 20 requêtes/heure
- **Variations** : 20 requêtes/heure
- **Authentification** : Requise pour toutes les routes

### Validation

- Durée : 10-60 secondes
- Formats : instagram, tiktok, square
- Animations : fade-in, slide-in, typewriter
- Thèmes : Liste prédéfinie

## 🐛 Dépannage

### Erreurs Communes

1. **FFmpeg non trouvé**

   ```bash
   npm install @ffmpeg-installer/ffmpeg
   ```

2. **Espace disque insuffisant**

   - Vérifiez l'espace dans `/temp/videos/`
   - Les fichiers temporaires sont nettoyés automatiquement

3. **Erreur de génération**
   - Vérifiez les logs pour plus de détails
   - Essayez avec `--no-db` pour tester

### Logs Utiles

```bash
# Voir les logs de génération
npm run generate-videos -- --count 1 --no-db

# Vérifier les fichiers générés
ls -la public/videos/generated/

# Nettoyer les fichiers temporaires
rm -rf temp/videos/
```

## 🎯 Exemples d'Utilisation

### Instagram Stories

```bash
npm run generate-videos -- --format instagram --animation fade-in --duration 30
```

### TikTok

```bash
npm run generate-videos -- --format tiktok --animation typewriter --duration 20
```

### Posts Carrés

```bash
npm run generate-videos -- --format square --background image --animation slide-in
```

### Workflow Automatisé

```bash
# Génération quotidienne avec vidéos
npm run generate:daily

# Test du workflow complet
npm run test:workflow
```

## 🔮 Évolutions Futures

- [ ] Ajout de musique de fond
- [ ] Transitions entre citations
- [ ] Effets visuels avancés
- [ ] Templates personnalisables
- [ ] Intégration YouTube Shorts
- [ ] Génération par lot optimisée

---

🎬 **Prêt à créer des vidéos inspirantes ?** Commencez par `npm run generate-videos -- --help` !
