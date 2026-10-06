#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/.."

watch=false
[ "${1:-}" = "--watch" ] && watch=true

port=$(sed -n 's#^GOOGLE_CALLBACK_URL_WEB=http://localhost:\([0-9]*\)/.*#\1#p' backend/.env 2>/dev/null)
port=${port:-3000}

adb=$(command -v adb || echo "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}/platform-tools/adb")
if [ ! -x "$adb" ]; then
    echo "⚠️  adb introuvable : la connexion Google ne marchera pas sur l'émulateur Android"
    exit 0
fi

while :; do
    devices=$("$adb" devices 2>/dev/null | awk 'NR > 1 && $2 == "device" { print $1 }')
    if [ -z "$devices" ] && ! $watch; then
        echo "⚠️  Aucun appareil Android connecté : lance 'make android-reverse' une fois l'émulateur démarré (connexion Google)"
    fi

    for device in $devices; do
        if $watch && "$adb" -s "$device" reverse --list 2>/dev/null | grep -q " tcp:$port tcp:$port$"; then
            continue
        fi
        if "$adb" -s "$device" reverse "tcp:$port" "tcp:$port" >/dev/null 2>&1; then
            echo "✅ $device : localhost:$port pointe vers le backend (retour de la connexion Google)"
        else
            echo "⚠️  $device : adb reverse tcp:$port a échoué"
        fi
    done

    $watch || break
    sleep 5
done
