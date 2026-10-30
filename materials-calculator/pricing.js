// Price provider ("supplier pricing API"). Ships with a built-in sample catalog so the app
// works with no key or server. To use live prices, set PRICE_API_URL to an endpoint that
// returns JSON in the same shape as SAMPLE_SUPPLIERS: [{ id, name, note, prices: { materialId: price } }].

const PRICE_API_URL = "";

// Sample prices (USD) for illustration only – edit them in the app to match real quotes.
const SAMPLE_SUPPLIERS = [
  {
    id: "harbor",
    name: "Harbor Lumber Yard",
    note: "Local yard",
    prices: {
      concrete_bag: 6.48, ready_mix: 165, rebar: 13.98, gravel: 48,
      stud_8: 3.98, stud_10: 6.48, plate: 3.98, framing_nails: 24.97,
      drywall: 15.98, joint_compound: 19.98, drywall_tape: 5.48, drywall_screws: 32.97,
      paint: 38.98, primer: 27.98, tile: 21.9, thinset: 18.98, grout: 21.98,
      brick: 0.68, mortar: 9.98, shingles: 36.97, underlayment: 98, roofing_nails: 69.98, drip_edge: 9.48,
    },
  },
  {
    id: "summit",
    name: "Summit Building Supply",
    note: "Contractor supplier",
    prices: {
      concrete_bag: 6.2, ready_mix: 158, rebar: 12.75, gravel: 42,
      stud_8: 4.25, stud_10: 6.95, plate: 4.25, framing_nails: 22.5,
      drywall: 14.75, joint_compound: 18.5, drywall_tape: 4.95, drywall_screws: 29.99,
      paint: 34.99, primer: 24.5, tile: 24.5, thinset: 16.75, grout: 19.5,
      brick: 0.62, mortar: 9.25, shingles: 34.5, underlayment: 92.5, roofing_nails: 64.5, drip_edge: 8.75,
    },
  },
  {
    id: "metro",
    name: "Metro Wholesale Materials",
    note: "Wholesale, bulk pricing",
    prices: {
      concrete_bag: 5.95, ready_mix: 172, rebar: 14.5, gravel: 52,
      stud_8: 3.65, stud_10: 5.98, plate: 3.65, framing_nails: 21,
      drywall: 13.9, joint_compound: 21.25, drywall_tape: 4.75, drywall_screws: 28.5,
      paint: 32.5, primer: 22.99, tile: 19.8, thinset: 17.5, grout: 18.75,
      brick: 0.59, mortar: 8.75, shingles: 38.25, underlayment: 89.99, roofing_nails: 62, drip_edge: 8.25,
    },
  },
];

const PricingAPI = {
  source: "sample",

  async loadSuppliers() {
    if (PRICE_API_URL) {
      try {
        const res = await fetch(PRICE_API_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data) && data.length) {
          PricingAPI.source = "live";
          return data;
        }
      } catch (err) {
        console.warn("Price API unavailable, using sample prices:", err);
      }
    }
    PricingAPI.source = "sample";
    return structuredClone(SAMPLE_SUPPLIERS);
  },

  // Price for one material at one supplier, with the user's own quote taking precedence.
  priceOf(supplier, materialId, overrides = {}) {
    const custom = overrides[supplier.id]?.[materialId];
    if (Number.isFinite(custom)) return custom;
    const price = supplier.prices[materialId];
    return Number.isFinite(price) ? price : null;
  },

  // Cheapest supplier for a material; ties go to the first supplier listed.
  cheapest(suppliers, materialId, overrides) {
    let best = null;
    for (const supplier of suppliers) {
      const price = PricingAPI.priceOf(supplier, materialId, overrides);
      if (price !== null && (best === null || price < best.price)) best = { supplier, price };
    }
    return best;
  },
};

if (typeof module !== "undefined") module.exports = { PricingAPI, SAMPLE_SUPPLIERS };
