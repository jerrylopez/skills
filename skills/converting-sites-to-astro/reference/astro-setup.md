# Astro + Tailwind project setup

Scaffold with `npm create astro@latest <dir> -- --template minimal --no-install --no-git --yes`, then
`npm i tailwindcss @tailwindcss/vite`. Self-host Google/free fonts with `@fontsource/<family>`.

## astro.config.mjs

```js
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://www.example.com',   // the live origin, for canonical URLs
  trailingSlash: 'always',           // match the old URLs exactly (WordPress uses trailing slashes)
  devToolbar: { enabled: false },    // the toolbar overlays the page and pollutes screenshot diffs
  vite: {
    plugins: [tailwindcss()],
    server: { allowedHosts: ['.onamp.dev'] }, // Amp orb portal URLs
  },
});
```

Leave HMR on. Turning it off (`hmr: false`) stops the dev server from noticing new route files,
so new pages 404 until a restart.

## src/styles/global.css

```css
@import "tailwindcss";

@theme {
  /* 1 spacing unit = 1px, so p-30 is 30px and markup reads in the original CSS's pixel values. */
  --spacing: 1px;

  /* Replace the defaults with the old site's own media-query breakpoints. A max-width:780px query
     becomes breakpoint 781px, used as max-md:. Name extra ones after their purpose (e.g. nav). */
  --breakpoint-*: initial;
  --breakpoint-md: 781px;
  --breakpoint-lg: 1025px;

  /* Colours and font stacks copied from the theme CSS. */
  --color-brand: #c43847;
  --font-heading: "futura-pt", sans-serif;
}

/* The theme's container. Bootstrap 3 shown; read the real widths from the theme CSS. */
@utility wrap {
  margin-inline: auto;
  @media (min-width: 768px) { width: 750px; }
  @media (min-width: 992px) { width: 970px; }
  @media (min-width: 1200px) { width: 1170px; }
}

@layer base {
  /* Reproduce the theme's body, h1–h6, p, a, list and form defaults here, including their
     media queries, so page markup carries only what differs from the defaults. */
}
```

## Images

Copy the downloaded uploads into `src/assets/uploads/` keeping their original sub-paths, so
data files can name images by the old path. Resolve them with one helper:

```ts
// src/lib/images.ts
import type { ImageMetadata } from 'astro';
const uploads = import.meta.glob<{ default: ImageMetadata }>('/src/assets/uploads/**/*.{jpg,jpeg,png,webp,gif,svg}', { eager: true });
export function img(path: string): ImageMetadata {
  const mod = uploads[`/src/assets/uploads/${path}`];
  if (!mod) throw new Error(`Unknown image: ${path}`);
  return mod.default;
}
```

Use `<Image src={img('2025/07/photo.jpg')} …>` from `astro:assets`. For CSS backgrounds pass the
URL through a custom property: `style={`--bg:url(${img(p).src})`}` with `bg-(image:--bg)`.
Videos, PDFs and other non-image files go in `public/` (they are served as-is).

When an image's rendered height must match to the pixel, request the widths the old site served
(WordPress: 768, 1024, 1536…) via `widths`/`sizes`; Astro's own resize steps can round
heights differently.

## BaseLayout

One layout owns `<head>`: title, description, canonical and og tags copied per page from the live
HTML, the font stylesheet, header and footer. Give it a `noindex` prop for the 404 page (robots
noindex, no canonical/og:url), and write the 404 as `src/pages/404.astro`.

## Dev server in an orb

Run it as a supervised service so it survives pauses, and expose it with a portal:

```sh
amp orb service start astro-dev --command 'npx astro dev --host 0.0.0.0 --port 4321' --portal
```
