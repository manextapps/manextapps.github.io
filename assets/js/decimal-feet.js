/* Decimal feet to feet and inches, and back, on /tools/decimal-feet-to-feet-and-inches/. Needs inch-math.js
   (window.InchMath). The inches are kept as an exact fraction; only the shown answers round: inches to the chosen
   mark (halves away from zero, like the Construction Calculator app) and decimal feet to the chosen places. */
(function () {
  "use strict";
  var root = document.getElementById("dfc");
  var M = window.InchMath;
  if (!root || !M) return;
  var fields = { ft: root.querySelector("[name=ft]"), fi: root.querySelector("[name=fi]"), inch: root.querySelector("[name=inch]") };
  var denSel = root.querySelector("[name=den]"), placesSel = root.querySelector("[name=places]");
  var note = root.querySelector(".cv-note"), out = root.querySelector(".cv-out");
  var ZERO = BigInt(0), TWELVE = M.of(12), source = "ft";

  function clean(t) { return String(t).trim().replace(/(\d),(\d)/g, "$1.$2"); }

  /* Exact inches from whichever box was typed in last. */
  function read() {
    var t = clean(fields[source].value), v;
    if (!t) return null;
    if (source === "ft") { v = M.number(t.replace(/\s*(ft|feet|foot|['′])\s*$/i, "")); return v && M.mul(v, TWELVE); }
    if (source === "inch") return M.number(t.replace(/\s*(in|inches|inch|["″])\s*$/i, ""));
    v = M.parseLength(t);
    return v;
  }

  function mixed(x) { return M.inchPart(x) + "″"; }
  function ftIn(x, den) { return M.feetInches(x, den).replace(/′ (\d+\/\d+″)$/, "′ 0 $1"); }

  function steps(inches, den) {
    var feet = inches.n / (inches.d * BigInt(12)), rest = M.sub(inches, M.of(Number(feet) * 12));
    var whole = rest.n / rest.d, part = M.sub(rest, M.of(Number(whole))), scaled = M.mul(part, M.of(den));
    var s = "Keep the " + feet + " whole feet. The rest is " + M.decimal(M.div(rest, TWELVE), 6) + " ft, and times 12 that's " + M.decimal(rest, 5) + " inches.";
    if (part.n !== ZERO) {
      var k = M.roundTo(scaled, 1), kt = M.decimal(k, 0);
      s += " For the fraction, " + M.decimal(part, 5) + " × " + den + " = " + M.decimal(scaled, 3) + ", which rounds to " + kt +
        (Number(kt) === den ? ", a whole inch more." : Number(kt) === 0 ? ", so no fraction." : ", so it's " + kt + "/" + den + " before reducing.");
    }
    return s;
  }

  function render() {
    var inches = read(), den = Number(denSel.value), places = Number(placesSel.value);
    Object.keys(fields).forEach(function (k) { fields[k].removeAttribute("aria-invalid"); });
    if (!inches || inches.n < ZERO || M.cmp(inches, M.of(12000000)) > 0) {
      if (fields[source].value.trim()) fields[source].setAttribute("aria-invalid", "true");
      note.textContent = "Type decimal feet like 11.65, feet and inches like 11' 7 13/16\", or inches like 139.8.";
      out.innerHTML = "";
      return;
    }
    var feet = M.div(inches, TWELVE), mark = M.roundTo(inches, den), err = M.sub(mark, inches);
    if (source !== "ft") fields.ft.value = M.decimal(feet, Math.max(places, 4));
    if (source !== "fi") fields.fi.value = ftIn(inches, den);
    if (source !== "inch") fields.inch.value = M.decimal(inches, 4);
    var head;
    if (source === "ft") {
      head = M.decimal(feet, 6) + " ft is <strong>" + ftIn(inches, den) + "</strong>" + (err.n === ZERO ? ", exactly." :
        " to the nearest 1/" + den + "″, " + M.decimal(err.n > ZERO ? err : M.frac(-err.n, err.d), 4) + "″ " + (err.n > ZERO ? "longer." : "shorter."));
      head += " " + steps(inches, den);
    } else {
      head = (source === "fi" ? ftIn(inches, 64) : M.decimal(inches, 5) + "″") + " is <strong>" + M.decimal(feet, places) + " ft</strong>. " +
        "Divide the inches by 12: " + M.decimal(inches, 5) + " ÷ 12 = " + M.decimal(feet, 6) + ".";
    }
    note.innerHTML = head;
    var rows = "";
    [8, 16, 32, 64].forEach(function (d) {
      var r = M.roundTo(inches, d);
      rows += "<tr" + (d === den ? ' class="is-pick"' : "") + "><td>1/" + d + "″</td><td class=\"num\"><strong>" + ftIn(inches, d) + '</strong></td><td class="num">' +
        M.decimal(M.sub(r, inches), 4).replace(/^0$/, "exact") + "</td></tr>";
    });
    out.innerHTML = '<dl class="cv-sum"><div><dt>Decimal feet</dt><dd>' + M.decimal(feet, places) + " ft</dd></div><div><dt>Feet and inches</dt><dd>" + ftIn(inches, den) +
      "</dd></div><div><dt>Inches</dt><dd>" + M.decimal(inches, 4) + "″</dd></div><div><dt>Meters</dt><dd>" + M.decimal(M.mul(inches, M.of(254, 10000)), 4) + " m</dd></div></dl>" +
      '<div class="table-wrap"><table><caption>The same length rounded to each mark, and how far off that is in inches</caption><thead><tr><th>Round to</th><th class="num">Feet and inches</th><th class="num">Off by</th></tr></thead><tbody>' +
      rows + "</tbody></table></div>";
    try { localStorage.setItem("decimalFeet:last", JSON.stringify({ value: fields[source].value, source: source, den: den, places: places })); } catch (e) {}
  }

  try {
    var last = JSON.parse(localStorage.getItem("decimalFeet:last") || "null");
    if (last && typeof last.value === "string" && fields[last.source]) {
      source = last.source;
      fields[source].value = last.value;
      if ([8, 16, 32, 64].indexOf(Number(last.den)) >= 0) denSel.value = String(last.den);
      if ([2, 3, 4].indexOf(Number(last.places)) >= 0) placesSel.value = String(last.places);
    }
  } catch (e) {}
  Object.keys(fields).forEach(function (k) {
    fields[k].addEventListener("input", function () { source = k; render(); });
  });
  denSel.addEventListener("change", render);
  placesSel.addEventListener("change", render);
  root.addEventListener("submit", function (e) { e.preventDefault(); });
  root.querySelectorAll("[data-ft]").forEach(function (b) {
    b.addEventListener("click", function () { source = "ft"; fields.ft.value = b.getAttribute("data-ft"); render(); });
  });
  render();
  root.setAttribute("data-ready", "1");
})();
