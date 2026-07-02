/**
 * build.mjs — production build script.
 *
 * Runs with: node build.mjs
 *
 * What it does:
 *   1. Copies index.html to dist/, updating the asset paths to
 *      point at the minified versions.
 *   2. Minifies every JS module with Terser (preserving ES module
 *      syntax so native import/export still works in the browser)
 *      and writes to dist/src/...
 *   3. Minifies the CSS with a simple but correct regex approach
 *      (no PostCSS dependency needed for this stylesheet's
 *      complexity), writes to dist/src/assets/css/styles.min.css.
 *   4. Copies the already-optimized product JPEGs to dist/ — they
 *      were already compressed at generation time, so no further
 *      processing is needed here.
 *   5. Copies the deploy configs (_redirects, vercel.json,
 *      render.yaml) so the dist/ folder is the complete thing
 *      you'd drag into Netlify or point Vercel/Render at.
 */

import { readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { minify as terserMinify } from "terser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = (p) => join(__dirname, p);
const dist = (p) => join(__dirname, "dist", p);

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function logSize(label, original, minified) {
  const pct = ((1 - minified / original) * 100).toFixed(1);
  console.log(`  ${label}: ${(original / 1024).toFixed(1)} KB → ${(minified / 1024).toFixed(1)} KB (−${pct}%)`);
}

// -----------------------------------------------------------------
// Step 0: clean dist/
// -----------------------------------------------------------------
import { rmSync, existsSync } from "fs";
if (existsSync(dist(""))) rmSync(dist(""), { recursive: true });

ensureDir(dist(""));
ensureDir(dist("src/router"));
ensureDir(dist("src/data"));
ensureDir(dist("src/utils"));
ensureDir(dist("src/components"));
ensureDir(dist("src/assets/css"));
ensureDir(dist("src/assets/img"));

// -----------------------------------------------------------------
// Step 1: minify JS modules
// -----------------------------------------------------------------
console.log("\n[1/4] Minifying JavaScript…");

const jsFiles = [
  "src/main.js",
  "src/router/router.js",
  "src/data/products.js",
  "src/utils/cart-store.js",
  "src/components/Header.js",
  "src/components/ProductList.js",
  "src/components/ProductDetail.js",
  "src/components/Cart.js",
  "src/components/NotFound.js",
];

let totalJsBefore = 0;
let totalJsAfter = 0;

for (const file of jsFiles) {
  const code = readFileSync(src(file), "utf8");
  const result = await terserMinify(code, {
    module: true,           // tells Terser this is an ES module (import/export is valid)
    compress: {
      drop_console: false,  // keep console.error for the localStorage catch blocks
      passes: 2,
    },
    mangle: true,
    format: { comments: false },
  });

  const outPath = dist(file);
  writeFileSync(outPath, result.code, "utf8");
  logSize(file, code.length, result.code.length);
  totalJsBefore += code.length;
  totalJsAfter += result.code.length;
}

console.log(`  TOTAL JS: ${(totalJsBefore / 1024).toFixed(1)} KB → ${(totalJsAfter / 1024).toFixed(1)} KB (−${((1 - totalJsAfter / totalJsBefore) * 100).toFixed(1)}%)`);

// -----------------------------------------------------------------
// Step 2: minify CSS
// -----------------------------------------------------------------
console.log("\n[2/4] Minifying CSS…");

const css = readFileSync(src("src/assets/css/styles.css"), "utf8");
const minCss = css
  // strip single-line comments (/* ... */ style — CSS has no // comments)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  // collapse whitespace
  .replace(/\s+/g, " ")
  // remove spaces around structural characters
  .replace(/\s*([:;,{}])\s*/g, "$1")
  // remove trailing semicolons before closing braces
  .replace(/;}/g, "}")
  .trim();

writeFileSync(dist("src/assets/css/styles.min.css"), minCss, "utf8");
logSize("styles.css", css.length, minCss.length);

// -----------------------------------------------------------------
// Step 3: copy product images (already optimized — see image
// generation in the build notes; no re-compression needed here)
// -----------------------------------------------------------------
console.log("\n[3/4] Copying optimized product images…");

const imgDir = src("src/assets/img");
const images = readdirSync(imgDir).filter((f) => f.endsWith(".jpg"));
let totalImgSize = 0;

for (const img of images) {
  copyFileSync(join(imgDir, img), dist("src/assets/img/" + img));
  const bytes = readFileSync(dist("src/assets/img/" + img)).length;
  totalImgSize += bytes;
  console.log(`  ${img}: ${(bytes / 1024).toFixed(1)} KB`);
}

console.log(`  TOTAL images: ${(totalImgSize / 1024).toFixed(1)} KB for ${images.length} files`);

// -----------------------------------------------------------------
// Step 4: write index.html, pointing at minified assets
// -----------------------------------------------------------------
console.log("\n[4/4] Writing dist/index.html…");

let html = readFileSync(src("index.html"), "utf8");
html = html.replace("/src/assets/css/styles.css", "/src/assets/css/styles.min.css");
writeFileSync(dist("index.html"), html, "utf8");

// Deploy configs (each platform looks for its file in the deploy root)
copyFileSync(src("_redirects"), dist("_redirects"));
copyFileSync(src("vercel.json"), dist("vercel.json"));
copyFileSync(src("render.yaml"), dist("render.yaml"));

// -----------------------------------------------------------------
// Summary
// -----------------------------------------------------------------
console.log("\n✓ Build complete → dist/");
console.log(`  Total JS:     ${(totalJsAfter / 1024).toFixed(1)} KB`);
console.log(`  Total CSS:    ${(minCss.length / 1024).toFixed(1)} KB`);
console.log(`  Total images: ${(totalImgSize / 1024).toFixed(1)} KB`);
console.log(`  Grand total:  ${((totalJsAfter + minCss.length + totalImgSize) / 1024).toFixed(1)} KB`);
