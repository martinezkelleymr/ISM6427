// BuildCost – UI layer. Quantities come from MaterialsAPI (calculator.js),
// prices from PricingAPI (pricing.js).

const $ = (id) => document.getElementById(id);
const BEST = "best";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const qtyFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

// ---------- storage helpers (safe in private mode) ----------
function load(key) {
  try {
    return JSON.parse(localStorage.getItem(`buildcost:${key}`));
  } catch {
    return null;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(`buildcost:${key}`, JSON.stringify(value));
  } catch {
    /* storage unavailable – the app still works for this visit */
  }
}

function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const state = {
  type: load("type") || "slab",
  drafts: load("drafts") || {},
  jobs: load("jobs") || [],
  supplier: load("supplier") || BEST,
  settings: { tax: 7, delivery: 0, labor: 0, contingency: 10, ...(load("settings") || {}) },
  overrides: load("overrides") || {},
  suppliers: [],
  editingId: null,
};

// Drop anything saved by an older version that the engine no longer knows about.
state.jobs = state.jobs.filter((job) => MaterialsAPI.types[job.type]);
if (!MaterialsAPI.types[state.type]) state.type = "slab";

function persist() {
  save("type", state.type);
  save("drafts", state.drafts);
  save("jobs", state.jobs);
  save("supplier", state.supplier);
  save("settings", state.settings);
  save("overrides", state.overrides);
}

function draft(typeId = state.type) {
  if (!state.drafts[typeId]) state.drafts[typeId] = MaterialsAPI.defaults(typeId);
  return state.drafts[typeId];
}

// ---------- step 1: calculator ----------
function renderTypePicker() {
  $("type-picker").innerHTML = Object.entries(MaterialsAPI.types)
    .map(
      ([id, t]) => `
      <button type="button" role="tab" class="type-chip glass-inner" data-type="${id}" aria-selected="${id === state.type}">
        <span aria-hidden="true">${t.icon}</span> ${esc(t.label)}
      </button>`
    )
    .join("");
}

function renderFields() {
  const type = MaterialsAPI.types[state.type];
  const values = draft();
  $("fields").innerHTML = Object.entries(type.fields)
    .map(([key, f]) => {
      const label = `<span>${esc(f.label)}${f.unit ? ` <small>${esc(f.unit)}</small>` : ""}</span>`;
      if (f.type === "select") {
        const options = Object.entries(f.options)
          .map(([v, text]) => `<option value="${esc(v)}"${String(values[key]) === v ? " selected" : ""}>${esc(text)}</option>`)
          .join("");
        return `<label class="field">${label}<select name="${key}">${options}</select></label>`;
      }
      return `<label class="field">${label}<input name="${key}" type="number" inputmode="decimal" min="${f.min}" step="${f.step}" value="${esc(values[key])}" /></label>`;
    })
    .join("");
  $("waste").value = values.waste;
  $("calc-form").querySelector("button[type=submit]").textContent = state.editingId ? "✓ Save changes" : "＋ Add to project";
}

function renderPreview() {
  const { items, summary } = MaterialsAPI.calculate(state.type, draft());
  $("preview-summary").textContent = summary;
  $("preview-list").innerHTML = items.length
    ? items
        .map(({ materialId, quantity }) => {
          const m = MaterialsAPI.materials[materialId];
          const best = PricingAPI.cheapest(state.suppliers, materialId, state.overrides);
          return `<li><span>${esc(m.name)}</span><strong>${qtyFmt.format(quantity)} ${esc(m.unit)}</strong>${
            best ? `<small class="muted">from ${money.format(best.price)}/${esc(m.unit)}</small>` : ""
          }</li>`;
        })
        .join("")
    : `<li class="muted">Enter dimensions to see materials.</li>`;
}

function selectType(typeId) {
  state.type = typeId;
  state.editingId = null;
  $("job-label").value = "";
  renderTypePicker();
  renderFields();
  renderPreview();
  persist();
}

// ---------- step 2: estimate ----------
function lineItems() {
  return MaterialsAPI.combine(state.jobs).map(({ materialId, quantity }) => {
    const material = MaterialsAPI.materials[materialId];
    let supplier = null;
    let price = null;
    if (state.supplier === BEST) {
      const best = PricingAPI.cheapest(state.suppliers, materialId, state.overrides);
      if (best) ({ supplier, price } = best);
    } else {
      supplier = state.suppliers.find((s) => s.id === state.supplier) || null;
      price = supplier ? PricingAPI.priceOf(supplier, materialId, state.overrides) : null;
    }
    return { materialId, material, quantity, supplier, price, total: price === null ? 0 : price * quantity };
  });
}

