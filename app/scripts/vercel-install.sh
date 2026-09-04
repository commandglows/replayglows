#!/bin/bash
set -euo pipefail

FLUTTER_VERSION="${FLUTTER_VERSION:-3.47.1}"
CACHE_ROOT="${VERCEL_CACHE_DIR:-.vercel/cache}"
FLUTTER_SDK_DIR="$CACHE_ROOT/flutter-$FLUTTER_VERSION"
PUB_CACHE_DIR="$CACHE_ROOT/pub-cache"

mkdir -p "$CACHE_ROOT" "$PUB_CACHE_DIR"

if [ ! -x "$FLUTTER_SDK_DIR/bin/flutter" ]; then
  rm -rf "$FLUTTER_SDK_DIR"
  git clone \
    --depth 1 \
    --branch "$FLUTTER_VERSION" \
    https://github.com/flutter/flutter.git \
    "$FLUTTER_SDK_DIR"
else
  echo "Using cached Flutter SDK at $FLUTTER_SDK_DIR"
fi

ln -sfn "$FLUTTER_SDK_DIR" flutter

export PUB_CACHE="$PUB_CACHE_DIR"
"$FLUTTER_SDK_DIR/bin/flutter" pub get
"$FLUTTER_SDK_DIR/bin/flutter" precache --web
