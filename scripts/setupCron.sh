#!/bin/bash

# Script de configuration des tâches cron pour AutoPublish
# Usage: ./scripts/setupCron.sh

echo "🔧 Configuration des tâches cron pour AutoPublish"

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Obtenir le répertoire du projet
PROJECT_DIR=$(pwd)
SCRIPTS_DIR="$PROJECT_DIR/scripts"

echo "📁 Répertoire du projet: $PROJECT_DIR"

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ] || [ ! -d "scripts" ]; then
    echo -e "${RED}❌ Erreur: Ce script doit être exécuté depuis la racine du projet AutoPublish${NC}"
    exit 1
fi

# Vérifier que Node.js et npm sont installés
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js n'est pas installé${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm n'est pas installé${NC}"
    exit 1
fi

# Vérifier que ts-node est installé
if ! command -v npx ts-node &> /dev/null; then
    echo -e "${YELLOW}⚠️  ts-node n'est pas installé globalement, utilisation via npx${NC}"
fi

# Créer le fichier de configuration cron
CRON_FILE="/tmp/autopublish_cron"

cat > "$CRON_FILE" << EOF
# AutoPublish - Génération automatique de citations
# Généré automatiquement le $(date)

# Variables d'environnement
PATH=/usr/local/bin:/usr/bin:/bin
NODE_PATH=$PROJECT_DIR/node_modules

# Génération quotidienne de citations à 6h du matin
0 6 * * * cd $PROJECT_DIR && npx ts-node scripts/generateDaily.ts >> logs/daily-generation.log 2>&1

# Nettoyage des anciennes images tous les dimanche à 2h
0 2 * * 0 cd $PROJECT_DIR && npx ts-node scripts/cleanupImages.ts >> logs/cleanup.log 2>&1

# Test de santé du système tous les jours à 23h
0 23 * * * cd $PROJECT_DIR && npx ts-node scripts/healthCheck.ts >> logs/health.log 2>&1

EOF

echo "📋 Configuration cron générée:"
echo "----------------------------------------"
cat "$CRON_FILE"
echo "----------------------------------------"

# Créer le répertoire de logs
mkdir -p "$PROJECT_DIR/logs"

# Demander confirmation avant d'installer
echo ""
read -p "Voulez-vous installer cette configuration cron ? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Sauvegarder la crontab existante
    crontab -l > /tmp/crontab_backup_$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
    
    # Installer la nouvelle configuration
    crontab "$CRON_FILE"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Configuration cron installée avec succès!${NC}"
        echo ""
        echo "📅 Tâches programmées:"
        echo "  • Génération quotidienne: 6h00"
        echo "  • Nettoyage des images: Dimanche 2h00"
        echo "  • Vérification santé: 23h00"
        echo ""
        echo "📁 Logs disponibles dans: $PROJECT_DIR/logs/"
        echo ""
        echo "🔍 Pour voir les tâches cron actives:"
        echo "  crontab -l"
        echo ""
        echo "🗑️  Pour supprimer les tâches cron:"
        echo "  crontab -r"
    else
        echo -e "${RED}❌ Erreur lors de l'installation de la configuration cron${NC}"
        exit 1
    fi
else
    echo "❌ Installation annulée"
    echo ""
    echo "💡 Pour installer manuellement:"
    echo "  crontab $CRON_FILE"
fi

# Nettoyer le fichier temporaire
rm -f "$CRON_FILE"

echo ""
echo "🎯 Prochaines étapes recommandées:"
echo "  1. Vérifier les variables d'environnement (.env)"
echo "  2. Tester la génération: npm run test:generation"
echo "  3. Surveiller les logs: tail -f logs/daily-generation.log" 