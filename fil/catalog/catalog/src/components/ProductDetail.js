/**
 * components/ProductDetail.js
 *
 * Registered against the route pattern "/product/:id" — the router
 * passes the matched :id segment in as `params.id`.
 */
import { getProductById, formatPrice } from "../data/products.js";
import { addItem } from "../utils/cart-store.js";

export default function renderProductDetail(outletElement, params) {
  const product = getProductById(params.id);

  if (!product) {
    // A real "not found" inside a valid route shape (the URL
    // pattern matched, but no product has this id) is a distinct
    // case from the router's own not-found page (no route pattern
    // matched at all) — both need handling, but for different
    // reasons, so this is deliberately a local check rather than
    // routed through the global 404.
    outletElement.innerHTML = `
      <section aria-labelledby="missing-heading">
        <h1 id="missing-heading">Product not found</h1>
        <p>We couldn't find a product with that ID. It may have been removed.</p>
        <p><a class="inline-link" href="/">Back to the catalog &rarr;</a></p>
      </section>
    `;
    return;
  }

  const specRows = Object.entries(product.specs)
    .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join("");

  outletElement.innerHTML = `
    <article aria-labelledby="product-heading">
      <p><a class="inline-link" href="/">&larr; Back to catalog</a></p>

      <div class="product-detail">
        <img
          class="product-detail__image"
          src="${escapeHtml(product.image)}"
          alt="${escapeHtml(product.name)}"
          width="480"
          height="360"
          decoding="async"
        />
        <div class="product-detail__info">
          <p class="eyebrow">${escapeHtml(product.category)}</p>
          <h1 id="product-heading">${escapeHtml(product.name)}</h1>
          <p class="product-detail__price">${formatPrice(product.price, product.currency)}</p>
          <p class="product-detail__description">${escapeHtml(product.description)}</p>

          <button
            type="button"
            class="btn add-to-cart-detail"
            ${product.inStock ? "" : "disabled"}
          >
            ${product.inStock ? "Add to cart" : "Out of stock"}
          </button>
          <p id="detail-status" class="status-message" role="status" aria-live="polite"></p>

          <h2>Specifications</h2>
          <dl class="spec-list">${specRows}</dl>
        </div>
      </div>
    </article>
  `;

  const addButton = outletElement.querySelector(".add-to-cart-detail");
  const statusEl = outletElement.querySelector("#detail-status");

  addButton.addEventListener("click", () => {
    addItem(product.id, 1);
    statusEl.textContent = "Added to cart.";
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
