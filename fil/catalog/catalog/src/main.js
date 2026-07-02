/**
 * main.js — application entry point.
 *
 * Loaded as <script type="module"> from index.html. Wires the
 * header, the router, and registers each route against its
 * component module. This file is intentionally thin — it's
 * composition, not logic; the actual behavior lives in the
 * modules it imports.
 */
import { createRouter } from "./router/router.js";
import { renderHeader } from "./components/Header.js";
import renderProductList from "./components/ProductList.js";
import renderProductDetail from "./components/ProductDetail.js";
import renderCart from "./components/Cart.js";
import renderNotFound from "./components/NotFound.js";

const headerElement = document.getElementById("site-header");
const outletElement = document.getElementById("outlet");

renderHeader(headerElement);

const router = createRouter(outletElement);

router.addRoute("/", () => renderProductList(outletElement));
router.addRoute("/product/:id", (params) => renderProductDetail(outletElement, params));
router.addRoute("/cart", () => renderCart(outletElement));
router.setNotFound(() => renderNotFound(outletElement));

router.start();
