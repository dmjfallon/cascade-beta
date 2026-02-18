/*
  =====================================================
  Chart Rendering Logic
  =====================================================

  This file is responsible ONLY for:

    - Creating the chart
    - Destroying previous chart
    - Feeding data to Chart.js

  It does NOT:
    - Calculate mortgage logic
    - Read user inputs
    - Control UI

  It only visualises data passed to it.
*/

/*
  renderBalanceChart(result)

  Parameter:
    result → object returned from calculateCascade()

  It contains:
    - result.baselineBalances
    - result.cascadeBalances

  These arrays represent total mortgage balance
  at each month index.
*/
/*
  =====================================================
  DATASET STYLE HELPERS
  =====================================================

  These functions apply consistent visual styling
  without changing any data or logic.

  Cascade:
    - Solid line
    - Slightly thicker

  Baseline (Separate):
    - Dashed line
    - Slightly thinner

  IMPORTANT:
    This does NOT change calculations.
    It only affects visual rendering.
*/

function styleCascade(dataset) {
  dataset.borderWidth = 3;
  dataset.borderDash = [];
  dataset.pointRadius = 0;
  dataset.tension = 0.15;
  return dataset;
}

function styleBaseline(dataset) {
  dataset.borderWidth = 1;
  dataset.borderDash = [6, 6];
  dataset.pointRadius = 0;
  dataset.tension = 0.15;
  return dataset;
}

let currentView = "all";
function setView(view) {
  currentView = view;
  updateChart(currentResult); // this should already exist
}
function renderBalanceChart(result) {
const m1Name = result.m1Name || "Mortgage 1";
const m2Name = result.m2Name || "Mortgage 2";


  if (window.balanceChartInstance) {
    window.balanceChartInstance.destroy();
  }

  const ctx = document.getElementById("balanceChart");

  function toXY(arr) {
    return arr.map((value, i) => ({
      x: i / 12,
      y: value
    }));
  }

  const baselineTotal = toXY(result.baselineTotal);
  const cascadeTotal  = toXY(result.cascadeTotal);

  const maxYears = Math.ceil(
    Math.max(
      result.baselineTotal.length,
      result.cascadeTotal.length
    ) / 12
  );

  window.balanceChartInstance = new Chart(ctx, {

    type: "line",

    data: {
      datasets: [

        // Mortgage 1
        {
          label: m1Name + " (Separate)",
          data: toXY(result.baselineM1),
          borderColor: "rgba(46,109,246,0.35)",
          borderDash: [6,6],
          borderWidth: 1,
          tension: 0.15,
          pointRadius: 0
        },
        {
          label: m1Name + " (Cascade)",
          data: toXY(result.cascadeM1),
          borderColor: "rgba(46,109,246,1)",
          borderWidth: 1,
          tension: 0.15,
          pointRadius: 0
        },

        // Mortgage 2
        {
          label: m2Name + " (Separate)",
          data: toXY(result.baselineM2),
          borderColor: "rgba(120,90,255,0.35)",
          borderDash: [6,6],
          borderWidth: 1,
          tension: 0.15,
          pointRadius: 0
        },
        {
          label: m2Name + " (Cascade)",
          data: toXY(result.cascadeM2),
          borderColor: "rgba(120,90,255,1)",
          borderWidth: 1,
          tension: 0.15,
          pointRadius: 0
        },

        // TOTAL (Separate)
        {
          label: "Total – Separate",
          data: baselineTotal,
          borderColor: "rgba(140,140,140,0.7)",
          borderDash: [8,6],
          borderWidth: 1,
          tension: 0.15,
          pointRadius: 0
        },

        // TOTAL (Cascade)
        {
          label: "Total – Cascade",
          data: cascadeTotal,
          borderColor: "#000000",
          borderWidth: 2,
          tension: 0.15,
          pointRadius: 0,
          order: 99
        }

      ]
    },

    options: {
    
      responsive: true,
      parsing: false,

      animation: {
      duration: 900
    },

      interaction: {
        mode: "index",
        intersect: false
      },

      plugins: {

legend: {
  position: "bottom",
  onClick: null,
  labels: {
    boxWidth: 30,
    boxHeight: 12,
    generateLabels: function(chart) {
      const datasets = chart.data.datasets;
      return datasets.map((dataset, i) => ({
        text: dataset.label,
        strokeStyle: dataset.borderColor,
        fillStyle: dataset.borderColor,
        lineWidth: dataset.borderWidth,
        hidden: false,
        index: i
      }));
    }
  }
},

        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            title: function(context) {

              const rawYear = context[0].parsed.x;
              const wholeYear = Math.floor(rawYear);
              const month = Math.round((rawYear - wholeYear) * 12);

              if (month === 0) return "Year " + wholeYear;
              return "Year " + wholeYear + " (Month " + month + ")";
            },
            label: function(context) {
              const value = Math.round(context.parsed.y);
              if (value === 0 && !context.dataset.label.includes("Total")) {
                return null;
              }
              return context.dataset.label + ": £" + value.toLocaleString();
            }
          }
        }

      },

      scales: {

        x: {
          type: "linear",
          min: 0,
          max: maxYears,
          ticks: {
            stepSize: maxYears > 20 ? 5 : 1,
            callback: function(value) {
              return Number.isInteger(value) ? value : "";
            }
          },
          grid: { display: false }
        },

        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return "£" + (value / 1000) + "k";
            }
          },
          grid: {
            color: "rgba(0,0,0,0.03)"
          }
        }

      }
    },


  });

}
