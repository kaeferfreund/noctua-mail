#!/usr/bin/env python3
"""Generate committed Inter assets from the original Inter 4.1 upright WOFF2.

nice -n 10 uv run --with fonttools==4.67.0 --with brotli==1.2.1 \
    python build-scripts/subset-fonts.py /path/to/InterVariable.woff2
No network is used by this script or by the application build.
"""

import hashlib
import json
from pathlib import Path
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SHA = "693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def points(*ranges):
    return {cp for start, end in ranges for cp in range(start, end + 1)}


def unicode_range(codepoints):
    runs = []
    for cp in sorted(codepoints):
        if runs and cp == runs[-1][1] + 1:
            runs[-1][1] = cp
        else:
            runs.append([cp, cp])
    return ",".join(f"U+{a:X}" if a == b else f"U+{a:X}-{b:X}" for a, b in runs)


def cmap(font):
    return {cp for table in font["cmap"].tables if table.isUnicode() for cp in table.cmap}


def axes(font):
    return [(a.axisTag, a.minValue, a.defaultValue, a.maxValue) for a in font["fvar"].axes]


source = Path(sys.argv[1])
assert sha(source) == SOURCE_SHA, "Expected the unmodified Inter 4.1 upright WOFF2"
original = TTFont(source)
original_points = cmap(original)
original_axes = axes(original)
assert {a[0] for a in original_axes} == {"wght", "opsz"}

# Common Latin punctuation stays in Latin. Assign Vietnamese before Latin-ext
# so shared Latin-extension letters occur in exactly one file. The remainder
# is computed from the original cmap, never from an assumed Unicode ceiling.
latin = points((0, 0xFF), (0x2000, 0x206F)) | {
    0x131, 0x152, 0x153, 0x2BB, 0x2BC, 0x2C6, 0x2DA, 0x2DC,
    0x304, 0x308, 0x329, 0x20AC, 0x2122, 0x2191, 0x2193,
    0x2212, 0x2215, 0xFEFF, 0xFFFD,
}
vietnamese = points((0x1EA0, 0x1EF9)) | {
    0x102, 0x103, 0x110, 0x111, 0x128, 0x129, 0x168, 0x169,
    0x1A0, 0x1A1, 0x1AF, 0x1B0, 0x300, 0x301, 0x303, 0x309, 0x323,
}
groups = [
    ("latin", latin),
    ("vietnamese", vietnamese),
    ("latin-ext", points((0x100, 0x36F), (0x1D00, 0x1EFF),
                         (0x2C60, 0x2C7F), (0xA720, 0xA7FF), (0xAB30, 0xAB6F))),
    ("greek", points((0x370, 0x3FF), (0x1F00, 0x1FFF))),
    ("cyrillic", points((0x400, 0x52F), (0x2DE0, 0x2DFF), (0xA640, 0xA69F))),
    ("remainder", original_points),
]

assigned = set()
declarations = []
checksums = []
for name, candidates in groups:
    selected = (candidates & original_points) - assigned
    assert selected, f"Empty subset: {name}"
    font = TTFont(source, recalcTimestamp=False)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.recalc_timestamp = False
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=selected)
    subsetter.subset(font)
    target = ROOT / f"public/fonts/InterVariable-{name}.woff2"
    font.save(target)
    # Verify the saved binaries, including all Unicode cmap tables, not just
    # the subsetter's input or its preferred cmap.
    saved = TTFont(target)
    actual = cmap(saved)
    assert actual == selected, f"Changed cmap in {name}"
    assert not (actual & assigned), f"Overlapping cmap in {name}"
    assert axes(saved) == original_axes, f"Lost variable axes in {name}"
    assigned |= actual
    declarations.append({"name": name, "url": f"/fonts/{target.name}",
                         "unicodeRange": unicode_range(actual)})
    checksums.append(f"  - `{target.name}`: `{sha(target)}` ({target.stat().st_size:,} bytes)")
    print(f"{name}: {len(actual)} code points; {target.stat().st_size} bytes; axes={axes(saved)}")

assert assigned == original_points, "Incomplete cmap coverage"
print(f"Coverage: {len(assigned)}/{len(original_points)} original code points; missing=0; duplicates=0; axes preserved in all 6 subsets")

metadata = ROOT / "lib/ui/fontSubsets.json"
metadata.write_text(json.dumps(declarations, indent=2) + "\n")
css = "\n\n".join(
    '@font-face {\n  font-family: "Inter";\n  font-style: normal;\n'
    '  font-weight: 100 900;\n  font-display: swap;\n'
    f'  src: url("{entry["url"]}") format("woff2");\n'
    f'  unicode-range: {entry["unicodeRange"]};\n}}'
    for entry in declarations
)
globals_path = ROOT / "app/globals.css"
globals_css = globals_path.read_text()
start = globals_css.index("@font-face {")
end = globals_css.index("/* `static`", start)
globals_path.write_text(globals_css[:start] + css + "\n\n" + globals_css[end:])

(ROOT / "public/fonts/README.md").write_text("""# Inter Variable (vendored subsets)

- Font: Inter Variable upright, Inter 4.1 (`v4.1`, 2024-11-16).
- Source: https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip
  (`web/InterVariable.woff2` and `LICENSE.txt` from that archive).
- Original WOFF2 SHA-256: `""" + SOURCE_SHA + """`.
- Licence: SIL Open Font License 1.1, see `LICENSE-Inter.txt`.
- Generated with FontTools 4.67.0 and Brotli 1.2.1; both variable axes
  (`wght` 100–900, `opsz` 14–32) and all layout features are retained.

Download/extract the source separately, then run from the repository root:

```sh
nice -n 10 uv run --with fonttools==4.67.0 --with brotli==1.2.1 \\
  python build-scripts/subset-fonts.py /path/to/InterVariable.woff2
```

The script verifies the source hash, generates all six WOFF2 files, the
`app/globals.css` faces and `lib/ui/fontSubsets.json`, and verifies saved
cmap coverage is complete and disjoint with both original variable axes.
Latin includes common punctuation. Vietnamese is assigned before Latin-ext;
the remainder captures every otherwise unassigned original code point.
Mixed-script content can request several subsets. Cross-subset kerning cannot
be assumed; combining marks follow the disjoint ranges in the metadata.

The app and HtmlMessage iframe use the same Inter family, `font-display: swap`,
weight range and Unicode ranges (`lib/ui/fonts.ts`). Fonts are committed;
Docker/Tauri/application builds never download or generate them. The original
full WOFF2 is no longer served or retained in this repository.

SHA-256 of committed files:
""" + "\n".join(checksums) + f"\n  - `LICENSE-Inter.txt`: `{sha(ROOT / 'public/fonts/LICENSE-Inter.txt')}`\n")
