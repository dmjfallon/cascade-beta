

/* =====================================================
   Helpers
===================================================== */

/*
  formatMonths(totalMonths)

  PURPOSE:
  Convert a raw month count (e.g. 231) into a readable string.

 Used for display purposes only.
 Does not affect calculation logic.

  Example:
    25 → "2 years 1 months"
    12 → "1 years"
    5  → "5 months"
*/
function formatMonths(totalMonths) {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  if (years === 0) return `${months} months`;
  if (months === 0) return `${years} years`;
  return `${years} years ${months} months`;
}

/*
  mortgageFreeDateFromNow(months)

  PURPOSE:
  Convert number of months into a real calendar month + year.

  Example:
    If today is Jan 2026 and months = 24,
    returns "January 2028".

  This is purely cosmetic.
*/
function mortgageFreeDateFromNow(months) {
  const now = new Date();
  const future = new Date(
    now.getFullYear(),
    now.getMonth() + months,
    1
  );

  return future.toLocaleString("default", {
    month: "long",
    year: "numeric"
  });
}

/* =====================================================
   Validation Layer
===================================================== */

/*
  FIELD_RULES

  This defines:
    - Min values
    - Max values
    - Integer-only fields
    - Helper text labels

  It protects the engine from nonsense input like:
    - negative balances
    - 500% interest
    - 200 year mortgages
*/
const FIELD_RULES = {
  "m1-balance": { min: 1, max: 100000000, label: "£1 – £100,000,000" },
  "m2-balance": { min: 1, max: 100000000, label: "£1 – £100,000,000" },
  "m1-rate": { min: 0, max: 25, label: "0% – 25%" },
  "m2-rate": { min: 0, max: 25, label: "0% – 25%" },
  "m1-years": { min: 0, max: 50, integer: true, label: "0 – 50 years" },
  "m2-years": { min: 0, max: 50, integer: true, label: "0 – 50 years" },
  "m1-months": { min: 0, max: 11, integer: true, label: "0 – 11 months" },
  "m2-months": { min: 0, max: 11, integer: true, label: "0 – 11 months" },
  "m1-extra": { min: 0, max: 100000, label: "£0 – £100,000" },
  "m2-extra": { min: 0, max: 100000, label: "£0 – £100,000" }
};

/*
  addHelperText(input)

  Adds small grey helper text under each input.
  Does not affect logic.
*/
function addHelperText(input) {
  const rule = FIELD_RULES[input.id];
  if (!rule) return;

  const helper = document.createElement("div");
  helper.className = "helper-text";
  helper.innerText = "Allowed range: " + rule.label;
  input.parentNode.insertBefore(helper, input.nextSibling);
}

/*
  sanitizeAndClamp(input)

Triggered on input events.

Performs:
  - character sanitisation
  - decimal validation
  - value clamping to allowed ranges
*/
function sanitizeAndClamp(input) {

  const rule = FIELD_RULES[input.id];
  if (!rule) return;

  let value = input.value;

  // Remove minus
  value = value.replace(/-/g, "");

  // Allow only digits and dot
  value = value.replace(/[^\d.]/g, "");

  // Only one decimal point
  const parts = value.split(".");
  if (parts.length > 2) {
    value = parts[0] + "." + parts.slice(1).join("");
  }

  // Limit to 2 decimal places (for non-integers)
  if (!rule.integer && value.includes(".")) {
    const [whole, decimal] = value.split(".");
    value = whole + "." + decimal.slice(0, 2);
  }

  // Convert to number for clamping
// Only clamp if value is a complete valid number
if (value !== "" && !value.endsWith(".")) {

  let num = parseFloat(value);

  if (!isNaN(num)) {

    if (rule.integer) {
      num = Math.floor(num);
    }

    num = Math.min(Math.max(num, rule.min), rule.max);

    // Format to max 2 decimal places for non-integers
    if (!rule.integer) {
      num = Math.round(num * 100) / 100;
    }

    input.value = String(num);
    return;
  }
}

// Otherwise allow free typing
input.value = value;

  // Restore cursor position
if (input.type !== "number") {
}
}

