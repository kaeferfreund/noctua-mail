# Inter Variable (vendored subsets)

- Font: Inter Variable upright, Inter 4.1 (`v4.1`, 2024-11-16).
- Source: https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip
  (`web/InterVariable.woff2` and `LICENSE.txt` from that archive).
- Original WOFF2 SHA-256: `693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3`.
- Licence: SIL Open Font License 1.1, see `LICENSE-Inter.txt`.
- Generated with FontTools 4.67.0 and Brotli 1.2.1; both variable axes
  (`wght` 100–900, `opsz` 14–32) and all layout features are retained.

Download/extract the source separately, then run from the repository root:

```sh
nice -n 10 uv run --with fonttools==4.67.0 --with brotli==1.2.1 \
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
  - `InterVariable-latin.woff2`: `7c974022303fbd46cae2864c62db7764be42936b45e9eaef5b795cffd7163139` (105,344 bytes)
  - `InterVariable-vietnamese.woff2`: `385073a3121fbd29e6271e384ffab0eaa84be3bdf06cf726d4a5fc4912c58897` (16,564 bytes)
  - `InterVariable-latin-ext.woff2`: `9482aab42d0b59592aff97a59bb07096503a7fb03a846aa50981ef848c4fcff5` (151,960 bytes)
  - `InterVariable-greek.woff2`: `c12fb9d3ba3847b529baddcb9a955a21bb6cc3bed3384e31c785e0bae5818866` (38,900 bytes)
  - `InterVariable-cyrillic.woff2`: `044d92c4568ba918f9217b07c28741c991a90b98959d24cff71a29830b4c4579` (52,156 bytes)
  - `InterVariable-remainder.woff2`: `881d00fd64865415c218dead32c29b82ea5a03a2989dd0f072e402d6b3c2759e` (149,788 bytes)
  - `LICENSE-Inter.txt`: `262481e844521b326f5ecd053e59b98c8b2da78c8ee1bdbb6e8174305e54935a`
