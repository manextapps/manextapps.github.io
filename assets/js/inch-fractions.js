/* Inch fraction converter on /tools/inch-fraction-chart/. Exact fractions with BigInt, and the same rounding as
   the Construction Calculator app (Rational.roundTo): to the nearest mark, halves away from zero. 1 in = 25.4 mm. */
(function () {
  "use strict";
  var root = document.getElementById("fr");
  if (!root) return;
  var input = root.querySelector("[name=value]"), unit = root.querySelector("[name=unit]"), out = root.querySelector(".fr-out");
  var B = BigInt, ZERO = B(0), ONE = B(1);

  function gcd(a, b) { a = a < ZERO ? -a : a; b = b < ZERO ? -b : b; while (b) { var t = a % b; a = b; b = t; } return a; }
  function frac(n, d) { if (d < ZERO) { n = -n; d = -d; } var g = gcd(n, d) || ONE; return { n: n / g, d: d / g }; }
  function sub(a, b) { return frac(a.n * b.d - b.n * a.d, a.d * b.d); }
  function mul(a, b) { return frac(a.n * b.n, a.d * b.d); }

  /* "3.4375", "3 7/16", "7/16", "3-7/16" or "2.5" into an exact fraction. */
  function parse(text) {
    var s = String(text).trim().replace(/[″"]/g, "").replace(/(\d)-(\d)/, "$1 $2");
    var m = /^(\d+)?\s*(?:(\d+)\/(\d+))?$/.exec(s);
    if (m && (m[1] || m[2])) {
      if (m[3] === "0") return null;
      var whole = frac(B(m[1] || 0), ONE);
      return m[2] ? frac(whole.n * B(m[3]) + B(m[2]), B(m[3])) : whole;
    }
    m = /^(\d*)\.(\d+)$/.exec(s) || /^(\d+)$/.exec(s);
    if (!m) return null;
    var digits = m[2] || "";
    return frac(B((m[1] || "0") + digits), B(10) ** B(digits.length));
  }

  function roundTo(x, den) {
    var d = B(den), neg = x.n < ZERO, n = neg ? -x.n : x.n;
    var r = (2n * n * d + x.d) / (2n * x.d);
    return frac(neg ? -r : r, d);
  }

  function mixed(x) {
    var w = x.n / x.d, r = x.n % x.d;
    if (!r) return w + "″";
    var f = frac(r, x.d);
    return (w ? w + " " : "") + f.n + "/" + f.d + "″";
  }

  function decimal(x, places) {
    var neg = x.n < ZERO, n = neg ? -x.n : x.n, scale = B(10) ** B(places);
    var v = (n * scale * 2n + x.d) / (x.d * 2n), s = v.toString().padStart(places + 1, "0");
    var txt = s.slice(0, s.length - places) + (places ? "." + s.slice(s.length - places) : "");
    return (neg && v ? "−" : "") + txt.replace(/\.?0+$/, "");
  }

  var MM = frac(B(254), B(10));

  function render() {
    var v = parse(input.value);
    if (!v || v.n > B(100000) * v.d) { out.innerHTML = "<p>Type a size like 3.4375, 3 7/16 or 87.3.</p>"; return; }
    var inches = unit.value === "mm" ? frac(v.n * B(10), v.d * B(254)) : v;
    var mm = mul(inches, MM), rows = "";
    [8, 16, 32, 64].forEach(function (den) {
      var r = roundTo(inches, den), err = sub(r, inches), errMm = mul(err, MM);
      var off = err.n === ZERO ? "exact" : (err.n > ZERO ? "+" : "") + decimal(err, 4) + "″ (" + (err.n > ZERO ? "+" : "") + decimal(errMm, 2) + " mm)";
      rows += "<tr><td>1/" + den + "″</td><td class=\"num\"><strong>" + mixed(r) + '</strong></td><td class="num">' + off + "</td></tr>";
    });
    var feet = inches.n / (inches.d * 12n), rest = sub(inches, frac(feet * 12n, ONE));
    out.innerHTML = '<dl class="fr-sum"><div><dt>Decimal inches</dt><dd>' + decimal(inches, 5) + '″</dd></div><div><dt>Millimeters</dt><dd>' + decimal(mm, 2) +
      " mm</dd></div>" + (feet ? "<div><dt>Feet and inches</dt><dd>" + feet + "′ " + mixed(roundTo(rest, 16)) + "</dd></div>" : "") + "</dl>" +
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
