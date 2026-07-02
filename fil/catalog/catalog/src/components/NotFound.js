/**
 * components/NotFound.js
 * Rendered by the router when no route pattern matches the current
 * path at all (distinct from ProductDetail's own "no such product
 * id" case, which is a valid route shape with missing data).
 */
export default function renderNotFound(outletElement) {
  outletElement.innerHTML = `
    <section aria-labelledby="notfound-heading">
      <p class="eyebrow">404</p>
      <h1 id="notfound-heading">Page not found</h1>
      <p>There's nothing at this address. Head back to the catalog.</p>
      <p><a class="inline-link" href="/">Back to the catalog &rarr;</a></p>
    </section>
  `;
}
