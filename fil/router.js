/**
 * router/router.js
 *
 * A small History API router with no dependencies. Three jobs:
 *
 *   1. Match the current URL path against a list of registered
 *      routes (supporting :param segments) and call the matching
 *      route's render function into a single outlet element.
 *
 *   2. Intercept clicks on same-origin <a href="..."> links so
 *      in-app navigation uses pushState instead of triggering a
 *      full page reload — this is what makes it feel like an SPA
 *      rather than a normal multi-page site.
 *
 *   3. Listen for the browser's back/forward buttons (the
 *      `popstate` event) and re-render to match, since pushState
 *      alone doesn't trigger any event on its own.
 *
 * Because this uses real URLs (History API, not #hash routing),
 * the server has to be configured to serve index.html for every
 * path — otherwise a hard reload or a direct link to /product/3
 * 404s, since there's no actual file at that path. See the
 * deploy configs (vercel.json, _redirects, render.yaml) shipped
 * alongside this project for that rewrite rule on each platform.
 */

export function createRouter(outletElement) {
  /** @type {{ pattern: string, paramNames: string[], regex: RegExp, render: (params: Record<string,string>) => void | Promise<void> }[]} */
  const routes = [];

  let currentCleanup = null;

  /**
   * Registers a route. `pattern` uses :name for dynamic segments,
   * e.g. "/product/:id" matches "/product/inv-2000" with
   * params = { id: "inv-2000" }.
   */
  function addRoute(pattern, render) {
    const paramNames = [];
    const regexSource = pattern
      .split("/")
      .map((segment) => {
        if (segment.startsWith(":")) {
          paramNames.push(segment.slice(1));
          return "([^/]+)";
        }
        // Escape regex special characters in static segments so a
        // literal "." or "+" in a route path is treated literally.
        return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("/");

    routes.push({
      pattern,
      paramNames,
      regex: new RegExp("^" + regexSource + "/?$"),
      render,
    });
  }

  function matchRoute(pathname) {
    for (const route of routes) {
      const match = route.regex.exec(pathname);
      if (match) {
        const params = {};
        route.paramNames.forEach((name, index) => {
          params[name] = decodeURIComponent(match[index + 1]);
        });
        return { route, params };
      }
    }
    return null;
  }

  let notFoundRender = () => {
    outletElement.innerHTML = "<p>Page not found.</p>";
  };

  function setNotFound(render) {
    notFoundRender = render;
  }

  async function render() {
    // Each route's render function may return a cleanup callback
    // (e.g. to unsubscribe from the cart store) — run the previous
    // page's cleanup before mounting the next one, so navigating
    // away from a page never leaves a dangling subscription behind.
    if (typeof currentCleanup === "function") {
      currentCleanup();
      currentCleanup = null;
    }

    const matched = matchRoute(window.location.pathname);

    // Scroll to top on every navigation — without this, navigating
    // from the bottom of a long product list to a detail page would
    // land the user mid-scroll on the new page, which reads as a
    // bug even though it's technically "correct" SPA behavior.
    window.scrollTo(0, 0);

    if (!matched) {
      currentCleanup = (await notFoundRender()) || null;
      return;
    }

    currentCleanup = (await matched.route.render(matched.params)) || null;
  }

  /**
   * Programmatic navigation — used by code (e.g. "Add to cart,
   * then go to checkout") rather than a literal link click.
   */
  function navigate(path) {
    if (path === window.location.pathname) return;
    window.history.pushState({}, "", path);
    render();
  }

  function handleLinkClick(event) {
    // Only intercept plain left-clicks with no modifier keys held
    // — Ctrl/Cmd+click, middle-click, etc. are how people open
    // links in a new tab, and hijacking those would break that
    // expected browser behavior.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const link = event.target.closest("a");
    if (!link) return;

    // Only intercept same-origin links without a target="_blank"
    // (or similar) and without a download attribute — anything
    // else (external links, explicit new-tab links, file downloads)
    // should behave like a normal anchor tag.
    const url = new URL(link.href, window.location.href);
    const isSameOrigin = url.origin === window.location.origin;
    const opensElsewhere = link.target && link.target !== "_self";

    if (!isSameOrigin || opensElsewhere || link.hasAttribute("download")) {
      return;
    }

    event.preventDefault();
    navigate(url.pathname + url.search);
  }

  function start() {
    document.addEventListener("click", handleLinkClick);
    window.addEventListener("popstate", render);
    render(); // initial render for whatever URL the page loaded on
  }

  return { addRoute, setNotFound, navigate, start };
}
