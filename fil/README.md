# PowerLedger — Product Catalog SPA

A fully client-side product catalog built with vanilla JavaScript ES modules,
History API routing, and no framework or bundler dependency. The entire
production build — all code, styles, and 7 product images — is **95.5 KB**.

## Architecture

```
catalog/
├── index.html               ← Single HTML shell; never replaced on navigation
├── src/
│   ├── main.js              ← Entry point: wires header, router, routes
│   ├── router/
│   │   └── router.js        ← History API router: pattern matching, popstate, link interception
│   ├── data/
│   │   └── products.js      ← Data layer: catalog array + filter/search/format functions
│   ├── utils/
│   │   └── cart-store.js    ← Cart: pub/sub state, localStorage persistence
│   └── components/
│       ├── Header.js        ← Persistent header + live cart badge
│       ├── ProductList.js   ← /  — catalog grid with filter chips and search
│       ├── ProductDetail.js ← /product/:id — product info + add to cart
│       ├── Cart.js          ← /cart — live-updating quantity/remove
│       └── NotFound.js      ← 404 fallback
├── build.mjs                ← Build script: minifies JS/CSS, outputs dist/
├── test-harness.mjs         ← Integration tests (jsdom, 28 assertions)
├── vercel.json              ← Vercel SPA rewrite rule
├── _redirects               ← Netlify SPA rewrite rule
└── render.yaml              ← Render static site config
```

## Key patterns

- **ES modules** (`<script type="module">`) with real `import`/`export` — no bundler, no
  transpiler, no build step required to run the app in development.
- **History API routing** with `:param` extraction, back/forward support, and link
  interception (modifier-key and new-tab clicks pass through correctly).
- **Router cleanup contract** — each route component returns an optional `cleanup()` function
  the router calls before mounting the next page, preventing leaked subscriptions.
- **Cart as pub/sub** — the cart store notifies all subscribers (header badge, cart page)
  on every mutation; components unsubscribe on unmount via the cleanup contract above.
- **Asset optimization** — product images were rasterized from SVG at 2× retina resolution
  and compressed to JPEG quality 78; 7 images total to 70 KB.

## Development

No install required to run the app (it's vanilla ES modules). Just serve from the
project root with any static server:

```bash
npm install          # only needed for build + test
npm run dev          # serves on http://localhost:3000
```

The dev server needs to serve `index.html` for any path. `npx serve` does this by
default. If you use a different server, make sure it rewrites unknown paths to `index.html`.

## Build

```bash
npm install
npm run build        # outputs dist/ (~95 KB, minified)
```

## Tests

```bash
npm install
npm test             # 28 integration assertions via jsdom
```

---

## Deployment — pick one platform

### Netlify (drag-and-drop, 2 minutes)

1. Run `npm run build` locally.
2. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Deploy manually**.
3. Drag the `dist/` folder into the upload zone.
4. Done — Netlify reads `dist/_redirects` automatically.

### Netlify (git, auto-deploys on push)

1. Push this repository to GitHub.
2. On Netlify: **Add new site** → **Import an existing project** → connect your repo.
3. Set **Build command** to `npm run build` and **Publish directory** to `dist`.
4. Click **Deploy**.

### Vercel (CLI, ~1 minute)

```bash
npm install -g vercel
cd dist
vercel deploy --prod
```

Vercel reads `vercel.json` from the deploy root automatically.

### Vercel (git)

1. Push to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new), import the repo.
3. Set **Output directory** to `dist`, leave build command as `npm run build`.
4. Deploy.

### Render

1. Push to GitHub.
2. Go to [render.com](https://render.com) → **New** → **Static Site**.
3. Connect your repo. Render reads `render.yaml` and configures itself.
4. Click **Create Static Site**.

---

## Why History API, not hash routing

Hash routing (`/#/product/inv-2000`) works without any server config but has real
costs: the fragment is never sent to the server (so analytics and OG tags can't use
it), it looks less professional, and it breaks same-origin link detection. History API
routing (`/product/inv-2000`) requires one line of server config (a catch-all rewrite
to `index.html`), which is what the three config files above provide.

## Swapping to a real backend

`src/data/products.js` exports `getProducts`, `getProductById`, and `getCategories`.
These are currently synchronous (the data is in-memory). To connect to a real API:

1. Make the functions `async` and replace the array operations with `fetch()` calls.
2. Update their callers in the components to `await` them.
3. Add loading/error states to the components using the same patterns from the
   weather dashboard (status messages, `aria-live` regions).

No other files need to change.
