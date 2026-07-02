/**
 * data/products.js
 *
 * The catalog's data layer, isolated in its own module. In a real
 * backend-attached app this file would be replaced by a fetch()
 * call to an API (and could be, without touching any other module
 * — every consumer below imports `getProducts`/`getProductById`,
 * never the raw array, so swapping the implementation to async
 * fetching later only means making these two functions async and
 * updating their callers to await them).
 */

const PRODUCTS = [
  {
    id: "inv-2000",
    name: "Sentinel 2000VA Inverter",
    category: "Inverters",
    price: 8499,
    currency: "INR",
    image: "/src/assets/img/inverter-1.jpg",
    blurb: "Pure sine wave output for sensitive electronics, 2000VA capacity.",
    description:
      "A pure sine wave inverter built for homes running sensitive electronics — routers, laptops, medical devices — through outages. 2000VA capacity covers a typical 2-3 room household load. Includes overload, short-circuit, and deep-discharge protection.",
    specs: {
      Capacity: "2000VA / 1600W",
      "Output waveform": "Pure sine wave",
      "Input voltage range": "100V – 290V",
      Warranty: "2 years",
    },
    inStock: true,
  },
  {
    id: "inv-3500",
    name: "Sentinel 3500VA Inverter",
    category: "Inverters",
    price: 13999,
    currency: "INR",
    image: "/src/assets/img/inverter-2.jpg",
    blurb: "Higher-capacity sine wave inverter for larger homes or small shops.",
    description:
      "Steps up to 3500VA for households or small retail spaces running more simultaneous load — lighting, fans, a refrigerator, and a few electronics together. Same pure sine wave output and protection suite as the 2000VA model, in a larger chassis with improved heat dissipation.",
    specs: {
      Capacity: "3500VA / 2800W",
      "Output waveform": "Pure sine wave",
      "Input voltage range": "100V – 290V",
      Warranty: "2 years",
    },
    inStock: true,
  },
  {
    id: "bat-agm-150",
    name: "PowerCell AGM 150Ah",
    category: "Batteries",
    price: 15999,
    currency: "INR",
    image: "/src/assets/img/battery-agm.jpg",
    blurb: "Maintenance-free AGM battery, 150Ah, built for daily deep cycling.",
    description:
      "Absorbed Glass Mat construction means no water top-ups and no spill risk — install it anywhere, including upright in tight spaces. Rated for daily deep discharge cycles, which matters for households running the inverter through long outages rather than occasional backup.",
    specs: {
      Capacity: "150Ah",
      Type: "AGM (maintenance-free)",
      "Cycle life": "~1200 cycles at 50% DoD",
      Warranty: "3 years",
    },
    inStock: true,
  },
  {
    id: "bat-vrla-100",
    name: "PowerCell VRLA 100Ah",
    category: "Batteries",
    price: 9499,
    currency: "INR",
    image: "/src/assets/img/battery-vrla.jpg",
    blurb: "Sealed VRLA battery, 100Ah, the standard reliable choice.",
    description:
      "Valve-Regulated Lead-Acid — the standard, well-understood battery chemistry most households already know. Sealed construction, no maintenance required. A solid, lower-cost option for moderate backup needs.",
    specs: {
      Capacity: "100Ah",
      Type: "VRLA (sealed, maintenance-free)",
      "Cycle life": "~500 cycles at 50% DoD",
      Warranty: "18 months",
    },
    inStock: true,
  },
  {
    id: "bat-li-100",
    name: "PowerCell Lithium-Ion 100Ah",
    category: "Batteries",
    price: 38999,
    currency: "INR",
    image: "/src/assets/img/battery-lithium.jpg",
    blurb: "Lithium-ion battery — lighter, faster-charging, much longer life.",
    description:
      "Roughly a third of the weight of an equivalent lead-acid battery, charges significantly faster, and rated for several times the cycle life. Higher upfront cost, but the lowest cost-per-cycle over the battery's life for anyone running the inverter frequently.",
    specs: {
      Capacity: "100Ah (effective ~95Ah usable)",
      Type: "Lithium Iron Phosphate (LiFePO4)",
      "Cycle life": "~3500 cycles at 80% DoD",
      Warranty: "5 years",
    },
    inStock: false,
  },
  {
    id: "tw-bat-standard",
    name: "RoadReady Two-Wheeler Battery",
    category: "Two-Wheeler Batteries",
    price: 1899,
    currency: "INR",
    image: "/src/assets/img/battery-2w.jpg",
    blurb: "Standard sealed battery for most scooters and motorcycles.",
    description:
      "A sealed, maintenance-free starter battery sized for the majority of commuter scooters and motorcycles. Pre-charged and ready to install — no acid filling required.",
    specs: {
      Capacity: "5Ah",
      Type: "Sealed VRLA",
      Fitment: "Universal — most scooters & 100-150cc motorcycles",
      Warranty: "12 months",
    },
    inStock: true,
  },
  {
    id: "tw-bat-performance",
    name: "RoadReady Performance Battery",
    category: "Two-Wheeler Batteries",
    price: 2799,
    currency: "INR",
    image: "/src/assets/img/battery-2w-performance.jpg",
    blurb: "Higher cold-cranking amps for bigger bikes and cold starts.",
    description:
      "Built for larger-displacement motorcycles or riders in colder climates where cold-cranking performance matters most. Higher CCA rating than the standard model, same maintenance-free sealed construction.",
    specs: {
      Capacity: "9Ah",
      Type: "Sealed VRLA, high-CCA",
      Fitment: "150cc+ motorcycles",
      Warranty: "18 months",
    },
    inStock: true,
  },
];

/**
 * Returns the full catalog, optionally filtered by category and/or
 * a free-text search term against name + blurb. Kept synchronous
 * for now since PRODUCTS is a static in-memory array — see the
 * file header for how this would change if backed by a real API.
 */
export function getProducts({ category = null, search = "" } = {}) {
  const term = search.trim().toLowerCase();

  return PRODUCTS.filter((product) => {
    const matchesCategory = !category || product.category === category;
    const matchesSearch =
      term === "" ||
      product.name.toLowerCase().includes(term) ||
      product.blurb.toLowerCase().includes(term);
    return matchesCategory && matchesSearch;
  });
}

export function getProductById(id) {
  return PRODUCTS.find((product) => product.id === id) || null;
}

export function getCategories() {
  return [...new Set(PRODUCTS.map((product) => product.category))];
}

export function formatPrice(amount, currency) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
