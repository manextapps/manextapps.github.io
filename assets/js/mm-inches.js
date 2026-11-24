/* Millimeters to inch fractions on /tools/mm-to-inches-fraction/. Needs inch-math.js (window.InchMath) for exact
   fractions and the Construction Calculator app's rounding (nearest mark, halves away from zero). 1 in = 25.4 mm. */
(function () {
  "use strict";
  var root = document.getElementById("mmc");
  var M = window.InchMath;
  if (!root || !M) return;
  var input = root.querySelector("[name=mm]"), denSel = root.querySelector("[name=den]");
  var note = root.querySelector(".cv-note"), out = root.querySelector(".cv-out");
  var MM = M.of(254, 10), ZERO = BigInt(0);

  /* Inches from "16", "16 mm", "1.6 cm", "0.016 m" or "16,5". */
  function read() {
    var s = String(input.value).trim().toLowerCase().replace(/(\d),(\d)/g, "$1.$2");
    var m = /^(\d+(?:\.\d+)?|\.\d+)\s*(mm|cm|m)?$/.exec(s);
    if (!m) return null;
    var v = M.number(m[1]);
    if (!v || v.n === ZERO || M.cmp(v, M.of(1000000)) > 0) return null;
    var mm = M.mul(v, M.of(m[2] === "m" ? 1000 : m[2] === "cm" ? 10 : 1));
    return { mm: mm, inches: M.div(mm, MM) };
  }

  function mixed(x) { return M.inchPart(x) + "″"; }
  function offMm(err, places) {
    if (err.n === ZERO) return "exact";
    var mm = M.mul(err, MM);
    var abs = err.n > ZERO ? mm : M.frac(-mm.n, mm.d), t = M.decimal(abs, places || 2);
    return (err.n > ZERO ? "+" : "−") + (t === "0" ? M.decimal(abs, 3) : t) + " mm";
  }

  function render() {
    var r = read(), den = Number(denSel.value);
    input.removeAttribute("aria-invalid");
    if (!r) {
      if (input.value.trim()) input.setAttribute("aria-invalid", "true");
      note.textContent = "Type a size in millimeters, like 16 or 23.8. You can also type 1.6 cm or 0.5 m.";
      out.innerHTML = "";
      return;
    }
    var x = r.inches, mark = M.roundTo(x, den), err = M.sub(mark, x), mmText = M.decimal(r.mm, 3) + " mm";
    note.innerHTML = err.n === ZERO
      ? mmText + " is exactly <strong>" + mixed(mark) + "</strong>."
      : mmText + " is " + M.decimal(x, 5) + "″. The nearest 1/" + den + "″ mark is <strong>" + mixed(mark) + "</strong>, " +
        offMm(err, 3).replace(/^[+−]/, "") + (err.n > ZERO ? " longer." : " shorter.");
    var step = M.of(1, den), below = M.cmp(mark, x) > 0 ? M.sub(mark, step) : mark, above = M.add(below, step);
    var rows = "";
    [8, 16, 32, 64].forEach(function (d) {
      var m = M.roundTo(x, d);
      rows += "<tr" + (d === den ? ' class="is-pick"' : "") + "><td>1/" + d + "″</td><td class=\"num\"><strong>" + mixed(m) + '</strong></td><td class="num">' +
        M.decimal(m, 6) + '″</td><td class="num">' + offMm(M.sub(m, x)) + "</td></tr>";
    });
    var sum = '<div><dt>Decimal inches</dt><dd>' + M.decimal(x, 5) + "″</dd></div><div><dt>Centimeters</dt><dd>" + M.decimal(M.div(r.mm, M.of(10)), 4) + " cm</dd></div>";
    if (M.cmp(x, M.of(12)) >= 0) sum += "<div><dt>Feet and inches</dt><dd>" + M.feetInches(x, den) + "</dd></div>";
    sum += "<div><dt>Marks either side, 1/" + den + "″</dt><dd>" + (below.n > ZERO ? mixed(below) : "0″") + " and " + mixed(above) + "</dd></div>";
    out.innerHTML = '<dl class="cv-sum">' + sum + '</dl><div class="table-wrap"><table><caption>Nearest tape mark at each precision, and how far it is from your size</caption>' +
      '<thead><tr><th>Round to</th><th class="num">Mark</th><th class="num">Decimal</th><th class="num">Off by</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
    try { localStorage.setItem("mmInches:last", JSON.stringify({ value: input.value, den: den })); } catch (e) {}
  }

  try {
    var last = JSON.parse(localStorage.getItem("mmInches:last") || "null");
    if (last && typeof last.value === "string") {
      input.value = last.value;
      if ([16, 32, 64].indexOf(Number(last.den)) >= 0) denSel.value = String(last.den);
    }
  } catch (e) {}
  input.addEventListener("input", render);
  denSel.addEventListener("change", render);
  root.addEventListener("submit", function (e) { e.preventDefault(); });
  root.querySelectorAll("[data-mm]").forEach(function (b) {
    b.addEventListener("click", function () { input.value = b.getAttribute("data-mm"); render(); });
  });
  render();
  root.setAttribute("data-ready", "1");
})();
