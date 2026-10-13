# CribSheet identity — Swaddled C

Approved direction: option 1 from the logo concept board, October 13, 2026.

## Artwork and lettering

The mark combines a C-shaped swaddle, a circular baby head, and a seafoam blanket fold. Production artwork is flat SVG, redrawn from the approved concept for clear rendering at small sizes. The wordmark uses locally bundled Nunito Bold (weight 700), explicitly selected by Scott after comparing sans-serif and serif alternatives. It remains accessible text and works offline without contacting a font service.

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
- Kept the serif wordmark as real text for accessibility, using the styling above. The adjacent mark has empty alt text to avoid repeating the app name.
- Replaced all existing favicon and installed-app icon files, preserving their filenames and manifest references.
- Updated the service worker shell to cache the new header symbol and the ICO favicon.
- Initial icon release: 1.0.3. Nunito header release: 1.0.4, dated 2026-10-13. The font is preloaded and included in the offline shell.
- Updated README.md to describe the app's own icon assets.
- Cardone Medical Consulting's footer branding remains in place.
- No app logic, baby data, sync configuration, tracking functions, or medical content changed.
- The 1.0.4 Nunito header change is committed locally; it has not been pushed or deployed. Use the project's normal release process to publish them. Home-screen icon refresh timing depends on the operating system; an existing install may retain its cached icon until it is re-added.

## Validation

Checked the header at 320, 360, 390, and 1280px, light and dark modes, and long baby names with a profile image. Reserved space for the wordmark prevents clipping on narrow screens. Verified icon dimensions and offline-cache asset paths. App logic was not modified.

Font correction validation (1.0.4): confirmed the actual Nunito font loaded at 320, 360, 390, and 1280px with no wordmark clipping or page overflow. Confirmed the font is in the service worker cache and loads after an offline page reload. Updated light/dark screenshots in brand/.
