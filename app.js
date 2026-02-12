console.log("Cascade Engine v16.3 (Redirect + Hardened + Full Validation) Loaded");

const DEV_MODE = true;

/* =====================================================
   Utilities
===================================================== */

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

/* =====================================================
   Normalisation
===================================================== */

function normaliseMortgage(m) {
  return {
    balance: roundMoney(clamp(m.balance || 0, 1, 100000000)),
    rate: clamp(m.rate || 0, 0, 25),
    months: Math.max(1, Math.floor(m.months || 1))
  };
}

function normaliseExtra(extra) {
  return roundMoney(clamp(extra || 0, 0, 1000000));
}

/* =====================================================
   Core Maths
===================================================== */

function monthlyPayment(principal, annualRate, totalMonths) {
  if (annualRate === 0) return principal / totalMonths;
  const r = annualRate / 100 / 12;
  return (
    principal *
    (r * Math.pow(1 + r, totalMonths)) /
    (Math.pow(1 + r, totalMonths) - 1)
  );
}

function computeScheduledPayment(m) {
  let scheduled = monthlyPayment(m.balance, m.rate, m.months);
  scheduled = roundMoney(scheduled);

  if (m.rate > 0) {
    const r = m.rate / 100 / 12;
    const firstInterest = roundMoney(m.balance * r);
    if (scheduled <= firstInterest) {
      scheduled = roundMoney(firstInterest + 0.01);
    }
  }

  return scheduled;
}

/* =====================================================
   Simulation (Unchanged Hardened Engine)
===================================================== */

function simulateSingle(m, extra) {

  let balance = m.balance;
  const r = m.rate / 100 / 12;
  const scheduled = computeScheduledPayment(m);

  let months = 0;
  let interestTotal = 0;
  const MAX_MONTHS = 1000 * 12;

  let previousBalance = balance;

  while (balance > 0 && months < MAX_MONTHS) {

    if (balance > previousBalance + 0.01) {
      throw new Error("Invariant failed: Balance increased in simulateSingle.");
    }

    previousBalance = balance;

    const interest = roundMoney(balance * r);
    let principal = roundMoney(scheduled - interest);
    if (principal < 0) principal = 0;

    const totalPayment = roundMoney(principal + extra);

    if (totalPayment >= balance) {
      interestTotal = roundMoney(interestTotal + interest);
      balance = 0;
      months++;
      break;
    }

    balance = roundMoney(balance - totalPayment);
    interestTotal = roundMoney(interestTotal + interest);
    months++;
  }

  if (months === MAX_MONTHS) {
    throw new Error("Single simulation exceeded safety cap.");
  }

  return { months, interest: interestTotal };
}

function simulateBaseline(m1, m2) {
  const s1 = simulateSingle(m1, 0);
  const s2 = simulateSingle(m2, 0);
  return {
    months: Math.max(s1.months, s2.months),
    interest: roundMoney(s1.interest + s2.interest)
  };
}

