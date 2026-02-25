/*
  =====================================================
  Chart Rendering Logic
  =====================================================

  This file handles:

    - Creating the chart
    - Destroying previous chart
    - Feeding data to Chart.js

  It does NOT:
    - Calculate mortgage logic
    - Read user inputs
    - Control UI

  It only visualises data passed to it.

  IMPORTANT:
  Dataset order MUST NOT change.
  app.js manual legend relies on dataset index positions.
*/

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

    {
      label: m1Name + " (Separate)",
      data: toXY(result.baselineM1),
      borderColor: "rgba(59,130,246,0.7)",
      borderDash: [4,4],
      borderWidth: 2,
      tension: 0.15,
      pointRadius: 0,
      hidden: true
    },
    {
      label: m1Name + " (Cascade)",
      data: toXY(result.cascadeM1),
      borderColor: "rgba(46,109,246,1)",
      borderWidth: 2,
      tension: 0.15,
      pointRadius: 0,
      hidden: true
    },
    {
      label: m2Name + " (Separate)",
      data: toXY(result.baselineM2),
      borderColor: "rgba(168,85,247,0.7)",
      borderDash: [4,4],
      borderWidth: 2,
      tension: 0.15,
      pointRadius: 0,
      hidden: true
    },
    {
      label: m2Name + " (Cascade)",
      data: toXY(result.cascadeM2),
      borderColor: "rgba(120,90,255,1)",
      borderWidth: 2,
      tension: 0.15,
      pointRadius: 0,
      hidden: true
    },
    {
      label: "Total – Separate",
      data: baselineTotal,
      borderColor: "rgba(203,213,225,0.45)",
      borderDash: [6, 6],
      borderWidth: 1.9,
      tension: 0.2,
      pointRadius: 0
    },
    {
      label: "Total – Cascade",
      data: cascadeTotal,
      borderColor: "rgba(255,255,255,0.85)",
      borderWidth: 1.9,
      tension: 0.2,
      pointRadius: 0
    }

  ] 

},   

    options: {

      responsive: true,
      maintainAspectRatio: false,

      /*
        CRITICAL:
        Prevents infinite vertical stretching.
        Height now controlled by CSS (.chart-card).
      */
      maintainAspectRatio: false,

      parsing: false,

      animation: {
        duration: 700,
        easing: "easeOutQuart"
      },

      interaction: {
        mode: "index",
        intersect: false
      },

      plugins: {
  legend: { display: false }
},

scales: {

  x: {
    type: "linear",
    min: 0,
    max: maxYears,
    ticks: {
      stepSize: window.innerWidth < 768
  ? (maxYears > 20 ? 10 : 2)
  : (maxYears > 20 ? 5 : 1),
      color: "rgba(255,255,255,0.6)",
      callback: function(value) {
        return Number.isInteger(value) ? value : "";
      }
    },
    grid: { display: false }
  },

  y: {
    beginAtZero: true,
    ticks: {
      color: "rgba(255,255,255,0.6)",
      callback: function(value) {
        return "£" + (value / 1000) + "k";
      }
    },
    grid: {
      color: "rgba(255,255,255,0.08)"
    }
  }

}   // ← closes scales

}   // ← closes options

}); // ← closes new Chart

}   // ← closes function