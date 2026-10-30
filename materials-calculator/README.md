# BuildCost – Construction Materials Cost Calculator

A glassmorphic web app that calculates material quantities for a construction project,
shows the price per material, estimates the total cost, and compares suppliers.

## Features
- 7 calculators: concrete slab, wall framing, drywall, interior paint, tile flooring, brick wall, shingle roof
- Waste allowance per calculation; quantities rounded up to how materials are sold (bags, sheets, boxes…)
- Combine several calculations into one project estimate
- Buy from one supplier or "Best price" (cheapest supplier per item)
- Totals with sales tax, delivery, labor (% of materials) and contingency
- Supplier comparison table with the cheapest price highlighted, plus savings per option
- Click any price to enter your own supplier quote (saved in the browser)
- CSV export, print view, Light / Dark / System themes

## Files
- `calculator.js` – quantity engine (`MaterialsAPI`): formulas and rules of thumb, no DOM code
- `pricing.js` – supplier price provider (`PricingAPI`): built-in sample catalog, optional live API
- `app.js` – UI rendering and events
- `index.html`, `style.css` – markup and glassmorphism styles
- `netlify.toml` – Netlify config (static site, no build step)

## Prices
Supplier names and prices are **sample data for illustration**, not real quotes. Edit them in the
app, or point `PRICE_API_URL` in `pricing.js` at an endpoint that returns JSON shaped like
`SAMPLE_SUPPLIERS`: `[{ "id", "name", "note", "prices": { "<materialId>": 12.34 } }]`.
If the endpoint fails, the app falls back to the sample prices.

## Run locally
Open `index.html` in a browser, or serve this folder:
```
python3 -m http.server 8000
```

## Deploy to Netlify
- **Netlify Drop:** drag the `materials-calculator` folder onto https://app.netlify.com/drop
- **Connected repo:** set *Base directory* to `materials-calculator`, leave the build command empty;
  the publish directory comes from this folder's `netlify.toml`.
