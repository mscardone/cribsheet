# CribSheet identity — Swaddled C

Approved direction: option 1 from the logo concept board, October 13, 2026.

## Artwork and lettering

The mark combines a C-shaped swaddle, a circular baby head, and a seafoam blanket fold. Production artwork is flat SVG, redrawn from the approved concept for clear rendering at small sizes. The app uses locally bundled Nunito throughout, explicitly selected by Scott. The wordmark uses weight 700; the variable font supports weights 400–800 for body text, labels, and headings. All lettering remains accessible text and works offline without contacting a font service.

- Deep teal: `#145C60`
- Seafoam: `#A7CEC7`
- Warm ivory: `#F5F3EC`
- Header wordmark: Nunito Bold, 1.7rem (1.5rem at widths up to 360px), -0.25px letter spacing. Font and license are in `brand/fonts/`.
- Header mark: `cribsheet-symbol-ivory.svg` on the existing teal header.
- Light-background alternative: `cribsheet-symbol-teal.svg`.
- App icon source: `cribsheet-app-icon.svg` with an opaque, full-bleed teal background. The operating system supplies the installed icon's corner mask.
- Browser favicon: rounded teal tile in `../favicon.svg` and `../favicon.ico`.

## Regenerate icons

With Node.js and the `sharp` package available, run from the app folder:

```sh
node brand/build-icons.cjs
```

This regenerates the two symbol SVGs, app-icon SVG, browser SVG/ICO, 192px and 512px PNGs, and the 180px Apple touch icon. The generator contains the editable vector paths and palette. No build step is required to run or deploy the app itself.

## Handoff to Claude

- Replaced the Cardone symbol in the top-left header with the approved CribSheet Swaddled C.
- Kept the Nunito wordmark as real text for accessibility, using the styling above. The adjacent mark has empty alt text to avoid repeating the app name.
- Replaced all existing favicon and installed-app icon files, preserving their filenames and manifest references.
- Updated the service worker shell to cache the new header symbol and the ICO favicon.
- Releases: 1.0.3 introduced the icon; 1.0.4 introduced the Nunito header (commit c3bcce7); 1.0.5 applies Nunito throughout. All dated 2026-10-13.
- Updated README.md to describe the app's own icon assets.
- Cardone Medical Consulting's footer branding remains in place.
- No app logic, baby data, sync configuration, tracking functions, or medical content changed.
- The approved Nunito changes are committed locally; they have not been pushed or deployed. Use the project's normal release process to publish them. Home-screen icon refresh timing depends on the operating system; an existing install may retain its cached icon until it is re-added.

## Validation

Checked the header at 320, 360, 390, and 1280px, light and dark modes, and long baby names with a profile image. Reserved space for the wordmark prevents clipping on narrow screens. Verified icon dimensions and offline-cache asset paths. App logic was not modified.

Font correction validation (1.0.4): confirmed the actual Nunito font loaded at 320, 360, 390, and 1280px with no wordmark clipping or page overflow. Confirmed the font is in the service worker cache and loads after an offline page reload. Updated light/dark screenshots in brand/.

## Nunito throughout — 1.0.5 handoff

Requested and approved by Scott: use Nunito throughout the app and commit.

- Replaced Georgia section headings and system sans-serif overrides with Nunito. Body text, headings, buttons, forms, navigation, chart labels, calculation displays, and sync codes now use the same family.
- Preserved the approved header size and styling. Calculation and sync-code displays use tabular numerals for consistent digit widths; calculation line breaks are preserved.
- Replaced the old wordmark-only subset with five locally hosted variable WOFF2 subsets covering Latin, extended Latin, Cyrillic, extended Cyrillic, and Vietnamese, at weights 400–800. Font CSS and every subset are cached offline; Latin is preloaded. No runtime Google Fonts dependency.
- Files: index.html, sw.js, version.js, brand/fonts/, this change note, and refreshed brand/preview-*.png screenshots. License retained in brand/fonts/OFL-Nunito.txt.
- Verification: all five tabs checked at 320, 360, 390, and 1280px without horizontal overflow or header clipping; checked dialog typography and dark-mode rendering. Confirmed all five subsets are cached and Nunito loads after an offline reload.
- Typography only: no changes to tracking logic, stored data, sync behavior, or medical content. Cardone footer artwork and app icon remain unchanged.
