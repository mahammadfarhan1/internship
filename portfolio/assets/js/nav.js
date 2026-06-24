/**
 * nav.js — progressive-enhancement only.
 * The site is fully navigable and readable with this file blocked or failing.
 * It just adds a collapsible mobile menu and active-state ARIA wiring.
 */
(function () {
  "use strict";

  function initNav() {
    var toggle = document.querySelector(".topbar__toggle");
    var ledger = document.getElementById("primary-nav");
    if (!toggle || !ledger) return;

    toggle.addEventListener("click", function () {
      var isOpen = ledger.getAttribute("data-open") === "true";
      ledger.setAttribute("data-open", String(!isOpen));
      toggle.setAttribute("aria-expanded", String(!isOpen));
      toggle.textContent = isOpen ? "Menu" : "Close";
    });

    // Close the mobile menu after a nav link is chosen, so focus
    // moves naturally to the new page rather than a stale open panel.
    ledger.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        ledger.setAttribute("data-open", "false");
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "Menu";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", initNav);
})();
