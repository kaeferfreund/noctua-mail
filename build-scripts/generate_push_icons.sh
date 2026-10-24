#!/bin/bash
# Derives the iOS touch icon and the monochrome notification badge from
# public/icons/base.svg. Run from the repository root; needs rsvg-convert.
set -euo pipefail

SOURCE="public/icons/base.svg"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Opaque, square, full-bleed art: iOS applies its own mask and paints
# transparent pixels black.
sed -e 's/viewBox="-100 -100 1800 1800" width="1600" height="1600"/viewBox="0 0 1600 1600" width="180" height="180"/' \
    -e 's/ rx="350" ry="350"//' "$SOURCE" > "$TMP/apple.svg"
rsvg-convert -w 180 -h 180 -b "#F37335" "$TMP/apple.svg" -o public/icons/apple-touch-180.png

# White silhouette on transparency: Android renders notification badges from
# the alpha channel only.
sed -e 's/viewBox="-100 -100 1800 1800" width="1600" height="1600"/viewBox="270 270 1060 1060" width="96" height="96"/' \
    -e '/<rect /d' -e 's/fill="#3f5b69"/fill="#ffffff"/' "$SOURCE" > "$TMP/mono.svg"
rsvg-convert -w 96 -h 96 "$TMP/mono.svg" -o public/icons/icon-96-mono.png

echo "Generated public/icons/apple-touch-180.png and public/icons/icon-96-mono.png"
