# CribSheet identity — Swaddled C

Approved direction: option 1 from the logo concept board, October 13, 2026.

## Artwork and lettering

The mark combines a C-shaped swaddle, a circular baby head, and a seafoam blanket fold. Production artwork is flat SVG, redrawn from the approved concept for clear rendering at small sizes. The generated concept's lettering is interpreted using bold Georgia with slightly tightened spacing; no external font is needed, including offline.

- Deep teal: `#145C60`
- Seafoam: `#A7CEC7`
- Warm ivory: `#F5F3EC`
- Header wordmark: Georgia bold, 1.55rem, -0.5px letter spacing.
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
- Bumped version.js from 1.0.2 to 1.0.3, dated 2026-10-13, so existing installs receive the usual update prompt after deployment.
- Updated README.md to describe the app's own icon assets.
- Cardone Medical Consulting's footer branding remains in place.
- No app logic, baby data, sync configuration, tracking functions, or medical content changed.
- Changes are local, not committed, pushed, or deployed. Use the project's normal release process to publish them. Home-screen icon refresh timing depends on the operating system; an existing install may retain its cached icon until it is re-added.

## Validation

Checked the header at 320, 360, 390, and 1280px, light and dark modes, and long baby names with a profile image. Reserved space for the wordmark prevents clipping on narrow screens. Verified icon dimensions and offline-cache asset paths. App logic was not modified.
