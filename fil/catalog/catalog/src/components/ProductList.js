/**
 * components/ProductList.js
 *
 * Renders the catalog grid with category filter and search. Each
 * component module in this app follows the same shape: a default-
 * exported render(outletElement, params) function that builds DOM,
 * wires its own event listeners, and optionally returns a cleanup
 * function for the router to call when navigating away.
 */
import { getProducts, getCategories, formatPrice } from "../data/products.js";
import { addItem } from "../utils/cart-store.js";

export default function renderProductList(outletElement) {
  const categories = getCategories();

  // Local UI state for this page only — lives entirely inside this
  // closure and is discarded when the router unmounts the page, so
  // there's no risk of it leaking into the next page's state.
  let activeCategory = null;
  let searchTerm = "";

  outletElement.innerHTML = `
    <section aria-labelledby="catalog-heading">
      <p class="eyebrow">Catalog</p>
      <h1 id="catalog-heading">Inverters &amp; batteries</h1>
      <p class="lede">Pure sine wave inverters, deep-cycle batteries, and two-wheeler starter batteries.</p>

      <div class="catalog-controls">
        <div class="field">
          <label for="search-input" class="visually-hidden">Search products</label>
          <input type="text" id="search-input" placeholder="Search products…" />
        </div>
        <div class="category-filters" role="group" aria-label="Filter by category">
          <button type="button" class="chip" data-category="">All</button>
          ${categories
            .map((cat) => `<button type="button" class="chip" data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`)
            .join("")}
        </div>
      </div>

      <p id="result-count" class="result-count" role="status" aria-live="polite"></p>

      <ul class="product-grid" id="product-grid"></ul>
    </section>
  `;

  const grid = outletElement.querySelector("#product-grid");
  const resultCount = outletElement.querySelector("#result-count");
  const searchInput = outletElement.querySelector("#search-input");
  const chips = outletElement.querySelectorAll(".chip");

  function renderGrid() {
    const results = getProducts({ category: activeCategory, search: searchTerm });

    resultCount.textContent =
      results.length === 0
        ? "No products match your search."
        : results.length === 1
        ? "1 product"
        : results.length + " products";

    grid.innerHTML = results
      .map(
        (product) => `
        <li class="product-card">
          <a class="product-card__link" href="/product/${encodeURIComponent(product.id)}">
            <img
              class="product-card__image"
              src="${escapeHtml(product.image)}"
              alt="${escapeHtml(product.name)}"
              width="320"
              height="240"
              loading="lazy"
              decoding="async"
            />
            <p class="product-card__category">${escapeHtml(product.category)}</p>
            <h2 class="product-card__name">${escapeHtml(product.name)}</h2>
            <p class="product-card__blurb">${escapeHtml(product.blurb)}</p>
          </a>
          <div class="product-card__foot">
            <p class="product-card__price">${formatPrice(product.price, product.currency)}</p>
            <button
              type="button"
              class="btn btn--small add-to-cart"
              data-id="${escapeHtml(product.id)}"
              ${product.inStock ? "" : "disabled"}
            >
              ${product.inStock ? "Add to cart" : "Out of stock"}
            </button>
          </div>
        </li>
      `
      )
      .join("");
  }

  // Event delegation: one listener on the grid handles every
  // "Add to cart" click, including for cards added/removed by
  // future re-renders of renderGrid() — no per-card listener
  // wiring needed.
  grid.addEventListener("click", (event) => {
    const button = event.target.closest(".add-to-cart");
    if (!button || button.disabled) return;
    addItem(button.dataset.id, 1);

    const original = button.textContent;
    button.textContent = "Added ✓";
    window.setTimeout(() => {
      // Guard against the button no longer being in the DOM if the
      // person navigated away in the 900ms window — setTimeout
      // callbacks aren't automatically cancelled by route changes.
      if (document.body.contains(button)) {
        button.textContent = original;
      }
    }, 900);
  });

  searchInput.addEventListener("input", (event) => {
    searchTerm = event.target.value;
    renderGrid();
  });

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      activeCategory = chip.dataset.category || null;
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      renderGrid();
    });
  });
  // "All" starts pressed since activeCategory starts as null.
  outletElement.querySelector('.chip[data-category=""]').setAttribute("aria-pressed", "true");

  renderGrid();

  // This page has no subscriptions or timers that outlive it once
  // renderGrid() and the click handlers above are torn down by the
  // router replacing outletElement's contents, so there's nothing
  // to clean up — returning undefined here is intentional, not an
  // oversight (see Cart.js for a page that does need cleanup).
}

/** Minimal HTML-escaping for values interpolated into innerHTML strings below. */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
