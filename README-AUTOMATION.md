# 🤖 AutoPublish - Scripts d'Automatisation

Ce guide détaille l'utilisation des scripts de génération automatique de citations pour AutoPublish.

## 📋 Vue d'ensemble

Le système d'automatisation comprend 4 scripts principaux :

- **`generateDaily.ts`** : Génération quotidienne de citations
- **`testGeneration.ts`** : Test rapide du système de génération
- **`cleanupImages.ts`** : Nettoyage automatique des anciennes images
- **`healthCheck.ts`** : Vérification de santé du système

## 🚀 Installation et Configuration

### 1. Configuration des Variables d'Environnement

Créez un fichier `.env` avec les clés API nécessaires :

```bash
# Clés API pour la génération de citations
OPENAI_API_KEY=sk-your-openai-key-here
CLAUDE_API_KEY=sk-ant-your-claude-key-here

# Configuration base de données
DATABASE_URL=your-database-url
```

### 2. Installation des Dépendances

```bash
npm install
```

## 📝 Scripts Disponibles

### Génération Quotidienne

```bash
# Génération avec configuration par défaut
npm run generate:daily

# Ou directement
node --import tsx scripts/generateDaily.ts

# Avec options personnalisées
node --import tsx scripts/generateDaily.ts --count 5 --no-images --quality 0.7
```

**Configuration par défaut :**

- 10 citations par jour
- 5 thèmes (motivation, wisdom, success, life, love)
- Score qualité minimum : 0.6
- Génération d'images activée
- Langue : français

**Options disponibles :**

- `--count <nombre>` : Nombre total de citations
- `--no-images` : Désactiver la génération d'images
- `--quality <score>` : Score qualité minimum (0-1)
- `--lang <code>` : Langue (fr, en, es, de, it)

### Test de Génération

```bash
# Test rapide avec 3 citations
npm run generate:test
```

Configuration de test :

- 3 citations (2 motivation + 1 wisdom)
- Score qualité : 0.5
- Pas de génération d'images
- Exécution rapide

### Nettoyage des Images

```bash
# Nettoyage des images de plus de 7 jours
node --import tsx scripts/cleanupImages.ts

# Personnaliser la durée de rétention
node --import tsx scripts/cleanupImages.ts --max-age 48  # 48 heures
```

### Vérification de Santé

```bash
# Vérification complète du système
node --import tsx scripts/healthCheck.ts
```

Vérifie :

- ✅ Connexion base de données
- ✅ Clés API configurées
- ✅ Espace disque disponible
- ✅ Génération récente (48h)
- ✅ Dossiers d'images

## ⏰ Configuration Cron

### Installation Automatique

```bash
# Configuration automatique des tâches cron
npm run cron:setup
```

### Configuration Manuelle

```bash
# Éditer les tâches cron
crontab -e

# Ajouter ces lignes :
# Génération quotidienne à 6h
0 6 * * * cd /path/to/autopublish && node --import tsx scripts/generateDaily.ts >> logs/daily-generation.log 2>&1

# Nettoyage hebdomadaire le dimanche à 2h
0 2 * * 0 cd /path/to/autopublish && node --import tsx scripts/cleanupImages.ts >> logs/cleanup.log 2>&1

# Vérification de santé quotidienne à 23h
0 23 * * * cd /path/to/autopublish && node --import tsx scripts/healthCheck.ts >> logs/health.log 2>&1
```

## 📊 Monitoring et Logs

### Emplacements des Logs

```bash
logs/
├── daily-generation.log    # Logs de génération quotidienne
├── cleanup.log            # Logs de nettoyage
└── health.log             # Logs de vérification santé
```

### Surveillance des Logs

```bash
# Suivre les logs en temps réel
tail -f logs/daily-generation.log

# Voir les dernières générations
tail -20 logs/daily-generation.log

# Rechercher des erreurs
grep "❌" logs/daily-generation.log
```

### Statistiques Typiques

```
📊 STATISTIQUES DE GÉNÉRATION QUOTIDIENNE
==================================================
✅ Citations générées par l'IA: 12
💾 Citations sauvées en base: 10
🖼️  Citations avec images: 10
❌ Échecs: 2
📈 Taux de réussite: 83%
==================================================
```

## 🛠️ Personnalisation

### Modifier la Configuration par Défaut

Éditez `scripts/generateDaily.ts` :

```typescript
const DEFAULT_CONFIG: DailyConfig = {
  totalCitations: 15, // Plus de citations
  themes: {
    motivation: { count: 5, style: "motivational" },
    success: { count: 3, style: "practical" },
    wisdom: { count: 3, style: "philosophical" },
    life: { count: 2, style: "inspirational" },
    love: { count: 2, style: "inspirational" },
  },
  language: "fr",
  minQualityScore: 0.7, // Qualité plus élevée
  generateImages: true,
}
```

### Ajouter de Nouveaux Thèmes

Les thèmes disponibles dans `src/models/Citation.ts` :

- motivation
- success
- love
- life
- wisdom
- happiness
- inspiration
- leadership
- mindfulness
- creativity

### Styles de Citations

- `motivational` : Ton dynamique et énergique
- `philosophical` : Approche réflexive et profonde
- `practical` : Conseils concrets et applicables
- `inspirational` : Messages élevants et transcendants

## 🚨 Dépannage

### Erreurs Communes

**401 Unauthorized**

```bash
❌ Erreur pour le thème motivation: Error: OpenAI API error: 401 Unauthorized
```

→ Vérifier les clés API dans `.env`

**Erreur de base de données**

```bash
❌ Erreur de connexion: Connection refused
```

→ Vérifier que PostgreSQL est démarré et accessible

**Espace disque insuffisant**

```bash
❌ Problème d'espace disque: ENOSPC
```

→ Lancer le nettoyage : `node --import tsx scripts/cleanupImages.ts`

### Commandes de Diagnostic

```bash
# Vérifier l'état du système
node --import tsx scripts/healthCheck.ts

# Tester la génération sans sauvegarder
npm run generate:test

# Vérifier les logs récents
tail -50 logs/daily-generation.log

# Voir l'espace disque utilisé
du -sh public/images/generated/
```

## 📈 Optimisation

### Performance

- **Génération par lots** : Le script traite les thèmes séquentiellement
- **Gestion d'erreurs** : Échec d'un thème n'arrête pas les autres
- **Filtrage qualité** : Seules les citations de qualité sont sauvées

### Économie d'API

- **Score qualité minimum** : Évite de sauver des citations médiocres
- **Fallback providers** : Bascule automatique OpenAI ↔ Claude
- **Gestion des quotas** : Arrêt propre en cas de limite atteinte

### Stockage

- **Nettoyage automatique** : Suppression des anciennes images
- **Optimisation images** : Compression PNG avec Sharp
- **Métadonnées** : Tracking des variations et templates

## 🔄 Workflow Recommandé

1. **Test initial** : `npm run generate:test`
2. **Configuration cron** : `npm run cron:setup`
3. **Surveillance** : `tail -f logs/daily-generation.log`
4. **Vérification hebdomadaire** : Consulter les statistiques
5. **Maintenance mensuelle** : Ajuster la configuration selon les résultats

## 🎯 Prochaines Étapes

Avec ces scripts en place, vous avez maintenant :

- ✅ Génération automatique de citations
- ✅ Système de monitoring
- ✅ Nettoyage automatique
- ✅ Configuration cron prête

**Étapes suivantes suggérées :**

1. Intégration Instagram API pour publication automatique
2. Dashboard de monitoring web
3. Alertes par email/Slack
4. Métriques avancées et analytics