function simulateCascade(
  m1,
  m2,
  extraTotal,
  redirectScheduled = true,
  redirectExtra = true,
  strategy = "avalanche"
)
{

  let b1 = m1.balance;
  let b2 = m2.balance;

  const r1 = m1.rate / 100 / 12;
  const r2 = m2.rate / 100 / 12;

  const sched1 = computeScheduledPayment(m1);
  const sched2 = computeScheduledPayment(m2);

  let months = 0;
  let interestTotal = 0;
  let extraAllocatedM1 = 0;
  let extraAllocatedM2 = 0;
  let interestM1 = 0;
  let interestM2 = 0;
  let monthsM1 = 0;
  let monthsM2 = 0;

  const MAX_MONTHS = 1000 * 12;

  let prevB1 = b1;
  let prevB2 = b2;

  while (months < MAX_MONTHS) {

    if (b1 > prevB1 + 0.01 || b2 > prevB2 + 0.01) {
      throw new Error("Invariant failed: Balance increased in simulateCascade.");
    }

    prevB1 = b1;
    prevB2 = b2;

    if (b1 <= 0 && b2 <= 0) break;

    months++;

    let availableExtra = extraTotal;

    const i1 = b1 > 0 ? roundMoney(b1 * r1) : 0;
    const i2 = b2 > 0 ? roundMoney(b2 * r2) : 0;

    interestTotal = roundMoney(interestTotal + i1 + i2);
    interestM1 += i1;
    interestM2 += i2;

    let p1 = b1 > 0 ? roundMoney(sched1 - i1) : 0;
    let p2 = b2 > 0 ? roundMoney(sched2 - i2) : 0;

    if (p1 < 0) p1 = 0;
    if (p2 < 0) p2 = 0;

    p1 = Math.min(p1, b1);
    p2 = Math.min(p2, b2);

    b1 = roundMoney(b1 - p1);
    b2 = roundMoney(b2 - p2);

    const m1Cleared = b1 <= 0;
    const m2Cleared = b2 <= 0;

if (m1Cleared && !m2Cleared) {

  if (redirectScheduled)
    availableExtra += sched1;

  if (!redirectExtra)
    availableExtra -= extraTotal;
}

if (m2Cleared && !m1Cleared) {

  if (redirectScheduled)
    availableExtra += sched2;

  if (!redirectExtra)
    availableExtra -= extraTotal;
}

if (b1 > 0 && b2 > 0) {

  let targetM1;

if (strategy === "avalanche") {
  targetM1 = m1.rate >= m2.rate;
} else {
  targetM1 = b1 <= b2;
}

if (targetM1) {

    const extraTo1 = Math.min(availableExtra, b1);
    b1 = roundMoney(b1 - extraTo1);
    extraAllocatedM1 += extraTo1;
  } else {
    const extraTo2 = Math.min(availableExtra, b2);
    b2 = roundMoney(b2 - extraTo2);
    extraAllocatedM2 += extraTo2;
  }

} else if (b1 > 0) {

  const extraTo1 = Math.min(availableExtra, b1);
  b1 = roundMoney(b1 - extraTo1);
  extraAllocatedM1 += extraTo1;

} else if (b2 > 0) {

  const extraTo2 = Math.min(availableExtra, b2);
  b2 = roundMoney(b2 - extraTo2);
  extraAllocatedM2 += extraTo2;
}


    b1 = Math.max(0, b1);
    b2 = Math.max(0, b2);
    if (b1 === 0 && monthsM1 === 0) monthsM1 = months;
    if (b2 === 0 && monthsM2 === 0) monthsM2 = months;

  }

  if (months === MAX_MONTHS)
    throw new Error("Cascade exceeded safety cap.");

return {
  months,
  interest: roundMoney(interestTotal),
  extraAllocatedM1,
  extraAllocatedM2,
  m1: {
    months: monthsM1 || months,
    interest: roundMoney(interestM1)
  },
  m2: {
    months: monthsM2 || months,
    interest: roundMoney(interestM2)
  }
};
}

/* =====================================================
   Invariants
===================================================== */

function enforceInvariants(baseline, cascade) {

  if (cascade.months > baseline.months)
    throw new Error("Invariant failed: Cascade longer than baseline.");

  if (cascade.interest > baseline.interest + 0.01)
    throw new Error("Invariant failed: Cascade interest exceeds baseline.");

  if (baseline.months < 1 || cascade.months < 1)
    throw new Error("Invariant failed: Months < 1.");

  if (baseline.interest < 0 || cascade.interest < 0)
    throw new Error("Invariant failed: Negative interest.");
}

/* =====================================================
   Public API
===================================================== */

function calculateCascade(
  m1,
  m2,
  extraTotal,
  redirectScheduled = true,
  redirectExtra = true,
  strategy = "avalanche"
)

 {

  m1 = normaliseMortgage(m1);
  m2 = normaliseMortgage(m2);
  extraTotal = normaliseExtra(extraTotal);

 const baselineM1 = simulateSingle(m1, 0);
const baselineM2 = simulateSingle(m2, 0);

const baseline = {
  months: Math.max(baselineM1.months, baselineM2.months),
  interest: roundMoney(baselineM1.interest + baselineM2.interest)
};

const cascade = simulateCascade(
  m1,
  m2,
  extraTotal,
  redirectScheduled,
  redirectExtra,
  strategy
);

const cascadeM1 = cascade.m1;
const cascadeM2 = cascade.m2;


enforceInvariants(baseline, cascade);

const totalExtraAllocated =
  cascade.extraAllocatedM1 + cascade.extraAllocatedM2;

let effectiveReturn = 0;

if (totalExtraAllocated > 0) {
  effectiveReturn =
    (
      cascade.extraAllocatedM1 * m1.rate +
      cascade.extraAllocatedM2 * m2.rate
    ) / totalExtraAllocated;
}

return {
  baseline,
  cascade,
  baselineM1,
  baselineM2,
  cascadeM1,
  cascadeM2,
  monthsSaved: Math.max(0, baseline.months - cascade.months),
  interestSaved: roundMoney(
    Math.max(0, baseline.interest - cascade.interest)
  ),
  effectiveReturn
};
}