/*
  validateAll()

  Enables/disables Calculate button.
  If ANY field invalid → disabled.
*/
function validateAll() {

  const btn = document.getElementById("calculate-btn");
  let valid = true;

Object.keys(FIELD_RULES).forEach(id => {
  const el = document.getElementById(id);

  // Allow blank extra fields (treated as 0)
  if ((id === "m1-extra" || id === "m2-extra") && el.value === "") {
    return;
  }

  if (!el.value || !isFinite(parseFloat(el.value))) {
    valid = false;
  }
});

// ---- ZERO TERM PROTECTION ----

const m1Balance = parseFloat(document.getElementById("m1-balance").value) || 0;
const m1Years   = parseInt(document.getElementById("m1-years").value) || 0;
const m1Months  = parseInt(document.getElementById("m1-months").value) || 0;

const m2Balance = parseFloat(document.getElementById("m2-balance").value) || 0;
const m2Years   = parseInt(document.getElementById("m2-years").value) || 0;
const m2Months  = parseInt(document.getElementById("m2-months").value) || 0;

if (m1Balance > 0 && (m1Years * 12 + m1Months) === 0) {
  valid = false;
}

if (m2Balance > 0 && (m2Years * 12 + m2Months) === 0) {
  valid = false;
}

btn.disabled = !valid;
}

/*
  setupValidation()

  Runs once on page load.
  Hooks validation logic to all inputs.
*/
function setupValidation() {

const inputs = document.querySelectorAll("input");

  inputs.forEach(input => {


    addHelperText(input);

   input.addEventListener("input", () => {
  sanitizeAndClamp(input);
  validateAll();
});

// blur validation currently disabled

  });

  validateAll();
}

/* =====================================================
   Preload Defaults
===================================================== */

/*
  preloadDefaults()

  Loads your example scenario when the page opens.
  This does NOT run calculations automatically.
*/
function preloadDefaults() {

  document.getElementById("m1-balance").value = 180000;
  document.getElementById("m1-rate").value = 4.7;
  document.getElementById("m1-years").value = 17;
  document.getElementById("m1-months").value = 5;
  document.getElementById("m1-extra").value = 500;

  document.getElementById("m2-balance").value = 250000;
  document.getElementById("m2-rate").value = 5.1;
  document.getElementById("m2-years").value = 25;
  document.getElementById("m2-months").value = 0;
  document.getElementById("m2-extra").value = 100;

  document.getElementById("redirect-scheduled").checked = true;
  document.getElementById("redirect-extra").checked = true;
}

/* =====================================================
   Main Calculation
===================================================== */

