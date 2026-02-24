

/*
  =====================================================
  DEV MODE FLAG
  =====================================================

  /*
  When true:
    - Invariant and stress tests run automatically
    - Additional console logging is enabled

  Intended for development only.
*/

const DEV_MODE = false;


/* =====================================================
   Utilities
===================================================== */

/*
  roundMoney(n)

  Purpose:
    Rounds a number to 2 decimal places.

  To avoid floating point drift, and inacurries over long time scale calcuations.

  Example:
    10.999999 → 11.00
*/
function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

/*
  clamp(n, min, max)

  Ensures a number stays within bounds.
  Used during input normalisation.
*/
function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}


/* =====================================================
   Normalisation
===================================================== */

/*
  normaliseMortgage(m)

  Purpose:
    Normalises input values to ensure valid ranges.

  Ensures:
    - Balance ≥ 1
    - Rate between 0–25%
    - Months ≥ 1
*/
function normaliseMortgage(m) {
  return {
    balance: roundMoney(clamp(m.balance || 0, 1, 100000000)),
    rate: clamp(m.rate || 0, 0, 25),
    months: Math.max(1, Math.floor(m.months || 1))
  };
}

/*
  normaliseExtra(extra)

  Ensures extra payment:
    - ≥ 0
    - ≤ 1,000,000
*/
function normaliseExtra(extra) {
  return roundMoney(clamp(extra || 0, 0, 1000000));
}


/* =====================================================
   Core Maths
===================================================== */

/*
  monthlyPayment(principal, annualRate, totalMonths)

  Standard amortisation formula.

  Returns the REQUIRED monthly payment to:
    - Pay loan off in exactly totalMonths
    - Including interest

  Implements the standard amortisation formula.
*/
function monthlyPayment(principal, annualRate, totalMonths) {
  if (annualRate === 0) return principal / totalMonths;

  const r = annualRate / 100 / 12;

  return (
    principal *
    (r * Math.pow(1 + r, totalMonths)) /
    (Math.pow(1 + r, totalMonths) - 1)
  );
}