function costBreakdown(materialsSubtotal) {
  const s = state.settings;
  const tax = materialsSubtotal * (s.tax / 100);
  const labor = materialsSubtotal * (s.labor / 100);
  const beforeContingency = materialsSubtotal + tax + s.delivery + labor;
  const contingency = beforeContingency * (s.contingency / 100);
  return { materials: materialsSubtotal, tax, delivery: s.delivery, labor, contingency, total: beforeContingency + contingency };
}

function renderJobs() {
  const hasJobs = state.jobs.length > 0;
  $("empty-state").hidden = hasJobs;
  $("estimate-body").hidden = !hasJobs;
  $("compare-section").hidden = !hasJobs;
  $("job-list").innerHTML = state.jobs
    .map((job) => {
      const type = MaterialsAPI.types[job.type];
      const { summary } = MaterialsAPI.calculate(job.type, job.inputs);
      return `
      <li class="job glass-inner${job.id === state.editingId ? " editing" : ""}">
        <span class="job-icon" aria-hidden="true">${type.icon}</span>
        <div class="job-text"><strong>${esc(job.label)}</strong><small class="muted">${esc(type.label)} · ${esc(summary)}</small></div>
        <button type="button" class="link-btn" data-edit="${job.id}">Edit</button>
        <button type="button" class="link-btn" data-remove="${job.id}" aria-label="Remove ${esc(job.label)}">✕</button>
      </li>`;
    })
    .join("");
}

function renderSupplierSelect() {
  if (state.supplier !== BEST && !state.suppliers.some((s) => s.id === state.supplier)) state.supplier = BEST;
  $("supplier-select").innerHTML =
    `<option value="${BEST}">⭐ Best price (mix suppliers)</option>` +
    state.suppliers.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");
  $("supplier-select").value = state.supplier;
}