/*
  calculateFromUI()

  Bridges:
  HTML inputs → engine.js → UI rendering

  It:
    1. Reads values from inputs
    2. Builds mortgage objects
    3. Sends results to renderResults()
*/
function calculateFromUI() {

  const m1 = {
    balance: parseFloat(document.getElementById("m1-balance").value),
    rate: parseFloat(document.getElementById("m1-rate").value),
    months:
      parseInt(document.getElementById("m1-years").value) * 12 +
      parseInt(document.getElementById("m1-months").value)
  };

  const m2 = {
    balance: parseFloat(document.getElementById("m2-balance").value),
    rate: parseFloat(document.getElementById("m2-rate").value),
    months:
      parseInt(document.getElementById("m2-years").value) * 12 +
      parseInt(document.getElementById("m2-months").value)
  };

  function calculateMonthlyPayment(balance, annualRate, months) {
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return balance / months;

  return (
    balance *
    (monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
  );
}

  const extra1 =
    parseFloat(document.getElementById("m1-extra").value) || 0;

  const extra2 =
    parseFloat(document.getElementById("m2-extra").value) || 0;

  const redirectScheduled =
    document.getElementById("redirect-scheduled").checked;

  const redirectExtra =
    document.getElementById("redirect-extra").checked;



// Baseline = keeping mortgages separate (same extras, no redirect)
const baselineResult = calculateCascade(
  m1,
  m2,
  extra1,
  extra2,
  false,
  false,
  "avalanche"
);

  const avalanche = calculateCascade(
    m1,
    m2,
    extra1,
    extra2,
    redirectScheduled,
    redirectExtra,
    "avalanche"
  );

  const noOverpayResult = calculateCascade(
  m1,
  m2,
  0,
  0,
  false,
  false,
  "avalanche"
);


renderResults(
  avalanche,
  noOverpayResult,
);

 document.getElementById("results").scrollIntoView({ behavior: "smooth" });
}

/* =====================================================
   Render
===================================================== */

/*
  renderResults(avalanche)

  Takes results from engine.js
  and updates the HTML dynamically.

  No financial logic happens here.
*/
function renderResults(avalanche, noOverpayResult) {


  // Read optional mortgage names
const m1NameInput = document.getElementById("m1-name")?.value?.trim();
const m2NameInput = document.getElementById("m2-name")?.value?.trim();

const m1Name = m1NameInput || "Mortgage 1";
const m2Name = m2NameInput || "Mortgage 2";

// Mortgage-free date (based on avalanche cascade result)
const today = new Date();

const mortgageFree = new Date(
  today.getFullYear(),
  today.getMonth() + avalanche.cascade.months
);

const mortgageFreeDate =
  mortgageFree.toLocaleString("default", { month: "long" }) +
  " " +
  mortgageFree.getFullYear();

  

  const baseline = avalanche.baseline;
  const cascade = avalanche.cascade;

  // Attribution (extra payment breakdown)
const attribution = cascade.attribution || {};

const m1ExtraToM1 = Math.round(attribution.m1ExtraPaidToM1 || 0);
const m1ExtraToM2 = Math.round(attribution.m1ExtraPaidToM2 || 0);
const m2ExtraToM1 = Math.round(attribution.m2ExtraPaidToM1 || 0);
const m2ExtraToM2 = Math.round(attribution.m2ExtraPaidToM2 || 0);

const m1TotalExtra = m1ExtraToM1 + m1ExtraToM2;
const m2TotalExtra = m2ExtraToM1 + m2ExtraToM2;


  // Total amount paid = principal + interest
// Principal = original balances added together

const originalPrincipal =
  baseline.m1.balances[0] + baseline.m2.balances[0];

const baselineTotalPaid =
  originalPrincipal + baseline.interest;

const cascadeTotalPaid =
  originalPrincipal + cascade.interest;

  const cascadeFreeDate =
    mortgageFreeDateFromNow(cascade.months);

  const baselineFreeDate =
    mortgageFreeDateFromNow(baseline.months);

const rawInterestDiff =
  baseline.interest - cascade.interest;
const isCascadeBetter = rawInterestDiff > 0;
const isCascadeWorse  = rawInterestDiff < 0;
const isExactTie      = rawInterestDiff === 0;

const interestSaved = Math.abs(
  Math.round(rawInterestDiff)
);

const cascadeIsBetter = rawInterestDiff >= 0;

const rawMonthsDiff =
  baseline.months - cascade.months;

const monthsSaved = Math.abs(rawMonthsDiff);
const cascadeIsFaster = rawMonthsDiff >= 0;

document.getElementById("results").innerHTML = `

${buildImpactBox(rawInterestDiff, rawMonthsDiff)}

${buildScenarioSummaryBox(
    avalanche,
    noOverpayResult,
    m1Name,
    m2Name,
    isCascadeBetter,
    isCascadeWorse,
    isExactTie
)}

<div class="chart-card">

  <h3>Balance Over Time </h3>
    <div style="font-size:13px; font-weight:400; opacity:0.7;">
      Cascade vs keeping mortgages separate
    </div>


  <canvas id="balanceChart"></canvas>

  <div class="manual-legend">
    <div class="legend-item" data-index="0"><span class="legend-line m1-sep"></span> ${m1Name} (Separate)</div>
    <div class="legend-item" data-index="1"><span class="legend-line m1-cas"></span> ${m1Name} (Cascade)</div>
    <div class="legend-item" data-index="2"><span class="legend-line m2-sep"></span> ${m2Name} (Separate)</div>
    <div class="legend-item" data-index="3"><span class="legend-line m2-cas"></span> ${m2Name} (Cascade)</div>
    <div class="legend-item total-item active" data-index="4"><span class="legend-line total-sep"></span> Total – Separate</div>
    <div class="legend-item total-item active" data-index="5"><span class="legend-line total-cas"></span> Total – Cascade</div>
  </div>
</div>


  ${buildYearlyTable(avalanche, m1Name, m2Name)}

    <div class="share-actions">
    <button onclick="shareScenario()">🔗 Copy Share Link</button>
  </div>



`;

  renderBalanceChart({
  baselineTotal: avalanche.baseline.balances,
  cascadeTotal: avalanche.cascade.balances,

  baselineM1: avalanche.baseline.m1.balances,
  baselineM2: avalanche.baseline.m2.balances,

  cascadeM1: avalanche.cascade.m1Balances,
  cascadeM2: avalanche.cascade.m2Balances,

  m1Name,
  m2Name
});

// Make legend clickable (Chart.js v4 safe)
setTimeout(() => {
  const legendItems = document.querySelectorAll(".legend-item");
  const chart = window.balanceChartInstance;

  legendItems.forEach(item => {
    item.addEventListener("click", () => {
      const index = parseInt(item.dataset.index);

      const visible = chart.isDatasetVisible(index);
      chart.setDatasetVisibility(index, !visible);
      chart.update();

      item.classList.toggle("active");
    });
  });
}, 0);
}

function buildImpactBox(savedVsSeparate, monthsDiff) {

  const absInterest = Math.abs(savedVsSeparate);
  const absMonths = Math.abs(monthsDiff);

  const formattedInterest =
    absInterest.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  let cssClass = "impact-neutral";
  let headline = "";
  let subline = "";

  if (savedVsSeparate > 0) {
    cssClass = "impact-positive";
    headline = `⚡ £${formattedInterest} saved`;
    subline = absMonths > 0
      ? `${formatMonths(absMonths)} earlier than keeping mortgages separate.`
      : `Same payoff date, lower interest.`;
  }
  else if (savedVsSeparate < 0) {
    cssClass = "impact-negative";
    headline = `⚠ £${formattedInterest} more expensive`;
    subline = `Keeping mortgages separate is cheaper in this scenario.`;
  }
  else {
    headline = `£0.00 difference`;
    subline = `Both strategies produce identical results.`;
  }

  return `
    <div class="impact-summary ${cssClass}">
      <div style="font-weight:600; font-size:15px;">${headline}</div>
      <div style="font-size:13px; opacity:0.85;">${subline}</div>
    </div>
  `;
}


function buildScenarioSummaryBox(
  avalanche,
  noOverpayResult,
  m1Name,
  m2Name,
  isCascadeBetter,
  isCascadeWorse,
  isExactTie
){

  const cascade = avalanche.cascade;
  const baseline = avalanche.baseline;
  const noOverpay = noOverpayResult.baseline;

  const cascadeRowClass = isCascadeBetter ? "row-highlight" : "";
  const separateRowClass = isCascadeWorse ? "row-highlight" : "";

  const cascadeDate = mortgageFreeDateFromNow(cascade.months);
  const baselineDate = mortgageFreeDateFromNow(baseline.months);
  const noOverpayDate = mortgageFreeDateFromNow(noOverpay.months);

  const cascadeInterest = Math.round(cascade.interest);
  const baselineInterest = Math.round(baseline.interest);
  const noOverpayInterest = Math.round(noOverpay.interest);

  const savedVsSeparate = baselineInterest - cascadeInterest;

  const m1Payment = avalanche.scheduled1 || 0;
  const m2Payment = avalanche.scheduled2 || 0;

  return `
  <div class="strategy-summary">

    <div class="standard-payments">
      <strong>Standard Monthly Payments</strong><br>
      ${m1Name}: £${Math.round(m1Payment).toLocaleString()}<br>
      ${m2Name}: £${Math.round(m2Payment).toLocaleString()}
    </div>

    <h3>📊 Overall Outcome</h3>

    <table class="strategy-table">
      <thead>
        <tr>
          <th>Strategy</th>
          <th>📅 Mortgage-Free Date</th>
          <th>💸 Total Interest Paid</th>
          <th>💰 Interest Saved vs Separate</th>
        </tr>
      </thead>
      <tbody>

        <tr class="${cascadeRowClass}">
          <td>🌊 Cascade (prioritise highest interest)</td>
          <td>${cascadeDate}</td>
          <td>£${cascadeInterest.toLocaleString()}</td>
          <td>
            ${
              savedVsSeparate > 0
                ? "£" + savedVsSeparate.toLocaleString()
                : savedVsSeparate < 0
                  ? "-£" + Math.abs(savedVsSeparate).toLocaleString()
                  : "—"
            }
          </td>
        </tr>

        <tr class="${separateRowClass}">
          <td>🏠 Keep mortgages separate</td>
          <td>${baselineDate}</td>
          <td>£${baselineInterest.toLocaleString()}</td>
          <td>—</td>
        </tr>

        <tr>
          <td>⛔ No overpayments (standard payment only)</td>
          <td>${noOverpayDate}</td>
          <td>£${noOverpayInterest.toLocaleString()}</td>
          <td>—</td>
        </tr>

      </tbody>
    </table>

  </div>
  `;
}

function buildYearlyTable(result, m1Name, m2Name) {

  const yearly = result.cascade.yearly || [];
  let rows = "";

  let totalInterest = 0;
  let totalFromM1 = 0;
  let totalFromM2 = 0;
  let totalToM1 = 0;
  let totalToM2 = 0;

  yearly.forEach((y) => {

    totalInterest += y.interest;
    totalFromM1 += y.fromM1;
    totalFromM2 += y.fromM2;
    totalToM1 += y.extraToM1;
    totalToM2 += y.extraToM2;

    rows += `
      <tr>
        <td>${y.year}</td>
        <td>£${Math.round(y.interest).toLocaleString()}</td>
        <td>£${Math.round(y.fromM1).toLocaleString()}</td>
        <td>£${Math.round(y.fromM2).toLocaleString()}</td>
        <td>£${Math.round(y.extraToM1).toLocaleString()}</td>
        <td>£${Math.round(y.extraToM2).toLocaleString()}</td>
        <td>£${Math.round(y.endBalanceM1).toLocaleString()}</td>
        <td>£${Math.round(y.endBalanceM2).toLocaleString()}</td>
      </tr>
    `;
  });

  return `
    <details class="milestone-card">
      <summary style="cursor:pointer; font-weight:600;">
        📊 Year-by-Year Payment Flow (Cascade)
      </summary>

      <div style="font-size:13px; opacity:0.7; margin:8px 0 14px 0;">
        “Extra Paid In” includes overpayments and any redirected 'standard' payments once a mortgage is finished.
      </div>

      <div class="table-wrapper">
      <table class="milestone-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Total Interest</th>
            <th>${m1Name} Extra Paid In</th>
            <th>${m2Name} Extra Paid In</th>
            <th>Sent to ${m1Name}</th>
            <th>Sent to ${m2Name}</th>
            <th>${m1Name} Balance</th>
            <th>${m2Name} Balance</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot>
          <tr style="font-weight:600; border-top:2px solid #ccc;">
            <td>Total</td>
            <td>£${Math.round(totalInterest).toLocaleString()}</td>
            <td>£${Math.round(totalFromM1).toLocaleString()}</td>
            <td>£${Math.round(totalFromM2).toLocaleString()}</td>
            <td>£${Math.round(totalToM1).toLocaleString()}</td>
            <td>£${Math.round(totalToM2).toLocaleString()}</td>
            <td>—</td>
            <td>—</td>
          </tr>
        </tfoot>
      </table>
      </div>
    </details>
  `;
}

/*
  Expose function to global scope
  so HTML button can call it.
*/
window.calculateFromUI = calculateFromUI;

/* =====================================================
   Init
===================================================== */


document.addEventListener("DOMContentLoaded", function () {

  // First load values
  if (window.location.hash.startsWith("#c=")) {
    loadScenarioFromHash();
  } else {
    preloadDefaults();
  }

  // THEN setup validation
  setupValidation();

  // And re-validate once defaults are in
  validateAll();
});

// Allow hash changes in same tab
window.addEventListener("hashchange", function () {
  loadScenarioFromHash();
});

/* =====================================================
   LOAD SHARED SCENARIO
===================================================== */

function decodeState(encoded) {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function loadScenarioFromHash() {

  if (!window.location.hash.startsWith("#c=")) {
    return false;
  }

  const encoded = window.location.hash.substring(3);
  const state = decodeState(encoded);

  if (!state || state.v !== 1) {
    return false;
  }

  // Mortgage 1
  document.getElementById("m1-balance").value = state.m1.b || "";
  document.getElementById("m1-rate").value = state.m1.r || "";
  document.getElementById("m1-years").value = state.m1.y || "";
  document.getElementById("m1-months").value = state.m1.m || "";
  document.getElementById("m1-extra").value = state.m1.e || "";
  document.getElementById("m1-name").value = state.m1.n || "";

  // Mortgage 2
  document.getElementById("m2-balance").value = state.m2.b || "";
  document.getElementById("m2-rate").value = state.m2.r || "";
  document.getElementById("m2-years").value = state.m2.y || "";
  document.getElementById("m2-months").value = state.m2.m || "";
  document.getElementById("m2-extra").value = state.m2.e || "";
  document.getElementById("m2-name").value = state.m2.n || "";

  // Redirect flags
  document.getElementById("redirect-scheduled").checked = !!state.rs;
  document.getElementById("redirect-extra").checked = !!state.re;

  validateAll();
  calculateFromUI();

  return true;
}

/* =====================================================
   SHARE FEATURE
===================================================== */

function getCurrentState() {
  return {
    v: 1,
    m1: {
      b: document.getElementById("m1-balance").value,
      r: document.getElementById("m1-rate").value,
      y: document.getElementById("m1-years").value,
      m: document.getElementById("m1-months").value,
      e: document.getElementById("m1-extra").value,
      n: document.getElementById("m1-name").value
    },
    m2: {
      b: document.getElementById("m2-balance").value,
      r: document.getElementById("m2-rate").value,
      y: document.getElementById("m2-years").value,
      m: document.getElementById("m2-months").value,
      e: document.getElementById("m2-extra").value,
      n: document.getElementById("m2-name").value
    },
    rs: document.getElementById("redirect-scheduled").checked ? 1 : 0,
    re: document.getElementById("redirect-extra").checked ? 1 : 0
  };
}

function encodeState(state) {
  const json = JSON.stringify(state);
  return LZString.compressToEncodedURIComponent(json);
}

function shareScenario() {

  const state = getCurrentState();
  const encoded = encodeState(state);

  const shareUrl =
    window.location.origin +
    window.location.pathname +
    "#c=" +
    encoded;

  navigator.clipboard.writeText(shareUrl);

  const btn = document.querySelector(".share-actions button");
  btn.innerText = "✓ Copied";
  setTimeout(() => {
    btn.innerText = "🔗 Copy Share Link";
  }, 1500);
}