/*
  computeScheduledPayment(m)

  Wraps monthlyPayment and ensures:
    - Payment > first month's interest
    - Prevents negative amortisation
*/
function computeScheduledPayment(m) {

  let scheduled = monthlyPayment(m.balance, m.rate, m.months);
scheduled = roundMoney(scheduled);

// Ensure at least 1p payment
if (scheduled < 0.01) {
  scheduled = 0.01;
}

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
   Single Mortgage Simulation
===================================================== */

/*
  simulateSingle(m, extra)

  Simulates ONE mortgage month-by-month.

  Each month:
    1. Interest accrues
    2. Scheduled payment reduces principal
    3. Extra reduces principal further

  Returns:
    - months to clear
    - total interest paid
    - balance progression array
*/
function simulateSingle(m, extra) {

  let balance = m.balance;
  const r = m.rate / 100 / 12;
  const scheduled = computeScheduledPayment(m);

  let months = 0;
  let interestTotal = 0;  

  const balances = [balance];
  const MAX_MONTHS = 1000 * 12;

  while (balance > 0 && months < MAX_MONTHS) {

    const interest = roundMoney(balance * r);

    let principal = roundMoney(scheduled - interest);
    if (principal < 0) principal = 0;

    const totalPayment = roundMoney(principal + extra);

    if (totalPayment >= balance) {
      interestTotal = roundMoney(interestTotal + interest);
      balance = 0;
      months++;
      balances.push(0);
      break;
    }

    balance = roundMoney(balance - totalPayment);
    interestTotal = roundMoney(interestTotal + interest);
    months++;

    balances.push(balance);
  }

  if (months === MAX_MONTHS)
    throw new Error("Single simulation exceeded safety cap.");

  return { months, interest: interestTotal, balances };
}


/* =====================================================
   Baseline Simulation
===================================================== */

/*
  simulateBaseline(m1, m2, extra1, extra2)

  Each mortgage:
    - Keeps its own overpayment
    - Never redirects payments

  Returns:
    - Total interest
    - Max months of both
    - Combined balance array
*/
function simulateBaseline(m1, m2, extra1, extra2) {

  const b1 = simulateSingle(m1, extra1);
  const b2 = simulateSingle(m2, extra2);

  const maxLen = Math.max(b1.balances.length, b2.balances.length);
  const balances = [];

  for (let i = 0; i < maxLen; i++) {
    balances.push(
      roundMoney(
        (b1.balances[i] || 0) +
        (b2.balances[i] || 0)
      )
    );
  }

  return {
    months: Math.max(b1.months, b2.months),
    interest: roundMoney(b1.interest + b2.interest),
    balances,
    m1: b1,
    m2: b2
  };
}


/* =====================================================
   Cascade Simulation
===================================================== */

/*
  simulateCascade(...)

  Key differences from baseline:

  - overpayments are pooled
  - Voluntary extras are pooled while both active.
  - After payoff, scheduled payments may enter the pool (depending on toggle).
  - Strategy determines which mortgage gets extra
  - Payments can redirect after payoff
*/
function simulateCascade(
  m1,
  m2,
  extra1,
  extra2,
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

    // ===== Yearly tracking =====
let yearly = [];
let yearInterest = 0;
let yearExtra = 0;
let yearExtraToM1 = 0;
let yearExtraToM2 = 0;
let yearFromM1 = 0;
let yearFromM2 = 0;


  // Attribution tracking
let m1ExtraPaidToM1 = 0;
let m1ExtraPaidToM2 = 0;
let m2ExtraPaidToM1 = 0;
let m2ExtraPaidToM2 = 0;


  const balances = [roundMoney(b1 + b2)];
  const m1Balances = [roundMoney(b1)];
  const m2Balances = [roundMoney(b2)];

  const MAX_MONTHS = 1000 * 12;

  while (months < MAX_MONTHS) {

    if (b1 <= 0 && b2 <= 0) break;

    months++;

// ===============================
    

const i1 = b1 > 0 ? roundMoney(b1 * r1) : 0;
const i2 = b2 > 0 ? roundMoney(b2 * r2) : 0;

interestTotal = roundMoney(interestTotal + i1 + i2);
yearInterest = roundMoney(yearInterest + i1 + i2);

let p1 = b1 > 0 ? roundMoney(sched1 - i1) : 0;
let p2 = b2 > 0 ? roundMoney(sched2 - i2) : 0;

p1 = Math.max(0, Math.min(p1, b1));
p2 = Math.max(0, Math.min(p2, b2));

b1 = roundMoney(b1 - p1);
b2 = roundMoney(b2 - p2);

const m1Cleared = b1 <= 0;
const m2Cleared = b2 <= 0;

// ===============================
// Build source contributions explicitly
// ===============================

let fromM1 = 0;
let fromM2 = 0;

// While both mortgages active → only voluntary extras enter pool
if (b1 > 0 && b2 > 0) {
  fromM1 += extra1;
  fromM2 += extra2;
}

// If M1 cleared
else if (b1 <= 0 && b2 > 0) {

  // M2 voluntary extra always continues
  fromM2 += extra2;

  // M1 extra continues only if redirectExtra enabled
  if (redirectExtra) {
    fromM1 += extra1;
  }

  // M1 scheduled payment redirects only if enabled
  if (redirectScheduled) {
    fromM1 += sched1;
  }
}

// If M2 cleared
else if (b2 <= 0 && b1 > 0) {

  // M1 voluntary extra always continues
  fromM1 += extra1;

  // M2 extra continues only if redirectExtra enabled
  if (redirectExtra) {
    fromM2 += extra2;
  }

  // M2 scheduled payment redirects only if enabled
  if (redirectScheduled) {
    fromM2 += sched2;
  }
}

let availableExtra = fromM1 + fromM2;

// ===============================
// Apply available extra
// ===============================

if (b1 > 0 && b2 > 0) {

  const targetM1 =
    strategy === "avalanche"
      ? m1.rate >= m2.rate
      : b1 <= b2;

  const totalSource = fromM1 + fromM2;

  if (targetM1) {

    const used = Math.min(availableExtra, b1);
    b1 = roundMoney(b1 - used);

    yearExtra += used;
    yearExtraToM1 += used;

    if (totalSource > 0) {
      const m1Share = used * (fromM1 / totalSource);
      const m2Share = used * (fromM2 / totalSource);

      yearFromM1 += m1Share;
      yearFromM2 += m2Share;

      m1ExtraPaidToM1 += m1Share;
      m2ExtraPaidToM1 += m2Share;
    }

  } else {

    const used = Math.min(availableExtra, b2);
    b2 = roundMoney(b2 - used);

    yearExtra += used;
    yearExtraToM2 += used;

    if (totalSource > 0) {
      const m1Share = used * (fromM1 / totalSource);
      const m2Share = used * (fromM2 / totalSource);

      yearFromM1 += m1Share;
      yearFromM2 += m2Share;

      m1ExtraPaidToM2 += m1Share;
      m2ExtraPaidToM2 += m2Share;
    }
  }

} else if (b1 > 0) {

  const used = Math.min(availableExtra, b1);
  b1 = roundMoney(b1 - used);

  yearExtra += used;
  yearExtraToM1 += used;

  yearFromM1 += fromM1;
  yearFromM2 += fromM2;

  m1ExtraPaidToM1 += fromM1;
  m2ExtraPaidToM1 += fromM2;

} else if (b2 > 0) {

  const used = Math.min(availableExtra, b2);
  b2 = roundMoney(b2 - used);

  yearExtra += used;
  yearExtraToM2 += used;

  yearFromM1 += fromM1;
  yearFromM2 += fromM2;

  m1ExtraPaidToM2 += fromM1;
  m2ExtraPaidToM2 += fromM2;
}

b1 = roundMoney(b1);
b2 = roundMoney(b2);

if (b1 < 0.01) b1 = 0;
if (b2 < 0.01) b2 = 0;


    balances.push(roundMoney(b1 + b2));
    m1Balances.push(roundMoney(b1));
    m2Balances.push(roundMoney(b2));

        // ===== End-of-year check =====
if (months % 12 === 0 || (b1 <= 0 && b2 <= 0)) {

 yearly.push({
  year: Math.ceil(months / 12),
  interest: roundMoney(yearInterest),
  fromM1: roundMoney(yearFromM1),
  fromM2: roundMoney(yearFromM2),
  extraToM1: roundMoney(yearExtraToM1),
  extraToM2: roundMoney(yearExtraToM2),
  endBalanceM1: roundMoney(b1),
  endBalanceM2: roundMoney(b2)
});

  // Reset yearly counters
  yearInterest = 0;
  yearExtra = 0;
  yearExtraToM1 = 0;
  yearExtraToM2 = 0;
  yearFromM1 = 0;
  yearFromM2 = 0;

}

  }

  if (months === MAX_MONTHS)
    throw new Error("Cascade exceeded safety cap.");

return {
  months,
  interest: roundMoney(interestTotal),
  balances,
  m1Balances,
  m2Balances,
  yearly,
  attribution: {
    m1ExtraPaidToM1: roundMoney(m1ExtraPaidToM1),
    m1ExtraPaidToM2: roundMoney(m1ExtraPaidToM2),
    m2ExtraPaidToM1: roundMoney(m2ExtraPaidToM1),
    m2ExtraPaidToM2: roundMoney(m2ExtraPaidToM2)
  }
};
}


/* =====================================================
   Public API
===================================================== */

function calculateCascade(
  m1,
  m2,
  extra1,
  extra2,
  redirectScheduled = true,
  redirectExtra = true,
  strategy = "avalanche"
) {

  m1 = normaliseMortgage(m1);
  m2 = normaliseMortgage(m2);

  extra1 = normaliseExtra(extra1);
  extra2 = normaliseExtra(extra2);

  const baseline = simulateBaseline(m1, m2, extra1, extra2);

  const cascade = simulateCascade(
    m1,
    m2,
    extra1,
    extra2,
    redirectScheduled,
    redirectExtra,
    strategy
  );

  const rawMonthsSaved = baseline.months - cascade.months;
  const rawInterestSaved = roundMoney(
    baseline.interest - cascade.interest
  );

  const monthsSaved =
    Math.abs(rawMonthsSaved) <= 1 ? 0 : Math.max(0, rawMonthsSaved);

  const interestSaved =
    Math.abs(rawInterestSaved) < 0.5 ? 0 : Math.max(0, rawInterestSaved);

  const scheduled1 = computeScheduledPayment(m1);
  const scheduled2 = computeScheduledPayment(m2);

  return {
    baseline,
    cascade,
    monthsSaved,
    interestSaved,
    scheduled1,
    scheduled2
  };
}

window.calculateCascade = calculateCascade;


/* =====================================================
   Tests
===================================================== */

function runAllocationComparisonTests() {

  console.log("Running allocation comparison tests...");

  let cascadeWorse = 0;

  for (let i = 0; i < 10000; i++) {

    const m1 = { balance: 200000, rate: 5, months: 300 };
    const m2 = { balance: 150000, rate: 3, months: 300 };

    const result = calculateCascade(m1, m2, 500, 300);

    if (result.cascade.interest > result.baseline.interest + 0.01)
      cascadeWorse++;
  }

  console.log("Cascade worse cases:", cascadeWorse);
}

if (DEV_MODE) {
  document.addEventListener("DOMContentLoaded", function () {
    runAllocationComparisonTests();
    runComparisonModeTests();
  });
}
function runComparisonModeTests() {

  console.log("Running comparison mode tests...");

  const m1 = { balance: 300000, rate: 5, months: 300 };
  const m2 = { balance: 200000, rate: 3, months: 300 };

  const extra1 = 500;
  const extra2 = 200;

  // Baseline: no overpayments
  const baselineNone = calculateCascade(
    m1,
    m2,
    0,
    0,
    false,
    false,
    "avalanche"
  );

  // Cascade with extras
  const cascade = calculateCascade(
    m1,
    m2,
    extra1,
    extra2,
    true,
    true,
    "avalanche"
  );

  if (cascade.cascade.interest > baselineNone.baseline.interest + 0.01) {
    console.error("ERROR: Cascade worse than no-overpayment baseline");
  } else {
    console.log("PASS: Cascade improves vs no-overpayment baseline");
  }
}

function runHighRateAllocationInvariantTest() {

  console.log("Running strict high-rate invariant test...");

  const m1 = { balance: 200000, rate: 7, months: 300 };
  const m2 = { balance: 200000, rate: 6.5, months: 300 };

  const result = calculateCascade(
    m1,
    m2,
    500,
    500,
    false,
    false,
    "avalanche"
  );

  const m1Balances = result.cascade.m1Balances;
  const m2Balances = result.cascade.m2Balances;

  let errorFound = false;

  for (let i = 1; i < m1Balances.length; i++) {

    const prevM1 = m1Balances[i - 1];
    const prevM2 = m2Balances[i - 1];

    const currM1 = m1Balances[i];
    const currM2 = m2Balances[i];

    // If BOTH mortgages still had balance last month
    if (prevM1 > 0 && prevM2 > 0) {

      const reductionM1 = prevM1 - currM1;
      const reductionM2 = prevM2 - currM2;

      // If lower-rate mortgage reduced MORE than higher-rate mortgage
      if (reductionM2 > reductionM1 + 0.01) {
        console.error(
          "ERROR: Lower-rate mortgage reduced more than higher-rate mortgage in month",
          i
        );
        errorFound = true;
        break;
      }
    }
  }

  if (!errorFound) {
    console.log("PASS: Higher-rate mortgage always received priority while both active");
  }
}

if (DEV_MODE) {
  runHighRateAllocationInvariantTest();
  runOwnerContributionTest();
}

function runOwnerContributionTest() {

  console.log("Running owner contribution invariant test...");

  const m1 = { balance: 250000, rate: 7, months: 240 };
  const m2 = { balance: 150000, rate: 6, months: 240 };

  const extra1 = 500;
  const extra2 = 200;

  const result = calculateCascade(
    m1,
    m2,
    extra1,
    extra2,
    false,
    false,
    "avalanche"
  );

  const attr = result.cascade.attribution;

  const m2TotalContribution =
    attr.m2ExtraPaidToM1 + attr.m2ExtraPaidToM2;

  console.log("Attribution:", attr);

  if (extra2 > 0 && m2TotalContribution <= 0.01) {
    console.error("ERROR: Mortgage 2 extra never contributed anywhere");
  } else {
    console.log("PASS: Mortgage 2 extra correctly contributed");
  }
}

/* =====================================================
   EXTENDED DEV INVARIANT SUITE
===================================================== */

function runExtendedInvariantSuite() {

  console.log("Running extended invariant suite...");

  /* -------------------------------------------------
     2. No negative balances
  ------------------------------------------------- */
  (function () {

    const m1 = { balance: 250000, rate: 7, months: 240 };
    const m2 = { balance: 150000, rate: 6, months: 240 };

    const result = calculateCascade(
      m1, m2, 500, 200,
      true, true, "avalanche"
    );

    const allBalances = [
      ...result.cascade.m1Balances,
      ...result.cascade.m2Balances
    ];

    if (allBalances.some(b => b < -0.01)) {
      console.error("ERROR: Negative balance detected");
    } else {
      console.log("PASS: No negative balances");
    }
  })();


  /* -------------------------------------------------
     3. Final balances exactly zero
  ------------------------------------------------- */
  (function () {

    const m1 = { balance: 300000, rate: 5, months: 300 };
    const m2 = { balance: 200000, rate: 4, months: 300 };

    const result = calculateCascade(
      m1, m2, 600, 400,
      true, true, "avalanche"
    );

    const finalM1 = result.cascade.m1Balances.slice(-1)[0];
    const finalM2 = result.cascade.m2Balances.slice(-1)[0];

    if (Math.abs(finalM1) > 0.01 || Math.abs(finalM2) > 0.01) {
      console.error("ERROR: Final balances not zero");
    } else {
      console.log("PASS: Final balances zero");
    }
  })();


  /* -------------------------------------------------
     4. Balance never increases month-to-month
  ------------------------------------------------- */
  (function () {

    const m1 = { balance: 200000, rate: 6, months: 300 };
    const m2 = { balance: 150000, rate: 5, months: 300 };

    const result = calculateCascade(
      m1, m2, 500, 200,
      true, true, "avalanche"
    );

    const check = (arr) => {
      for (let i = 1; i < arr.length; i++) {
        if (arr[i] > arr[i - 1] + 0.01) {
          return false;
        }
      }
      return true;
    };

    if (!check(result.cascade.m1Balances) ||
        !check(result.cascade.m2Balances)) {
      console.error("ERROR: Balance increased unexpectedly");
    } else {
      console.log("PASS: Balances monotonic");
    }
  })();


  /* -------------------------------------------------
     5. No-extra → cascade identical to baseline
  ------------------------------------------------- */
  (function () {

    const m1 = { balance: 200000, rate: 5, months: 300 };
    const m2 = { balance: 150000, rate: 4, months: 300 };

    const result = calculateCascade(
      m1, m2, 0, 0,
      true, true, "avalanche"
    );

    if (Math.abs(result.interestSaved) > 0.5) {
      console.error("ERROR: Cascade differs with zero extra");
    } else {
      console.log("PASS: Zero-extra case stable");
    }
  })();


  /* -------------------------------------------------
     6. Conservation invariant (From = To)
  ------------------------------------------------- */
  (function () {

    const m1 = { balance: 295000, rate: 3, months: 161 };
    const m2 = { balance: 150000, rate: 1, months: 300 };

    const result = calculateCascade(
      m1, m2, 500, 100,
      true, true, "avalanche"
    );

    const yearly = result.cascade.yearly;

    const totalFrom = yearly.reduce(
      (t, y) => t + y.fromM1 + y.fromM2, 0
    );

    const totalTo = yearly.reduce(
      (t, y) => t + y.extraToM1 + y.extraToM2, 0
    );

    if (Math.abs(totalFrom - totalTo) > 1) {
      console.error("ERROR: Conservation invariant failed");
    } else {
      console.log("PASS: Conservation invariant");
    }
  })();


  /* -------------------------------------------------
     7. Redirect-off invariant
  ------------------------------------------------- */
  (function () {

    const m1 = { balance: 295000, rate: 3, months: 161 };
    const m2 = { balance: 150000, rate: 1, months: 300 };

    const result = calculateCascade(
      m1, m2, 500, 100,
      false, false, "avalanche"
    );

    const yearly = result.cascade.yearly;

    const yearlyTotals = yearly.map(y => y.fromM1 + y.fromM2);

    if (Math.max(...yearlyTotals) > 7200 + 1) {
      console.error("ERROR: Redirect-off allowed scheduled payments");
    } else {
      console.log("PASS: Redirect-off behaviour correct");
    }
  })();

}
/* Run only in DEV_MODE */
if (DEV_MODE) {
  runZeroInterestTest();
  runTinyBalanceTest();
  runSymmetryTest();
  runExtremeRatePriorityTest();
  runMassiveExtraTest();
  runRedirectMatrixTest();
  runRandomFuzzer();
}


function runZeroInterestTest() {
  console.log("Running zero-interest test...");

  const m1 = { balance: 100000, rate: 0, months: 120 };
  const m2 = { balance: 50000, rate: 5, months: 240 };

  const result = calculateCascade(m1, m2, 200, 100);

  if (isNaN(result.cascade.interest)) {
    console.error("ERROR: Zero interest produced NaN");
  } else {
    console.log("PASS: Zero interest handled correctly");
  }
}

function runTinyBalanceTest() {
  console.log("Running tiny balance test...");

  const m1 = { balance: 50, rate: 7, months: 240 };
  const m2 = { balance: 200000, rate: 5, months: 300 };

  const result = calculateCascade(m1, m2, 100, 0);

  const final = result.cascade.m1Balances.slice(-1)[0];

  if (Math.abs(final) > 0.01) {
    console.error("ERROR: Tiny balance not cleared cleanly");
  } else {
    console.log("PASS: Tiny balance cleared cleanly");
  }
}

function runSymmetryTest() {
  console.log("Running symmetry test...");

  const m1 = { balance: 200000, rate: 5, months: 300 };
  const m2 = { balance: 200000, rate: 5, months: 300 };

  const result = calculateCascade(m1, m2, 300, 300);

  const diff = Math.abs(
    result.cascade.m1Balances.slice(-1)[0] -
    result.cascade.m2Balances.slice(-1)[0]
  );

  if (diff > 0.01) {
    console.error("ERROR: Symmetry violated");
  } else {
    console.log("PASS: Symmetry holds");
  }
}

function runExtremeRatePriorityTest() {
  console.log("Running extreme rate priority test...");

  const m1 = { balance: 300000, rate: 10, months: 300 };
  const m2 = { balance: 300000, rate: 1, months: 300 };

  const result = calculateCascade(m1, m2, 500, 500);

  const m1Balances = result.cascade.m1Balances;
  const m2Balances = result.cascade.m2Balances;

  for (let i = 1; i < m1Balances.length; i++) {

    const prevM1 = m1Balances[i - 1];
    const prevM2 = m2Balances[i - 1];

    const currM1 = m1Balances[i];
    const currM2 = m2Balances[i];

    // Only enforce priority while BOTH are active
    if (prevM1 > 0 && prevM2 > 0) {

      const reductionM1 = prevM1 - currM1;
      const reductionM2 = prevM2 - currM2;

      if (reductionM2 > reductionM1 + 0.01) {
        console.error("ERROR: Allocation priority violated in month", i);
        return;
      }
    }
  }

  console.log("PASS: Extreme rate priority enforced correctly");
}

function runMassiveExtraTest() {
  console.log("Running massive extra test...");

  const m1 = { balance: 200000, rate: 5, months: 300 };
  const m2 = { balance: 150000, rate: 4, months: 300 };

  const result = calculateCascade(m1, m2, 10000, 10000);

  if (result.cascade.months <= 0) {
    console.error("ERROR: Massive extra broke simulation");
  } else {
    console.log("PASS: Massive extra stable");
  }
}

function runRedirectMatrixTest() {
  console.log("Running redirect matrix test...");

  const m1 = { balance: 200000, rate: 5, months: 300 };
  const m2 = { balance: 100000, rate: 3, months: 300 };

  const a = calculateCascade(m1, m2, 300, 200, true, true);
  const b = calculateCascade(m1, m2, 300, 200, false, false);

  if (a.cascade.months > b.cascade.months) {
    console.error("ERROR: Redirect worsened outcome");
  } else {
    console.log("PASS: Redirect behaves logically");
  }
}

function runRandomFuzzer() {
  console.log("Running random fuzzer...");

  for (let i = 0; i < 1000; i++) {

    const m1 = {
      balance: 50000 + Math.random() * 300000,
      rate: Math.random() * 10,
      months: 60 + Math.floor(Math.random() * 360)
    };

    const m2 = {
      balance: 50000 + Math.random() * 300000,
      rate: Math.random() * 10,
      months: 60 + Math.floor(Math.random() * 360)
    };

    const result = calculateCascade(
      m1, m2,
      Math.random() * 1000,
      Math.random() * 1000
    );

    if (!isFinite(result.cascade.interest)) {
      console.error("ERROR: Random fuzzer broke engine");
      return;
    }
  }

  console.log("PASS: Random fuzzer stable");
}
