# Bin Bros: Trash Bin Cleaning, Virginia Peninsula

Static website for Bin Bros (binbrosva.com). No build step needed to host it: deploy the folder as-is to Vercel, Netlify or GitHub Pages.

## Structure
- `index.html`: the page (hero, how it works, before/after, pricing and calculator, why us, service area and ZIP checker, about, gift cards, contact)
- `css/style.css`: all styles; brand tokens at the top (Bros Blue `#0150B4`, Deep Navy `#032E73`, Lime `#9FCE10`)
- `js/main.js`: scroll story, smooth scroll, calculator, ZIP checker, slider, menu, form
- `js/scene.js`: bundled 3D bin scene (three.js r187, built from `src/scene.js`)
- `js/vendor/`: GSAP + ScrollTrigger, Lenis (self-hosted)
- `fonts/`: Archivo (variable) + Barlow Condensed (self-hosted)
- `assets/`: logo, icons, share image

## Editing the 3D scene
`src/scene.js` is the readable source. After changing it, rebuild:

```
npm i three@0.187.0 esbuild
npx esbuild src/scene.js --bundle --format=esm --minify --target=es2020 --outfile=js/scene.js
```

## Notes
- Booking, gift card and customer portal buttons link to the existing Jobatory pages.
- The before/after photos load from the current site's image CDN. If they ever fail to load, that section hides itself.
- The contact form opens the visitor's email app addressed to BinBrosSupport@gmail.com.
