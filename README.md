# AutoPublish - API Instagram avec Génération Automatique de Citations

> 🚀 API REST complète pour la publication automatique de citations inspirantes sur Instagram avec génération IA et système d'authentification JWT.

## 📋 Table des Matières

- [Fonctionnalités](#-fonctionnalités)
- [Technologies](#️-technologies)
- [Installation](#-installation)
- [Configuration](#️-configuration)
- [Utilisation](#-utilisation)
- [Scripts d'Automatisation](#-scripts-dautomatisation)
- [Tests](#-tests)
- [Documentation](#-documentation)
- [Déploiement](#-déploiement)
- [Contribution](#-contribution)

## ✨ Fonctionnalités

### 🔐 Authentification & Sécurité

- Authentification JWT avec tokens d'accès et de rafraîchissement
- Rate limiting intelligent (quotas par utilisateur)
- Validation des données avec Joi
- Gestion des rôles et permissions
- Sécurité renforcée avec helmet et CORS

### 🤖 Génération Automatique IA

- Génération de citations inspirantes via OpenAI/Claude
- 10+ thèmes disponibles (motivation, sagesse, succès, vie, amour...)
- Filtrage qualité automatique
- Génération d'images avec templates personnalisables
- **🎬 Génération de vidéos courtes (30s) pour réseaux sociaux**
- Variations multiples par citation

### 📊 Gestion de Contenu

- CRUD complet pour les citations
- Système de statuts (pending, approved, rejected)
- Métadonnées enrichies (hashtags, scores qualité)
- Historique et traçabilité
- API de recherche et filtrage avancé

### 🔄 Automatisation

- Scripts de génération quotidienne
- Nettoyage automatique des fichiers anciens
- Monitoring et vérifications de santé
- Configuration cron intégrée
- Logs structurés et rotation

## 🛠 Technologies

### Backend

- Node.js + TypeScript
- Express.js avec middleware de sécurité
- Sequelize ORM + PostgreSQL
- JWT pour l'authentification
- Joi pour la validation

### IA & Médias

- OpenAI API pour la génération de texte
- Canvas/Sharp pour la génération d'images
- **FFmpeg pour la génération de vidéos**
- Templates personnalisables
- Optimisation automatique

### Tests & Qualité

- Jest avec couverture complète (100% sur les services)
- Tests unitaires et d'intégration
- Mocks sophistiqués
- CI/CD ready

### DevOps

- Scripts d'automatisation Bash
- Configuration cron
- Logs structurés
- Monitoring intégré

## 🚀 Installation

### Prérequis

- Node.js 18+
- PostgreSQL 12+
- npm ou yarn

### Installation rapide

```bash
# Cloner le projet
git clone https://github.com/votre-username/autopublish.git
cd autopublish

# Installer les dépendances
npm install

# Configurer l'environnement
cp env.example .env
# Éditer .env avec vos configurations

# Initialiser la base de données
npm run db:setup

# Lancer les tests
npm test

# Démarrer en développement
npm run dev
```

## ⚙️ Configuration

### Variables d'environnement

```bash
# Base de données
DATABASE_URL=postgresql://user:password@localhost:5432/autopublish

# JWT
JWT_SECRET=your-super-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key

# IA Services
OPENAI_API_KEY=sk-your-openai-key
CLAUDE_API_KEY=your-claude-key

# Rate Limiting
RATE_LIMIT_DAILY=1000
RATE_LIMIT_HOURLY=100

# Images
IMAGE_STORAGE_PATH=./public/images/generated
```

### Configuration de la génération

Voir `src/services/dailyGenerationService.ts` pour personnaliser :

- Nombre de citations par jour
- Répartition des thèmes
- Seuils de qualité
- Styles de génération

## 📖 Utilisation

### API Endpoints

```bash
# Authentification
POST /api/auth/register    # Inscription
POST /api/auth/login       # Connexion
POST /api/auth/refresh     # Renouveler le token

# Citations
GET    /api/citations      # Lister les citations
POST   /api/citations      # Créer une citation
GET    /api/citations/:id  # Détails d'une citation
PUT    /api/citations/:id  # Modifier une citation
DELETE /api/citations/:id  # Supprimer une citation

# Génération
POST /api/citations/generate  # Générer via IA
POST /api/images/generate     # Générer des images
POST /api/videos/generate     # Générer des vidéos
```

### Exemple d'utilisation

```javascript
// Générer une citation
const response = await fetch("/api/citations/generate", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    theme: "motivation",
    count: 3,
    style: "inspirational",
  }),
})
```

## 🤖 Scripts d'Automatisation

### Génération quotidienne

```bash
# Génération manuelle
npm run generate:daily

# Avec options
npm run generate:daily -- --count 20 --no-images --quality 0.8

# Configuration cron automatique
npm run cron:setup
```

### 🎨 Génération d'Images Manuelle

Le script `generate-images` permet de créer des images avec citations de façon interactive :

```bash
# Génération simple (1 image avec template photo)
npm run generate-images

# Afficher l'aide complète
npm run generate-images -- --help

# Générer sans sauvegarder en base de données
npm run generate-images -- --no-db

# Générer 5 images avec template minimal
npm run generate-images -- --count 5 --template minimal

# Thème sagesse avec template elegant
npm run generate-images -- --theme sagesse --template elegant

# Mode test : 3 images sans base de données
npm run generate-images -- --count 3 --no-db --template photo
```

### 🎬 Génération de Vidéos Manuelle

Le script `generate-videos` permet de créer des vidéos courtes avec citations :

```bash
# Génération simple (1 vidéo Instagram)
npm run generate-videos

# Afficher l'aide complète
npm run generate-videos -- --help

# Vidéo TikTok avec effet typewriter
npm run generate-videos -- --format tiktok --animation typewriter

# Vidéo carrée pour parentalité
npm run generate-videos -- --theme parentalite --format square

# Mode test : 1 vidéo sans base de données
npm run generate-videos -- --count 1 --no-db --animation slide-in
```

**Options disponibles :**

- `--count <nombre>` : Nombre d'images (1-20, défaut: 1)
- `--template <nom>` : Template à utiliser (minimal, gradient, photo, modern, elegant)
- `--theme <nom>` : Thème des citations (motivation, sagesse, amour, success, bonheur, inspiration, vie, philosophie)
- `--no-db` : Ne pas sauvegarder en base de données
- `--help` : Afficher l'aide détaillée

**Themes disponibles :**

- "parentalite",
- "parent",
- "enfants",
- "famille",
- "education",
- "elever",
- "maternite",

**exemple de commande :**

```bash
npm run generate-images -- --theme parentalite --template photo --count 2 --no-db
```

**Workflow du script :**

1. 🤖 **IA génère** une citation sur le thème choisi (OpenAI)
2. 🖼️ **Unsplash** fournit une image de fond (si template "photo")
3. 🎨 **Création** de l'image finale avec citation superposée
4. 💾 **Sauvegarde** du fichier dans `public/images/generated/`
5. 📊 **Optionnel** : Enregistrement en base de données

**Cas d'usage :**

- **Test rapide** : `--no-db` pour tester templates/thèmes
- **Production de contenu** : Génération en lot avec sauvegarde BDD
- **Prototypage** : Essayer différents styles visuels
- **Contenu personnalisé** : Créer des variations pour des thèmes spécifiques

### Diagnostic et Tests

```bash
# Diagnostic complet du système
npm run diagnostic

# Test du workflow complet
npm run test:workflow
```

### Maintenance

```bash
# Nettoyage des images anciennes
node scripts/cleanupImages.ts --max-age 7

# Vérification de santé
node scripts/healthCheck.ts

# Réinitialisation base de données
node scripts/resetDb.ts
```

## 🧪 Tests

```bash
# Tous les tests
npm test

# Tests avec couverture
npm run test:coverage

# Tests spécifiques
npm run test:generation    # Tests du service de génération
npm run test:auth         # Tests d'authentification
npm run test:api          # Tests d'API

# Tests en mode watch
npm run test:watch
```

### Couverture actuelle

- **Services** : 100% (dailyGenerationService)
- **Controllers** : 95%+
- **Middleware** : 90%+
- **Global** : 85%+

## 📚 Documentation

- **[README-AUTOMATION.md](README-AUTOMATION.md)** - Guide complet des scripts d'automatisation
- **[README-IMAGE-GENERATION.md](README-IMAGE-GENERATION.md)** - Documentation de la génération d'images
- **API Documentation** - Swagger UI disponible sur `/api-docs`

## 🚀 Déploiement

### Docker (recommandé)

```bash
# Build
docker build -t autopublish .

# Run
docker-compose up -d
```

### Déploiement manuel

```bash
# Build production
npm run build

# Variables d'environnement de production
export NODE_ENV=production
export DATABASE_URL=your-prod-db-url

# Démarrer
npm start
```

### Configuration cron en production

```bash
# Installer les tâches cron
./scripts/setupCron.sh

# Vérifier les tâches
crontab -l
```

## 📊 Monitoring

### Logs

```bash
# Logs de génération
tail -f logs/daily-generation.log

# Logs d'erreurs
tail -f logs/error.log

# Logs de nettoyage
tail -f logs/cleanup.log
```

### Métriques

- Taux de réussite de génération
- Temps de réponse API
- Utilisation des quotas
- Espace disque (images)

## 🤝 Contribution

### Workflow de développement

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/amazing-feature`)
3. Commit vos changements (`git commit -m 'Add amazing feature'`)
4. Push sur la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

### Standards de code

- TypeScript strict
- ESLint + Prettier
- Tests obligatoires pour les nouvelles fonctionnalités
- Documentation des APIs

### Roadmap

- [ ] Intégration Instagram API
- [ ] Interface d'administration web
- [ ] Support multi-langues
- [ ] Analytics avancées
- [ ] Déploiement Docker
- [ ] CI/CD GitHub Actions

## 📄 Licence

MIT License - voir [LICENSE](LICENSE) pour plus de détails.

## 👥 Équipe

- **Développeur Principal** : [Votre nom]
- **Contributions** : Voir [CONTRIBUTORS.md](CONTRIBUTORS.md)

## 🔗 Liens utiles

- [Issues](https://github.com/votre-username/autopublish/issues)
- [Discussions](https://github.com/votre-username/autopublish/discussions)
- [Wiki](https://github.com/votre-username/autopublish/wiki)

---

**⭐ Si ce projet vous aide, n'hésitez pas à lui donner une étoile !**
