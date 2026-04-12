#!/bin/bash
set -euo pipefail

REPO="descope/descope-kotlin"
SDK_SRC="descopesdk/src/main/java/com/descope"
SDK_MANIFEST="descopesdk/src/main/AndroidManifest.xml"
TARGET_DIR="android/src/main/java/com/descope"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

# Resolve version: argument or latest release
if [ -n "${1:-}" ]; then
  VERSION="$1"
else
  VERSION=$(gh api "repos/$REPO/releases/latest" --jq '.tag_name')
fi

echo "Fetching descope-kotlin $VERSION"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

gh api "repos/$REPO/tarball/$VERSION" > "$TMPDIR/sdk.tar.gz"
tar -xzf "$TMPDIR/sdk.tar.gz" -C "$TMPDIR" --strip-components=1

# Replace vendored sources
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
cp -r "$TMPDIR/$SDK_SRC/"* "$TARGET_DIR/"

# Update manifest with SDK requirements
cp "$TMPDIR/$SDK_MANIFEST" "$TMPDIR/sdk-manifest.xml"
echo ""
echo "SDK version: $VERSION"
echo "Sources copied to: $TARGET_DIR"
echo ""
echo "Review $TMPDIR/sdk-manifest.xml for permissions/activities"
echo "that may need merging into android/src/main/AndroidManifest.xml"

# Print the SDK manifest for reference
echo ""
echo "=== SDK AndroidManifest.xml ==="
cat "$TMPDIR/sdk-manifest.xml"
