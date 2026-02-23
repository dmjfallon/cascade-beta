# 🌊 Cascade

Cascade is a browser-based simulator for comparing repayment strategies across two mortgages.

Most online calculators simulate a single mortgage, so this was built as a fun side project.

It models how:

- Applying overpayments using the **avalanche method** (highest interest first)  
- *(Optional)* Redirecting scheduled payments and/or overpayments once one of the mortgages is paid off  

impact:

- 🕒 **Time to become mortgage-free**  
- 💰 **Total interest paid**

---

## What It Does

Cascade compares three scenarios:

### 1️⃣ Cascade (Avalanche)

- While both loans are active, any overpayments target the higher-interest mortgage  
- After one loan is paid off: scheduled payments and/or overpayments can be redirected to the remaining loan  

### 2️⃣ Separate (Same Overpayments)

Each mortgage keeps its own overpayments. No redirectign money from one mortgage to another at any point.

### 3️⃣ No Overpayments

Standard amortisation with no voluntary extras, and mortgages run separately.

---

## Outputs

- Mortgage-free date  
- Total interest paid  
- Months saved  
- Interest saved vs separate  
- Balance-over-time chart  
- Year-by-year payment flow  

---

## Architecture

The app is split into clear layers:

- `engine.js` — Pure financial logic (no DOM manipulation)  
- `chart.js` — Chart rendering (Chart.js wrapper)  
- `app.js` — UI controller (reads inputs, renders results)  

### Single engine entry point:
(The UI calls one function in engine.js to run all calculations)

```js
calculateCascade(
  m1,
  m2,
  extra1,
  extra2,
  redirectScheduled,
  redirectExtra,
  "avalanche"
)
```


## Financial Assumptions

- Monthly compounding  
- Standard amortisation formula  
- 2 decimal rounding  
- No fees, penalties, tax modelling, or lender caps  

This is a modelling tool — not financial advice.

---

## Why It Exists

Most mortgage calculators handle one loan.

Cascade is useful for:

- Two people combining finances  
- Investment property strategies (e.g. someone who owns two properties)  
- Overpayment allocation decisions  
- Redirect mechanics after payoff  

---

## Run Locally

Clone the repository and open `index.html` in your browser.

No build step required.

---

## Disclaimer

Built as a side project.  
Results are estimates, not guarantees.  
Always confirm important financial decisions with a qualified adviser.
