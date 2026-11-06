/* Inch fraction converter on /tools/inch-fraction-chart/. Needs inch-math.js (window.InchMath) for exact fractions
   and the Construction Calculator app's rounding: to the nearest mark, halves away from zero. 1 in = 25.4 mm. */
(function () {
  "use strict";
  var root = document.getElementById("fr");
  if (!root) return;
  var input = root.querySelector("[name=value]"), unit = root.querySelector("[name=unit]"), out = root.querySelector(".fr-out");
  var M = window.InchMath;
  if (!M) return;
  var ZERO = BigInt(0), sub = M.sub, mul = M.mul, roundTo = M.roundTo, decimal = M.decimal;
  function mixed(x) { return M.inchPart(x) + "″"; }

  var MM = M.of(254, 10);

  function render() {
    var v = M.number(String(input.value).replace(/[″"]/g, ""));
    if (!v || M.cmp(v, M.of(100000)) > 0) { out.innerHTML = "<p>Type a size like 3.4375, 3 7/16 or 87.3.</p>"; return; }
    var inches = unit.value === "mm" ? M.div(v, MM) : v;
    var mm = mul(inches, MM), rows = "";
    [8, 16, 32, 64].forEach(function (den) {
      var r = roundTo(inches, den), err = sub(r, inches), errMm = mul(err, MM);
      var off = err.n === ZERO ? "exact" : (err.n > ZERO ? "+" : "") + decimal(err, 4) + "″ (" + (err.n > ZERO ? "+" : "") + decimal(errMm, 2) + " mm)";
      rows += "<tr><td>1/" + den + "″</td><td class=\"num\"><strong>" + mixed(r) + '</strong></td><td class="num">' + off + "</td></tr>";
    });
    var feet = inches.n / (inches.d * BigInt(12));
    out.innerHTML = '<dl class="fr-sum"><div><dt>Decimal inches</dt><dd>' + decimal(inches, 5) + '″</dd></div><div><dt>Millimeters</dt><dd>' + decimal(mm, 2) +
      " mm</dd></div>" + (feet ? "<div><dt>Feet and inches</dt><dd>" + M.feetInches(inches, 16) + "</dd></div>" : "") + "</dl>" +
      '<div class="table-wrap"><table><caption>Nearest tape mark, and how far off it is</caption><thead><tr><th>Round to</th><th class="num">Mark</th><th class="num">Off by</th></tr></thead><tbody>' +
      rows + "</tbody></table></div>";
    try { localStorage.setItem("fractions:last", JSON.stringify({ value: input.value, unit: unit.value })); } catch (e) {}
  }

  try {
    var last = JSON.parse(localStorage.getItem("fractions:last") || "null");
    if (last) { input.value = last.value; unit.value = last.unit === "mm" ? "mm" : "in"; }
  } catch (e) {}
  input.addEventListener("input", render);
  unit.addEventListener("change", render);
  root.addEventListener("submit", function (e) { e.preventDefault(); });
  // Printing shows only the chart: a copy goes into its own container and everything else is hidden.
  var printRoot = document.createElement("div");
  printRoot.id = "fr-print-root";
  document.body.appendChild(printRoot);
  root.querySelector("[data-print]").addEventListener("click", function () {
    var chart = document.querySelector(".fr-charts");
    printRoot.innerHTML = '<p class="fr-print-title">Inch fractions to decimals and millimeters, every 64th</p>' + (chart ? chart.outerHTML : "") +
      '<p class="fr-print-foot">www.manextapps.com/tools/inch-fraction-chart/</p>';
    window.print();
  });
  window.addEventListener("afterprint", function () { printRoot.innerHTML = ""; });
  render();
  root.setAttribute("data-ready", "1");
})();
