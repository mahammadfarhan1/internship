/**
 * utils/cart-store.js
 *
 * Cart state as a tiny pub/sub store: a module-private array is
 * the source of truth, mutated only through the exported functions
 * below, with every mutation persisted to localStorage and then
 * broadcast to anyone subscribed via `subscribe()`. Components
 * never reach into the array directly — they call `getItems()` for
 * a read and call `subscribe()` to be notified when it changes, so
 * the cart icon in the header and the cart page itself can both
 * stay in sync without knowing about each other.
 */

const STORAGE_KEY = "catalog-cart-v1";

/** @type {{ id: string, quantity: number }[]} */
let items = loadCart();

/** @type {Set<() => void>} */
const listeners = new Set();

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.quantity === "number" &&
        item.quantity > 0
    );
  } catch (error) {
    console.error("Could not load cart from localStorage:", error);
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error("Could not save cart to localStorage:", error);
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

/** Read-only snapshot — callers get a copy, not the live array, so they can't mutate state by reference. */
export function getItems() {
  return items.map((item) => ({ ...item }));
}

export function getItemCount() {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function addItem(productId, quantity = 1) {
  const existing = items.find((item) => item.id === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ id: productId, quantity });
  }
  saveCart();
  notify();
}

export function setQuantity(productId, quantity) {
  if (quantity <= 0) {
    removeItem(productId);
    return;
  }
  const existing = items.find((item) => item.id === productId);
  if (existing) {
    existing.quantity = quantity;
    saveCart();
    notify();
  }
}

export function removeItem(productId) {
  items = items.filter((item) => item.id !== productId);
  saveCart();
  notify();
}

export function clearCart() {
  items = [];
  saveCart();
  notify();
}

/**
 * Subscribe to cart changes. Returns an unsubscribe function, the
 * standard pattern for cleanup — callers (route components) call
 * this when they're torn down by the router, so a component that's
 * no longer on screen doesn't keep getting notified forever.
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
