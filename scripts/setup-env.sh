#!/usr/bin/env bash
# genere les .env manquants a partir des .env.exemple/.env.example
set -euo pipefail
cd "$(dirname "$0")/.."

found=0
while IFS= read -r -d '' template; do
    found=1
    target="${template%.exemple}"
    target="${target%.example}"
    if [ -f "$target" ]; then
        echo "✓ $target existe déjà"
    else
        cp "$template" "$target"
        echo "✅ $target créé depuis $(basename "$template")"
    fi
done < <(find . -not -path "./node_modules/*" -not -path "*/node_modules/*" \
    \( -name "*.env.exemple" -o -name "*.env.example" \) -print0)

if [ "$found" -eq 0 ]; then
    echo "Aucun template .env.exemple/.env.example trouvé"
fi
