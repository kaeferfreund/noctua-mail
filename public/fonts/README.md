# Inter Variable (vendored)

- Font: Inter Variable, upright styles (`InterVariable.woff2`; the italic
  variable font is not vendored)
- Version: Inter 4.1 (GitHub release `v4.1` of rsms/inter, published 2024-11-16)
- Source: https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip
  (`web/InterVariable.woff2` and `LICENSE.txt` from that archive, unmodified)
- SHA-256:
  - `InterVariable.woff2`: `693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3`
  - `LICENSE-Inter.txt`: `262481e844521b326f5ecd053e59b98c8b2da78c8ee1bdbb6e8174305e54935a`
- Licence: SIL Open Font License 1.1, see `LICENSE-Inter.txt`

The font is served from `/fonts/InterVariable.woff2` and declared once in
`app/globals.css` (`@font-face`) and once more inside the HtmlMessage iframe
srcdoc (`lib/ui/fonts.ts`), so the shell, the kept Radix components and the
rendered e-mail share the same family without `next/font` (Docker and Tauri
builds stay hermetic).
