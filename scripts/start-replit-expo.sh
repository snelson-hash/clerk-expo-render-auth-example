#!/usr/bin/env sh
set -eu

if [ -z "${CLERK_PUBLISHABLE_KEY:-}" ]; then
  echo "Cannot start the example: add the Clerk Development publishable key as CLERK_PUBLISHABLE_KEY in this separate Replit project's Secrets." >&2
  exit 1
fi

if [ -z "${EXPO_PUBLIC_DOMAIN:-}" ]; then
  echo "Cannot start the example: set EXPO_PUBLIC_DOMAIN to the example Render API hostname (hostname only) in this separate Replit project." >&2
  exit 1
fi

case "$EXPO_PUBLIC_DOMAIN" in
  *://*|*/*|*:* )
    echo "Cannot start the example: EXPO_PUBLIC_DOMAIN must be a hostname only, without scheme, port, or path." >&2
    exit 1
    ;;
esac

if ! (cd mobile && node -e "require.resolve('@expo/ngrok')" >/dev/null 2>&1); then
  echo "Cannot start an iPhone-accessible Metro tunnel: @expo/ngrok is not installed in the mobile project. Add the Expo-compatible tunnel dependency in this isolated example, or run Metro from a machine reachable by the iPhone on the same LAN." >&2
  exit 1
fi

export EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY="$CLERK_PUBLISHABLE_KEY"
cd mobile
exec pnpm exec expo start --dev-client --tunnel --port 3001