window.calculateCascade = calculateCascade;
/* =====================================================
   Tests (RESTORED)
===================================================== */

function assert(cond, msg) {
  if (!cond) throw new Error("Canonical test failed: " + msg);
}

function runCanonicalTests() {
  console.log("Running canonical tests...");
  const A = { balance: 100000, rate: 5, months: 240 };
  const B = { balance: 80000, rate: 3, months: 240 };

  assert(calculateCascade(A, B, 0).monthsSaved === 0, "Zero extra");
  assert(calculateCascade(A, B, 200).monthsSaved > 0, "Extra reduces term");

  console.log("Canonical tests passed.");
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function runStressTests() {
  console.log("Running stress tests...");
  for (let i = 0; i < 5000; i++) {

    const m1 = {
      balance: randomBetween(1, 1000000),
      rate: randomBetween(0, 25),
      months: Math.floor(randomBetween(1, 600))
    };

    const m2 = {
      balance: randomBetween(1, 1000000),
      rate: randomBetween(0, 25),
      months: Math.floor(randomBetween(1, 600))
    };

    const extra = randomBetween(0, 5000);

   calculateCascade(m1, m2, extra, true, true, "avalanche");
  }

  console.log("Stress tests passed (5000 cases).");
}

/* =====================================================
   Validation Layer (RESTORED - Option B)
===================================================== */

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

function addHelperText(input) {
  const rule = FIELD_RULES[input.id];
  if (!rule) return;

  const helper = document.createElement("div");
  helper.className = "helper-text";
  helper.innerText = "Allowed range: " + rule.label;
  input.parentNode.insertBefore(helper, input.nextSibling);
}

function sanitizeAndClamp(input) {

  const rule = FIELD_RULES[input.id];
  if (!rule) return;

  let value = input.value;

  value = value.replace(/-/g, "");
  value = value.replace(/[^\d.]/g, "");

  const parts = value.split(".");
  if (parts.length > 2)
    value = parts[0] + "." + parts.slice(1).join("");

  input.value = value;

  let num = parseFloat(value);
  if (!isFinite(num)) {
    if (input.id === "m1-extra" || input.id === "m2-extra")
      input.value = 0;
    return;
  }

  if (rule.integer) num = Math.floor(num);

  num = clamp(num, rule.min, rule.max);

  input.value = num;
}

function validateAll() {

  const btn = document.getElementById("calculate-btn");
  let valid = true;

  Object.keys(FIELD_RULES).forEach(id => {
    const el = document.getElementById(id);
    if (!el.value || !isFinite(parseFloat(el.value)))
      valid = false;
  });

  btn.disabled = !valid;
}

function setupValidation() {

  const inputs = document.querySelectorAll("input[type='number']");

  inputs.forEach(input => {

    if ((input.id === "m1-extra" || input.id === "m2-extra") && !input.value)
      input.value = 0;

    addHelperText(input);

    input.addEventListener("input", () => {
      sanitizeAndClamp(input);
      validateAll();
    });
  });

  validateAll();
}


/* =====================================================
   Preload Defaults (Testing / Demo)
===================================================== */

function preloadDefaults() {

  document.getElementById("m1-balance").value = 295000;
  document.getElementById("m1-rate").value = 3;
  document.getElementById("m1-years").value = 13;
  document.getElementById("m1-months").value = 5;
  document.getElementById("m1-extra").value = 500;

  document.getElementById("m2-balance").value = 150000;
  document.getElementById("m2-rate").value = 1;
  document.getElementById("m2-years").value = 25;
  document.getElementById("m2-months").value = 0;
  document.getElementById("m2-extra").value = 100;

  // Default redirect toggles (full)
  const scheduledToggle = document.getElementById("redirect-scheduled");
  const extraToggle = document.getElementById("redirect-extra");

  if (scheduledToggle) scheduledToggle.checked = true;
  if (extraToggle) extraToggle.checked = true;
}

/* =====================================================
   UI Hook
===================================================== */

function calculateFromUI() {

const m1NameInput = document.getElementById("m1-name").value.trim();
const m2NameInput = document.getElementById("m2-name").value.trim();

const m1Name = m1NameInput || "Mortgage 1";
const m2Name = m2NameInput || "Mortgage 2";


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

  const extra =
    (parseFloat(document.getElementById("m1-extra").value) || 0) +
    (parseFloat(document.getElementById("m2-extra").value) || 0);

const redirectScheduled =
  document.getElementById("redirect-scheduled").checked;

const redirectExtra =
  document.getElementById("redirect-extra").checked;

const avalanche = calculateCascade(
  m1,
  m2,
  extra,
  redirectScheduled,
  redirectExtra,
  "avalanche"
);

const snowball = calculateCascade(
  m1,
  m2,
  extra,
  redirectScheduled,
  redirectExtra,
  "snowball"
);

const betterStrategy =
  avalanche.interestSaved >= snowball.interestSaved
    ? "avalanche"
    : "snowball";
const best = betterStrategy === "avalanche" ? avalanche : snowball;
const bestName = betterStrategy === "avalanche"
  ? "🔥 Avalanche (Highest Interest First)"
  : "❄️ Snowball (Smallest Balance First)";

document.getElementById("results").innerHTML = `
  <h3>Results</h3>

  <h4>Summary</h4>
  <p><strong>Total Term:</strong> ${avalanche.cascade.months} months</p>
  <p><strong>Total Interest:</strong> £${avalanche.cascade.interest.toLocaleString(undefined,{minimumFractionDigits:2})}</p>
  <p><strong>Interest Saved:</strong> £${avalanche.interestSaved.toLocaleString(undefined,{minimumFractionDigits:2})}</p>
  <p><strong>Effective Return:</strong> ${avalanche.effectiveReturn.toFixed(2)}%</p>

  <details style="margin-top:20px;">
  <summary>💡 Compare overpayment approaches</summary>

  <div style="margin-top:15px;">

    <p>
      There are two common ways to decide where extra money goes first:
    </p>

    <div style="margin-top:15px;">
      <p><strong>🔥 Highest interest first (often called “Avalanche”)</strong></p>
      <p>
        Your extra money goes to the mortgage charging the highest interest rate.
        This usually saves the most money overall.
      </p>
      <p>Total Term: ${avalanche.cascade.months} months</p>
      <p>Total Interest: £${avalanche.cascade.interest.toLocaleString(undefined,{minimumFractionDigits:2})}</p>
      <p>Interest Saved: £${avalanche.interestSaved.toLocaleString(undefined,{minimumFractionDigits:2})}</p>
      <p>Effective Return: ${avalanche.effectiveReturn.toFixed(2)}%</p>
    </div>

    <div style="margin-top:20px;">
      <p><strong>❄️ Smallest balance first (often called “Snowball”)</strong></p>
      <p>
        Your extra money clears the smaller mortgage first.
        Some people prefer this because one debt disappears sooner.
      </p>
      <p>Total Term: ${snowball.cascade.months} months</p>
      <p>Total Interest: £${snowball.cascade.interest.toLocaleString(undefined,{minimumFractionDigits:2})}</p>
      <p>Interest Saved: £${snowball.interestSaved.toLocaleString(undefined,{minimumFractionDigits:2})}</p>
      <p>Effective Return: ${snowball.effectiveReturn.toFixed(2)}%</p>
    </div>

    <div style="margin-top:20px; font-style: italic;">
      In this example, the higher-interest-first approach saves more overall,
      but you can choose the approach that feels right for you.
    </div>

  </div>
</details>

`;


}

window.calculateFromUI = calculateFromUI;

/* =====================================================
   Init
===================================================== */

document.addEventListener("DOMContentLoaded", function () {
  runCanonicalTests();
  if (DEV_MODE) runStressTests();
  preloadDefaults();
  setupValidation();
});


