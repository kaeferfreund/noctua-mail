#!/bin/bash
# Regenerates every raster app icon from public/icons/base.svg:
#   public/icons/icon-<size>.png  rounded art with margin (favicons, manifest,
#                                 notification icon, /icons/badged/<size>)
#   public/favicon.png            32 px copy for notification badges
#   public/icons/apple-touch-180.png  opaque full-bleed art: iOS applies its
#                                 own mask and paints transparency black
#   public/icons/icon-96-mono.png white envelope on transparency: Android draws
#                                 notification badges from the alpha channel
# Run from the repository root; needs rsvg-convert (librsvg). After changing
# the art, bump APP_ICON_VERSION in lib/appBranding.ts and sw.js so clients
# fetch the new files instead of their cached copies.
set -euo pipefail

SOURCE="public/icons/base.svg"
BASE_VIEWBOX='viewBox="-100 -100 1800 1800" width="1600" height="1600"'
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if ! command -v rsvg-convert > /dev/null; then
    echo "Error: rsvg-convert (librsvg) is not installed." >&2
    exit 1
fi
if ! grep -q "$BASE_VIEWBOX" "$SOURCE"; then
    echo "Error: $SOURCE must keep $BASE_VIEWBOX." >&2
    exit 1
fi

for size in 16 32 48 64 72 96 128 144 152 180 192 256 512; do
    rsvg-convert -w "$size" -h "$size" "$SOURCE" -o "public/icons/icon-${size}.png"
done
cp public/icons/icon-32.png public/favicon.png

sed -e "s/$BASE_VIEWBOX/viewBox=\"0 0 1600 1600\" width=\"180\" height=\"180\"/" \
    -e 's/ rx="350" ry="350"//' "$SOURCE" > "$TMP/apple.svg"
rsvg-convert -w 180 -h 180 -b "#F37335" "$TMP/apple.svg" -o public/icons/apple-touch-180.png

# Crop to the envelope, hide the background and the grey flap line, and cut
# the flap line out of the white envelope instead.
sed -e "s/$BASE_VIEWBOX/viewBox=\"220 232 1160 1160\" width=\"96\" height=\"96\"/" "$SOURCE" > "$TMP/mono.svg"
cat > "$TMP/mono.css" <<'CSS'
#iconBackground, #envelopeFlapLine { display: none; }
#envelope { fill: #ffffff; filter: none; mask: url(#envelopeFlapCut); }
CSS
rsvg-convert -s "$TMP/mono.css" -w 96 -h 96 "$TMP/mono.svg" -o public/icons/icon-96-mono.png

echo "Generated public/icons/icon-*.png, apple-touch-180.png, icon-96-mono.png and public/favicon.png"
