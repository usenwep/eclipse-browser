#!/usr/bin/env bash
set -euo pipefail

BINARY=$(find src-tauri/target -maxdepth 5 -name "eclipse-browser" \
  -path "*/release/eclipse-browser" ! -path "*/build/*" | head -1)
[[ -z "$BINARY" ]] && { echo "No binary found" >&2; exit 1; }

VERSION=$(grep '^version' src-tauri/Cargo.toml | head -1 | sed 's/version = "\(.*\)"/\1/')

case "$BINARY" in
  *x86_64*)  ARCH=x86_64  ;;
  *aarch64*) ARCH=aarch64 ;;
  *)         ARCH=$(uname -m) ;;
esac

BUNDLE_DIR="$(dirname "$BINARY")/bundle"
mkdir -p "$BUNDLE_DIR"

TARNAME="eclipse-browser_${VERSION}_linux_${ARCH}.tar.gz"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

mkdir "$TMPDIR/eclipse-browser"
cp "$BINARY" "$TMPDIR/eclipse-browser/"

tar -czf "$BUNDLE_DIR/$TARNAME" -C "$TMPDIR" eclipse-browser

echo "Created: $BUNDLE_DIR/$TARNAME"
