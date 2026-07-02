/**
 * components/Header.js
 *
 * Unlike the route components, the header is mounted exactly once
 * outside the router's outlet and stays on screen across every
 * navigation — it subscribes to the cart store for the lifetime of
 * the whole app (never unsubscribed, which is correct here, since
 * the header never gets torn down the way a route page does).
 */
import { getItemCount, subscribe } from "../utils/cart-store.js";

export function renderHeader(headerElement) {
  headerElement.innerHTML = `
    <a class="brand" href="/">Power<span>Ledger</span></a>
    <nav aria-label="Primary">
      <a href="/">Catalog</a>
      <a href="/cart" class="cart-link">
        Cart <span class="cart-badge" id="cart-badge" aria-hidden="true">0</span>
        <span class="visually-hidden" id="cart-badge-text">, 0 items</span>
      </a>
    </nav>
  `;

  const badge = headerElement.querySelector("#cart-badge");
  const badgeText = headerElement.querySelector("#cart-badge-text");

  function updateBadge() {
    const count = getItemCount();
    badge.textContent = String(count);
    badgeText.textContent = ", " + count + (count === 1 ? " item" : " items");
  }

  updateBadge();
  subscribe(updateBadge);
}
