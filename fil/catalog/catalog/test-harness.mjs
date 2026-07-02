/**
 * test-harness.mjs — not part of the shipped app. A throwaway
 * integration test that loads the real source modules into a
 * jsdom environment and exercises routing, cart state, and
 * rendering end-to-end, the same way a browser would load them.
 * Run with: node test-harness.mjs
 */
import { JSDOM } from "jsdom";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log("PASS:", message);
  } else {
    failed++;
    console.log("FAIL:", message);
  }
}

async function freshDom(initialPath = "/") {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body>
      <header id="site-header"></header>
      <main><div id="outlet"></div></main>
    </body></html>`,
    {
      url: "http://localhost" + initialPath,
      runScripts: "outside-only",
      pretendToBeVisual: true,
    }
  );

  // Make this jsdom window's globals available to the modules we
  // import, since they reference document/window/localStorage as
  // ambient globals exactly as they would in a real browser tab.
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  global.location = dom.window.location;
  global.history = dom.window.history;
  global.URL = dom.window.URL;
  global.URLSearchParams = dom.window.URLSearchParams;
  global.HTMLElement = dom.window.HTMLElement;
  global.Event = dom.window.Event;
  global.MouseEvent = dom.window.MouseEvent;

  return dom;
}

async function run() {
  // -----------------------------------------------------------
  // Test group 1: router matching, including dynamic :id params
  // -----------------------------------------------------------
  await freshDom("/");
  {
    // cache-bust the dynamic import so each test group gets a
    // fresh module instance (cart-store has module-level state
    // that would otherwise leak between test groups)
    const { createRouter } = await import("./src/router/router.js?t=1");
    const outlet = document.getElementById("outlet");
    const router = createRouter(outlet);

    let lastRenderedParams = null;
    router.addRoute("/", () => { outlet.textContent = "HOME"; });
    router.addRoute("/product/:id", (params) => {
      lastRenderedParams = params;
      outlet.textContent = "PRODUCT:" + params.id;
    });
    router.setNotFound(() => { outlet.textContent = "404"; });

    router.start();
    assert(outlet.textContent === "HOME", "router renders / on start");

    router.navigate("/product/inv-2000");
    assert(outlet.textContent === "PRODUCT:inv-2000", "router renders dynamic :id route");
    assert(lastRenderedParams.id === "inv-2000", "router extracts the correct param value");
    assert(window.location.pathname === "/product/inv-2000", "navigate() updates the URL via pushState");

    router.navigate("/nonexistent-page");
    assert(outlet.textContent === "404", "router falls back to notFound for unmatched paths");

    // simulate browser back button
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new dom_window_PopStateEvent());
  }

  function dom_window_PopStateEvent() {
    return new window.PopStateEvent("popstate");
  }

  // -----------------------------------------------------------
  // Test group 2: cart store CRUD + persistence + pub/sub
  // -----------------------------------------------------------
  await freshDom("/");
  {
    const cart = await import("./src/utils/cart-store.js?t=2");

    assert(cart.getItemCount() === 0, "cart starts empty");

    cart.addItem("inv-2000", 2);
    assert(cart.getItemCount() === 2, "addItem increases count");

    cart.addItem("inv-2000", 1);
    assert(cart.getItemCount() === 3, "adding the same id again increments quantity, not a duplicate row");
    assert(cart.getItems().length === 1, "still only one line item for the same product id");

    cart.addItem("bat-agm-150", 1);
    assert(cart.getItems().length === 2, "a different product id creates a new line item");

    cart.setQuantity("inv-2000", 5);
    assert(cart.getItemCount() === 6, "setQuantity updates count correctly (5 + 1)");

    let notified = false;
    const unsubscribe = cart.subscribe(() => { notified = true; });
    cart.removeItem("bat-agm-150");
    assert(notified === true, "subscribers are notified on mutation");
    assert(cart.getItems().length === 1, "removeItem removes the correct line item");
    unsubscribe();

    cart.setQuantity("inv-2000", 0);
    assert(cart.getItems().length === 0, "setting quantity to 0 removes the item entirely");

    cart.addItem("bat-vrla-100", 2);
    const persisted = JSON.parse(localStorage.getItem("catalog-cart-v1"));
    assert(Array.isArray(persisted) && persisted[0].id === "bat-vrla-100", "cart state is actually persisted to localStorage");
  }

  // -----------------------------------------------------------
  // Test group 3: corrupted localStorage doesn't crash the cart
  // -----------------------------------------------------------
  await freshDom("/");
  {
    localStorage.setItem("catalog-cart-v1", "{not valid json");
    const cart = await import("./src/utils/cart-store.js?t=3");
    assert(cart.getItems().length === 0, "corrupted cart storage degrades to empty cart, no crash");
  }

  // -----------------------------------------------------------
  // Test group 4: data layer filtering
  // -----------------------------------------------------------
  await freshDom("/");
  {
    const { getProducts, getProductById, getCategories } = await import("./src/data/products.js?t=4");

    const all = getProducts();
    assert(all.length === 7, "catalog has the expected 7 products");

    const inverters = getProducts({ category: "Inverters" });
    assert(inverters.length === 2 && inverters.every(p => p.category === "Inverters"), "category filter works");

    const searched = getProducts({ search: "lithium" });
    assert(searched.length === 1 && searched[0].id === "bat-li-100", "search matches product name case-insensitively");

    const missing = getProductById("does-not-exist");
    assert(missing === null, "getProductById returns null for an unknown id, not undefined/throw");

    const categories = getCategories();
    assert(categories.includes("Two-Wheeler Batteries"), "getCategories includes all real categories");
  }

  // -----------------------------------------------------------
  // Test group 5: full render of ProductList into real jsdom
  // -----------------------------------------------------------
  await freshDom("/");
  {
    const renderProductList = (await import("./src/components/ProductList.js?t=5")).default;
    const outlet = document.getElementById("outlet");
    renderProductList(outlet);

    const cards = outlet.querySelectorAll(".product-card");
    assert(cards.length === 7, "ProductList renders one card per product");

    const addButtons = outlet.querySelectorAll(".add-to-cart");
    assert(addButtons.length === 7, "every card has an add-to-cart control");

    const disabledButtons = outlet.querySelectorAll(".add-to-cart:disabled");
    assert(disabledButtons.length === 1, "the one out-of-stock product's button is disabled");

    // Simulate a real click via event delegation
    const cart = await import("./src/utils/cart-store.js?t=2"); // same module instance as test group 2 (cache key matches)
    const firstEnabledButton = outlet.querySelector(".add-to-cart:not(:disabled)");
    firstEnabledButton.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert(firstEnabledButton.textContent.includes("Added"), "clicking add-to-cart updates the button label");
  }

  // -----------------------------------------------------------
  // Test group 6: ProductDetail renders real product data
  // -----------------------------------------------------------
  await freshDom("/product/inv-2000");
  {
    const renderProductDetail = (await import("./src/components/ProductDetail.js?t=6")).default;
    const outlet = document.getElementById("outlet");
    renderProductDetail(outlet, { id: "inv-2000" });

    assert(outlet.querySelector("h1").textContent.includes("Sentinel 2000VA"), "detail page renders the correct product name");
    assert(outlet.querySelectorAll(".spec-list dt").length === 4, "all spec rows render");

    renderProductDetail(outlet, { id: "does-not-exist" });
    assert(outlet.textContent.includes("not found"), "unknown product id shows a not-found message instead of crashing");
  }

  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error("Test harness crashed:", error);
  process.exit(1);
});
