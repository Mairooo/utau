#!/bin/bash

# Script pour réindexer Meilisearch
# Usage: ./reindex-meilisearch.sh YOUR_ADMIN_TOKEN

TOKEN=$1

if [ -z "$TOKEN" ]; then
  echo "❌ Erreur: Token admin requis"
  echo "Usage: ./reindex-meilisearch.sh YOUR_ADMIN_TOKEN"
  echo ""
  echo "Pour obtenir votre token:"
  echo "1. Connectez-vous à Directus: http://localhost:8055/admin"
  echo "2. Ouvrez la console (F12)"
  echo "3. Exécutez: console.log(localStorage.getItem('directus_access_token'))"
  exit 1
fi

echo "🔄 Réindexation de Meilisearch en cours..."
echo ""

RESPONSE=$(curl -s -X POST http://localhost:8055/search-setup/meilisearch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "$RESPONSE" | python3 -m json.tool

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo ""
  echo "✅ Réindexation réussie!"
else
  echo ""
  echo "❌ Erreur lors de la réindexation"
fi
