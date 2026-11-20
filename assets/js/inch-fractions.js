/* Inch fraction converter on /tools/inch-fraction-chart/. Needs inch-math.js (window.InchMath) for exact fractions
   and the Construction Calculator app's rounding: to the nearest mark, halves away from zero. 1 in = 25.4 mm. */
(function () {
  "use strict";
  var root = document.getElementById("fr");
  if (!root) return;
  var M = window.InchMath;
  if (!M) return;
  var fields = { frac: root.querySelector("[name=frac]"), dec: root.querySelector("[name=dec]"), mm: root.querySelector("[name=mm]") };
  var denSel = root.querySelector("[name=den]"), note = root.querySelector(".fr-note"), out = root.querySelector(".fr-out");
  var ZERO = BigInt(0), sub = M.sub, mul = M.mul, roundTo = M.roundTo, decimal = M.decimal;
  var MM = M.of(254, 10), source = "dec";
  function mixed(x) { return M.inchPart(x) + "″"; }
  function clean(t) { return String(t).replace(/[″"]|inches|inch|in\b|mm/gi, " ").replace(/(\d)\s*-\s*(\d+\/)/, "$1 $2").trim(); }

  /* The exact size in inches from whichever field was typed in last. */
  function read() {
    var v = M.number(clean(fields[source].value));
    if (!v || M.cmp(v, M.of(100000)) > 0) return null;
    return source === "mm" ? M.div(v, MM) : v;
  }

  function offText(err) {
    return err.n === ZERO ? "exact" : (err.n > ZERO ? "+" : "") + decimal(err, 4) + "″<span>" + (err.n > ZERO ? "+" : "") + decimal(mul(err, MM), 2) + " mm</span>";
  }

  function render() {
    var inches = read(), den = Number(denSel.value);
    Object.keys(fields).forEach(function (k) { fields[k].removeAttribute("aria-invalid"); });
    if (!inches) {
      if (fields[source].value.trim()) fields[source].setAttribute("aria-invalid", "true");
      note.textContent = "Type a size like 3 7/16 in the fraction box, 3.4375 in the decimal box, or 87.3 in millimeters.";
      out.innerHTML = "";
      return;
    }
    var mark = roundTo(inches, den), err = sub(mark, inches), mm = mul(inches, MM);
    if (source !== "frac") fields.frac.value = M.inchPart(mark);
    if (source !== "dec") fields.dec.value = decimal(inches, source === "mm" ? 5 : 6);
    if (source !== "mm") fields.mm.value = decimal(mm, 4);
    var shown = source === "frac" ? mixed(inches) : source === "mm" ? decimal(mm, 3) + " mm" : decimal(inches, 6) + "″";
    if (err.n === ZERO) note.innerHTML = shown + " is exactly <strong>" + mixed(mark) + "</strong>, " + decimal(inches, 6) + "″ or " + decimal(mm, 4) + " mm.";
    else note.innerHTML = shown + " is " + decimal(inches, 5) + "″. The nearest 1/" + den + "″ mark is <strong>" + mixed(mark) + "</strong>, " +
      decimal(err.n > ZERO ? err : M.frac(-err.n, err.d), 4) + "″ " + (err.n > ZERO ? "longer" : "shorter") + ".";
    var rows = "";
    [8, 16, 32, 64].forEach(function (d) {
      var r = roundTo(inches, d);
      rows += "<tr" + (d === den ? ' class="is-pick"' : "") + "><td>1/" + d + "″</td><td class=\"num\"><strong>" + mixed(r) + '</strong></td><td class="num">' + decimal(r, 6) + '″</td><td class="num">' + offText(sub(r, inches)) + "</td></tr>";
    });
    var feet = inches.n / (inches.d * BigInt(12));
    out.innerHTML = '<dl class="fr-sum"><div><dt>Decimal inches</dt><dd>' + decimal(inches, 5) + '″</dd></div><div><dt>Millimeters</dt><dd>' + decimal(mm, 2) +
      " mm</dd></div>" + (feet ? "<div><dt>Feet and inches</dt><dd>" + M.feetInches(inches, 16) + "</dd></div>" : "") + "</dl>" +
      '<div class="table-wrap"><table><caption>Nearest tape mark, its decimal, and how far off it is</caption><thead><tr><th>Round to</th><th class="num">Mark</th><th class="num">Decimal</th><th class="num">Off by</th></tr></thead><tbody>' +
      rows + "</tbody></table></div>";
    try { localStorage.setItem("fractions:last", JSON.stringify({ value: fields[source].value, unit: source === "dec" ? "in" : source, den: den })); } catch (e) {}
  }

  try {
    var last = JSON.parse(localStorage.getItem("fractions:last") || "null");
    if (last && typeof last.value === "string") {
      source = last.unit === "mm" ? "mm" : last.unit === "frac" || /\//.test(last.value) ? "frac" : "dec";
      fields[source].value = last.value;
      if ([16, 32, 64].indexOf(Number(last.den)) >= 0) denSel.value = String(last.den);
    }
  } catch (e) {}
  Object.keys(fields).forEach(function (k) {
    fields[k].addEventListener("input", function () { source = k; render(); });
  });
  denSel.addEventListener("change", render);
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