function renderEstimate() {
  const items = lineItems();
  $("estimate-rows").innerHTML = items
    .map(
      (it) => `
      <tr>
        <td>${esc(it.material.name)}</td>
        <td class="num">${qtyFmt.format(it.quantity)} <small class="muted">${esc(it.material.unit)}</small></td>
        <td class="num">${it.price === null ? "—" : money.format(it.price)}</td>
        <td class="supplier-col muted">${it.supplier ? esc(it.supplier.name) : "No price"}</td>
        <td class="num"><strong>${it.price === null ? "—" : money.format(it.total)}</strong></td>
      </tr>`
    )
    .join("");

  const c = costBreakdown(items.reduce((sum, it) => sum + it.total, 0));
  const s = state.settings;
  const rows = [
    ["Materials", c.materials],
    [`Sales tax (${s.tax}%)`, c.tax],
    ["Delivery", c.delivery],
    [`Labor (${s.labor}%)`, c.labor],
    [`Contingency (${s.contingency}%)`, c.contingency],
  ];
  $("totals-list").innerHTML =
    rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${money.format(value)}</dd></div>`).join("") +
    `<div class="grand"><dt>Estimated total</dt><dd>${money.format(c.total)}</dd></div>`;
}

// ---------- step 3: supplier comparison ----------
function renderCompare() {
  const materials = MaterialsAPI.combine(state.jobs);
  if (!materials.length) return;
  const focusedKey = document.activeElement?.dataset?.key;

  $("price-note").textContent =
    PricingAPI.source === "live"
      ? "Live supplier prices. Click any price to replace it with your own quote."
      : "Sample prices for illustration. Click any price to replace it with a real quote from your supplier.";

  $("compare-head").innerHTML = `<tr><th>Material</th><th class="num">Qty</th>${state.suppliers
    .map((s) => `<th class="num">${esc(s.name)}<small class="muted">${esc(s.note || "")}</small></th>`)
    .join("")}</tr>`;

  const totals = Object.fromEntries(state.suppliers.map((s) => [s.id, 0]));
  const missing = Object.fromEntries(state.suppliers.map((s) => [s.id, 0]));
  let bestMix = 0;

  $("compare-rows").innerHTML = materials
    .map(({ materialId, quantity }) => {
      const m = MaterialsAPI.materials[materialId];
      const best = PricingAPI.cheapest(state.suppliers, materialId, state.overrides);
      if (best) bestMix += best.price * quantity;
      const cells = state.suppliers
        .map((s) => {
          const price = PricingAPI.priceOf(s, materialId, state.overrides);
          if (price === null) missing[s.id] += 1;
          else totals[s.id] += price * quantity;
          const isBest = best && price === best.price;
          const edited = Number.isFinite(state.overrides[s.id]?.[materialId]);
          return `<td class="num price-cell${isBest ? " best" : ""}">
            <input class="price-input${edited ? " edited" : ""}" type="number" min="0" step="0.01" inputmode="decimal"
              value="${price ?? ""}" placeholder="—" data-supplier="${esc(s.id)}" data-material="${materialId}"
              data-key="${esc(s.id)}:${materialId}" aria-label="${esc(s.name)} price for ${esc(m.name)}" />
            <small>${price === null ? "no price" : money.format(price * quantity)}</small>
          </td>`;
        })
        .join("");
      return `<tr><td>${esc(m.name)}<small class="muted">per ${esc(m.unit)}</small></td><td class="num">${qtyFmt.format(quantity)}</td>${cells}</tr>`;
    })
    .join("");

  const complete = state.suppliers.filter((s) => missing[s.id] === 0);
  const cheapestId = complete.length ? complete.reduce((a, b) => (totals[a.id] <= totals[b.id] ? a : b)).id : null;

  $("compare-foot").innerHTML = `<tr><th>Materials subtotal</th><td></td>${state.suppliers
    .map((s) => `<td class="num${s.id === cheapestId ? " best" : ""}"><strong>${money.format(totals[s.id])}</strong></td>`)
    .join("")}</tr>`;

  const highest = Math.max(...complete.map((s) => totals[s.id]), bestMix);
  const card = (id, title, subtotal, extra) => {
    const total = costBreakdown(subtotal).total;
    const savings = highest - subtotal;
    return `
      <button type="button" class="compare-card glass-inner${state.supplier === id ? " selected" : ""}" data-supplier-card="${esc(id)}">
        <span class="muted small">${esc(title)}</span>
        <strong class="card-total">${money.format(total)}</strong>
        <span class="small">${money.format(subtotal)} materials</span>
        ${extra}
        ${savings > 0.005 ? `<span class="badge save">Save ${money.format(savings)} on materials</span>` : ""}
      </button>`;
  };

  $("compare-cards").innerHTML =
    card(BEST, "⭐ Best price (mix suppliers)", bestMix, "") +
    state.suppliers
      .map((s) =>
        card(
          s.id,
          s.name,
          totals[s.id],
          missing[s.id]
            ? `<span class="badge warn">${missing[s.id]} item(s) not priced</span>`
            : s.id === cheapestId
              ? `<span class="badge best">Cheapest single supplier</span>`
              : ""
        )
      )
      .join("");

  if (focusedKey) document.querySelector(`[data-key="${CSS.escape(focusedKey)}"]`)?.focus();
}

function renderProject() {
  renderJobs();
  renderSupplierSelect();
  renderEstimate();
  renderCompare();
}

// ---------- export ----------
function exportCsv() {
  const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const items = lineItems();
  const lines = [
    ["Material", "Quantity", "Unit", "Unit price", "Supplier", "Line total", ...state.suppliers.map((s) => `${s.name} unit price`)],
    ...items.map((it) => [
      it.material.name,
      it.quantity,
      it.material.unit,
      it.price ?? "",
      it.supplier?.name ?? "",
      it.price === null ? "" : it.total.toFixed(2),
      ...state.suppliers.map((s) => PricingAPI.priceOf(s, it.materialId, state.overrides) ?? ""),
    ]),
    [],
  ];
  const c = costBreakdown(items.reduce((sum, it) => sum + it.total, 0));
  for (const [label, value] of Object.entries(c)) lines.push([label, "", "", "", "", value.toFixed(2)]);

  const blob = new Blob([lines.map((row) => row.map(cell).join(",")).join("\n")], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "buildcost-estimate.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// ---------- events ----------
$("type-picker").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-type]");
  if (chip) selectType(chip.dataset.type);
});

$("calc-form").addEventListener("input", (e) => {
  if (!e.target.name) return;
  draft()[e.target.name] = e.target.value;
  renderPreview();
  persist();
});

$("calc-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const type = MaterialsAPI.types[state.type];
  const inputs = { ...draft() };
  const label = $("job-label").value.trim() || `${type.label} ${state.jobs.filter((j) => j.type === state.type).length + 1}`;
  const existing = state.jobs.find((j) => j.id === state.editingId);
  if (existing) Object.assign(existing, { inputs, label });
  else state.jobs.push({ id: crypto.randomUUID?.() || String(Date.now()), type: state.type, label, inputs });
  state.editingId = null;
  $("job-label").value = "";
  renderFields();
  renderProject();
  persist();
});

$("job-list").addEventListener("click", (e) => {
  const removeId = e.target.closest("[data-remove]")?.dataset.remove;
  const editId = e.target.closest("[data-edit]")?.dataset.edit;
  if (removeId) {
    state.jobs = state.jobs.filter((j) => j.id !== removeId);
    if (state.editingId === removeId) state.editingId = null;
  } else if (editId) {
    const job = state.jobs.find((j) => j.id === editId);
    state.type = job.type;
    state.drafts[job.type] = { ...job.inputs };
    state.editingId = job.id;
    renderTypePicker();
    renderFields();
    renderPreview();
    $("job-label").value = job.label;
    $("calc-form").scrollIntoView({ behavior: "smooth", block: "start" });
  } else return;
  renderFields();
  renderProject();
  persist();
});

$("supplier-select").addEventListener("change", (e) => {
  state.supplier = e.target.value;
  renderProject();
  persist();
});

for (const key of ["tax", "delivery", "labor", "contingency"]) {
  $(key).value = state.settings[key];
  $(key).addEventListener("input", (e) => {
    state.settings[key] = Math.max(0, Number(e.target.value) || 0);
    renderEstimate();
    renderCompare();
    persist();
  });
}

$("compare-rows").addEventListener("change", (e) => {
  const input = e.target.closest(".price-input");
  if (!input) return;
  const { supplier, material } = input.dataset;
  const base = state.suppliers.find((s) => s.id === supplier)?.prices[material];
  const value = input.value === "" ? null : Math.max(0, Number(input.value));
  state.overrides[supplier] = state.overrides[supplier] || {};
  if (value === null || value === base) delete state.overrides[supplier][material];
  else state.overrides[supplier][material] = value;
  persist();
  // Defer so focus has moved to the next field before the table is redrawn.
  setTimeout(() => {
    renderPreview();
    renderEstimate();
    renderCompare();
  });
});

$("compare-cards").addEventListener("click", (e) => {
  const card = e.target.closest("[data-supplier-card]");
  if (!card) return;
  state.supplier = card.dataset.supplierCard;
  renderProject();
  persist();
  $("estimate-title").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("reset-prices").addEventListener("click", () => {
  if (!confirm("Discard your edited prices and restore the original supplier prices?")) return;
  state.overrides = {};
  persist();
  renderPreview();
  renderProject();
});

$("clear-btn").addEventListener("click", () => {
  if (!confirm("Remove all calculations from this project?")) return;
  state.jobs = [];
  state.editingId = null;
  renderFields();
  renderProject();
  persist();
});

$("export-btn").addEventListener("click", exportCsv);
$("print-btn").addEventListener("click", () => window.print());

// ---------- theme ----------
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function applyTheme(pref) {
  const dark = pref === "dark" || (pref === "system" && darkQuery.matches);
  document.documentElement.dataset.mode = dark ? "dark" : "light";
  document.querySelectorAll("[data-theme-choice]").forEach((btn) => {
    btn.setAttribute("aria-checked", String(btn.dataset.themeChoice === pref));
  });
}

let themePref = load("theme") || "system";
applyTheme(themePref);
document.querySelector(".theme-switch").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-theme-choice]");
  if (!btn) return;
  themePref = btn.dataset.themeChoice;
  save("theme", themePref);
  applyTheme(themePref);
});
darkQuery.addEventListener("change", () => themePref === "system" && applyTheme("system"));

// ---------- start ----------
(async function init() {
  state.suppliers = await PricingAPI.loadSuppliers();
  renderTypePicker();
  renderFields();
  renderPreview();
  renderProject();
})();
