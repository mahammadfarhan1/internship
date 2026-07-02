/**
 * components/Cart.js
 *
 * The one page in this app that subscribes to the cart store and
 * re-renders on every change (quantity edits, removals) — so this
 * is the component that actually needs the router's cleanup
 * contract: without unsubscribing, navigating away from the cart
 * page would leave this subscription firing forever in the
 * background, re-rendering into a detached DOM tree on every future
 * cart mutation for the rest of the session.
 */
import { getItems, setQuantity, removeItem, subscribe, clearCart } from "../utils/cart-store.js";
import { getProductById, formatPrice } from "../data/products.js";

export default function renderCart(outletElement) {
  outletElement.innerHTML = `
    <section aria-labelledby="cart-heading">
      <p class="eyebrow">Cart</p>
      <h1 id="cart-heading">Your cart</h1>
      <div id="cart-body"></div>
    </section>
  `;

  const cartBody = outletElement.querySelector("#cart-body");

  function renderCartBody() {
    const items = getItems();

    if (items.length === 0) {
      cartBody.innerHTML = `
        <p class="empty-state">Your cart is empty. <a class="inline-link" href="/">Browse the catalog &rarr;</a></p>
      `;
      return;
    }

    // Joining cart entries (id + quantity) with product details
    // (name, price, image) from a separate data source is a real
    // join, the same shape as combining an "order_items" table
    // with a "products" table in a database-backed app. Lines
    // referencing a product that's been removed from the catalog
    // entirely are filtered out defensively rather than crashing
    // on a null product.
    const rows = items
      .map((item) => ({ item, product: getProductById(item.id) }))
      .filter((row) => row.product !== null);

    const total = rows.reduce(
      (sum, row) => sum + row.product.price * row.item.quantity,
      0
    );

    cartBody.innerHTML = `
      <ul class="cart-list">
        ${rows
          .map(
            ({ item, product }) => `
          <li class="cart-row" data-id="${escapeHtml(product.id)}">
            <img class="cart-row__image" src="${escapeHtml(product.image)}" alt="" width="72" height="54" loading="lazy" decoding="async" />
            <div class="cart-row__info">
              <a class="cart-row__name inline-link" href="/product/${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a>
              <p class="cart-row__unit-price">${formatPrice(product.price, product.currency)} each</p>
            </div>
            <div class="cart-row__qty">
              <label class="visually-hidden" for="qty-${escapeHtml(product.id)}">Quantity for ${escapeHtml(product.name)}</label>
              <input
                type="number"
                id="qty-${escapeHtml(product.id)}"
                class="cart-qty-input"
                min="1"
                max="99"
                value="${item.quantity}"
                inputmode="numeric"
              />
            </div>
            <p class="cart-row__line-total">${formatPrice(product.price * item.quantity, product.currency)}</p>
            <button type="button" class="cart-row__remove" aria-label="Remove ${escapeHtml(product.name)} from cart">Remove</button>
          </li>
        `
          )
          .join("")}
      </ul>

      <div class="cart-summary">
        <p class="cart-summary__total">Total: <strong>${formatPrice(total, "INR")}</strong></p>
        <button type="button" class="btn btn--ghost" id="clear-cart-btn">Clear cart</button>
      </div>
    `;

    wireCartRowEvents();
  }

  function wireCartRowEvents() {
    cartBody.querySelectorAll(".cart-row").forEach((row) => {
      const id = row.dataset.id;
      const qtyInput = row.querySelector(".cart-qty-input");
      const removeBtn = row.querySelector(".cart-row__remove");

      qtyInput.addEventListener("change", () => {
        const next = parseInt(qtyInput.value, 10);
        setQuantity(id, Number.isFinite(next) ? next : 1);
      });

      removeBtn.addEventListener("click", () => removeItem(id));
    });

    const clearBtn = cartBody.querySelector("#clear-cart-btn");
    if (clearBtn) {
      clearBtn.addEventListener("click", clearCart);
    }
  }

  renderCartBody();

  // Subscribe so quantity/removal changes made on THIS page (or, in
  // principle, triggered elsewhere) immediately re-render the cart
  // body. The returned unsubscribe function is handed back to the
  // router as this component's cleanup — see the file header.
  const unsubscribe = subscribe(renderCartBody);

  return function cleanup() {
    unsubscribe();
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
