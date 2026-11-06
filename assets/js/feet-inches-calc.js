/* Feet and inches calculator on /tools/feet-and-inches-calculator/. Needs inch-math.js (window.InchMath).
   The rules are the Construction Calculator app's: exact fractions throughout, × and ÷ before + and −,
   length × length is an area, length ÷ length a count, and a plain number added to a length reads as inches.
   build.py checks the same rules in Python against the app's tests. */
(function (root) {
  "use strict";
  var M = root.InchMath || (typeof module !== "undefined" && module.exports ? require("./inch-math.js") : null);
  var B = BigInt, ZERO = B(0);
  var UNITS = { "'": M.of(12), '"': M.of(1), mm: M.of(5, 127), cm: M.of(50, 127), m: M.of(5000, 127), yd: M.of(36) };
  var TOKEN = /\s*(\d+\/\d+|\d+(?:\.\d*)?|\.\d+|mm|cm|yd|m|'|"|[+\-×÷]|\/)/y;
  var NOUNS = ["a number", "a length", "an area", "a volume"];

  function normalize(text) {
    return String(text).replace(/[″“”]/g, '"').replace(/[′’‘]/g, "'").replace(/[−–]/g, "-").replace(/\*/g, "×")
      .replace(/([\d\s'"])[xX](?=[\s\d.])/g, "$1×")
      .replace(/\b(feet|foot|ft)\b/gi, "'").replace(/\b(inches|inch|in)\b/gi, '"');
  }

  function tokens(text) {
    var t = normalize(text).trim(), out = [], at = 0, m;
    while (at < t.length) {
      TOKEN.lastIndex = at;
      m = TOKEN.exec(t);
      if (!m || TOKEN.lastIndex === at) return "Can't read “" + t.slice(at).trim().slice(0, 12) + "”";
      // A slash between two numbers with no spaces is a fraction; with spaces it means divide.
      out.push(m[1] === "/" ? "÷" : m[1]);
      at = TOKEN.lastIndex;
    }
    return out;
  }

  function isNum(x) { return /^[\d.]/.test(x); }
  function value(x) {
    if (x.indexOf("/") >= 0) {
      var p = x.split("/");
      return p[1] === "0" || /^0+$/.test(p[1]) ? null : M.frac(B(p[0]), B(p[1]));
    }
    return M.number(x.replace(/\.$/, ""));
  }

  function inches(toks) {
    var bad = "Write inches as a whole number and a fraction, like 7 3/8";
    if (!toks.length) return M.of(0);
    if (toks.length > 2 || !toks.every(isNum)) return bad;
    if (toks.length === 2 && (toks[0].indexOf("/") >= 0 || toks[1].indexOf("/") < 0 || toks[0].indexOf(".") >= 0)) return bad;
    var total = M.of(0);
    for (var i = 0; i < toks.length; i++) {
      var v = value(toks[i]);
      if (!v) return "Enter a denominator greater than zero";
      total = M.add(total, v);
    }
    return total;
  }

  function operand(toks) {
    if (!toks.length) return "Type a number first";
    var i = toks.indexOf("'"), inch;
    if (i >= 0) {
      if (i !== 1 || toks[0].indexOf("/") >= 0) return "Type feet as one number, like 5'";
      var rest = toks.slice(2);
      if (rest.length && rest[rest.length - 1] === '"') rest = rest.slice(0, -1);
      inch = inches(rest);
      return typeof inch === "string" ? inch : { v: M.add(M.mul(value(toks[0]), M.of(12)), inch), d: 1 };
    }
    var last = toks[toks.length - 1];
    if (last === '"') {
      inch = inches(toks.slice(0, -1));
      return typeof inch === "string" ? inch : { v: inch, d: 1 };
    }
    if (UNITS[last] && last !== "'") {
      if (toks.length !== 2 || toks[0].indexOf("/") >= 0) return "Units like mm go on a plain number, like 300 mm";
      return { v: M.mul(value(toks[0]), UNITS[last]), d: 1 };
    }
    if (!toks.every(isNum)) return "Check the units";
    inch = inches(toks);
    return typeof inch === "string" ? inch : { v: inch, d: 0 };
  }

  function evaluate(text) {
    var toks = tokens(text);
    if (typeof toks === "string") return { error: toks };
    var operands = [], ops = [], cur = [], neg = false;
    toks = toks.concat(["END"]);
    for (var k = 0; k < toks.length; k++) {
      var tok = toks[k];
      if (["+", "-", "×", "÷", "END"].indexOf(tok) >= 0) {
        if (!cur.length) {
          if (tok === "-" && !neg) { neg = true; continue; }
          return { error: "Type a number first" };
        }
        var o = operand(cur);
        if (typeof o === "string") return { error: o };
        operands.push({ v: neg ? M.frac(-o.v.n, o.v.d) : o.v, d: o.d });
        cur = []; neg = false;
        if (tok !== "END") ops.push(tok);
      } else cur.push(tok);
    }
    var terms = [operands[0]], addOps = [];
    for (var j = 0; j < ops.length; j++) {
      var op = ops[j], right = operands[j + 1];
      if (op === "×" || op === "÷") {
        var left = terms.pop();
        if (op === "÷") {
          if (right.v.n === ZERO) return { error: "Can't divide by zero" };
          if (left.d - right.d < 0) return { error: "Can't divide a number by a length" };
          terms.push({ v: M.div(left.v, right.v), d: left.d - right.d });
        } else {
          if (left.d + right.d > 3) return { error: "That goes past a volume. Check the units" };
          terms.push({ v: M.mul(left.v, right.v), d: left.d + right.d });
        }
      } else { addOps.push(op); terms.push(right); }
    }
    var implicit = false;
    if (addOps.length && terms.some(function (t) { return t.d === 1; })) {
      implicit = terms.some(function (t) { return t.d === 0; });
      terms = terms.map(function (t) { return t.d === 0 ? { v: t.v, d: 1 } : t; });
    }
    var acc = terms[0];
    for (var a = 0; a < addOps.length; a++) {
      var t = terms[a + 1];
      if (acc.d !== t.d) return { error: "Can't add or subtract " + NOUNS[acc.d] + " and " + NOUNS[t.d] };
      acc = { v: addOps[a] === "+" ? M.add(acc.v, t.v) : M.sub(acc.v, t.v), d: acc.d };
    }
    return { value: acc.v, dim: acc.d, implicit: implicit };
  }

  function neg(x) { return x.n < ZERO; }
  function abs(x) { return neg(x) ? M.frac(-x.n, x.d) : x; }
  function sign(x) { return neg(x) ? "−" : ""; }

  /* MeasureFormat.feetInches(): "19′ 11 3/4″", "3/4″", "−3′ 4 1/2″". */
  function feetInches(x, den) {
    var r = M.roundTo(x, den), mag = abs(r), feet = mag.n / (mag.d * B(12)), rest = M.sub(mag, M.of(Number(feet) * 12));
    return sign(r) + (feet ? feet + "′ " : "") + M.inchPart(rest) + "″";
  }
  function inchesText(x, den) { var r = M.roundTo(x, den); return sign(r) + M.inchPart(abs(r)) + "″"; }
  function dec(x, places) { return (neg(x) ? "−" : "") + M.decimal(abs(x), places); }
  function rounded(x, places) { return M.cmp(M.roundTo(x, Math.pow(10, places)), x) !== 0; }

  var api = { evaluate: evaluate, feetInches: feetInches, inchesText: inchesText, dec: dec, rounded: rounded, normalize: normalize };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  root.FeetInches = api;

  var form = document.getElementById("fi");
  if (!form) return;
  var input = form.querySelector("[name=expr]"), prec = form.querySelector("[name=prec]"), out = form.querySelector(".fi-out");
  var SQ_FT = M.of(144), CU_FT = M.of(1728), CU_YD = M.of(46656), MM = M.of(254, 10);

  function row(label, text, approx) { return "<div><dt>" + label + "</dt><dd>" + (approx ? "≈ " : "") + text + "</dd></div>"; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function render() {
    var den = Number(prec.value) || 16, r = evaluate(input.value);
    input.removeAttribute("aria-invalid");
    if (!input.value.trim()) { out.innerHTML = '<p class="fi-msg">Type a length, like 5\' 7 3/8" + 2\' 4 1/2".</p>'; return; }
    if (r.error) {
      input.setAttribute("aria-invalid", "true");
      out.innerHTML = '<p class="fi-msg" role="alert">' + esc(r.error) + ".</p>";
      return;
    }
    var v = r.value, html, rows = "";
    if (r.dim === 1) {
      var approx = M.cmp(M.roundTo(v, den), v) !== 0, mm = M.mul(v, MM);
      html = '<p class="fi-big">' + (approx ? "≈ " : "") + feetInches(v, den) + "</p>" +
        (approx ? '<p class="fi-exact">exactly ' + dec(v, 4) + "″, rounded to the nearest 1/" + den + "″</p>" : "");
      rows = row("Inches", inchesText(v, den), approx) + row("Decimal inches", dec(v, 3) + "″", rounded(v, 3)) +
        row("Decimal feet", dec(M.div(v, M.of(12)), 3) + "′", rounded(M.div(v, M.of(12)), 3)) +
        row("Millimeters", dec(mm, 1) + " mm", rounded(mm, 1)) + row("Meters", dec(M.div(mm, M.of(1000)), 3) + " m", rounded(M.div(mm, M.of(1000)), 3));
    } else if (r.dim === 0) {
      html = '<p class="fi-big">' + (rounded(v, 4) ? "≈ " : "") + dec(v, 4) + "</p><p class=\"fi-exact\">A plain number, with no unit.</p>";
    } else if (r.dim === 2) {
      var ft2 = M.div(v, SQ_FT), m2 = M.div(M.mul(v, M.mul(MM, MM)), M.of(1000000));
      html = '<p class="fi-big">' + (rounded(ft2, 2) ? "≈ " : "") + dec(ft2, 2) + " ft²</p>";
      rows = row("Square inches", dec(v, 2) + " in²", rounded(v, 2)) + row("Square meters", dec(m2, 3) + " m²", rounded(m2, 3));
    } else {
      var ft3 = M.div(v, CU_FT), yd3 = M.div(v, CU_YD), m3 = M.div(M.mul(v, M.mul(MM, M.mul(MM, MM))), M.of(1000000000));
      html = '<p class="fi-big">' + (rounded(ft3, 2) ? "≈ " : "") + dec(ft3, 2) + " ft³</p>";
      rows = row("Cubic yards", dec(yd3, 2) + " yd³", rounded(yd3, 2)) + row("Cubic meters", dec(m3, 3) + " m³", rounded(m3, 3));
    }
    if (r.implicit) html += '<p class="fi-note">A plain number added to a length is read as inches.</p>';
    out.innerHTML = html + (rows ? '<dl class="fi-rows">' + rows + "</dl>" : "");
    try { localStorage.setItem("feetinches:last", JSON.stringify({ expr: input.value, prec: prec.value })); } catch (e) {}
  }

  function insert(text) {
    var s = input.selectionStart == null ? input.value.length : input.selectionStart, e = input.selectionEnd == null ? s : input.selectionEnd;
    input.value = input.value.slice(0, s) + text + input.value.slice(e);
    input.focus();
    input.setSelectionRange(s + text.length, s + text.length);
    render();
  }

  try {
    var last = JSON.parse(localStorage.getItem("feetinches:last") || "null");
    if (last && typeof last.expr === "string") { input.value = last.expr; if (/^(2|4|8|16|32|64)$/.test(last.prec)) prec.value = last.prec; }
  } catch (e) {}
  input.addEventListener("input", render);
  prec.addEventListener("change", render);
  form.addEventListener("submit", function (e) { e.preventDefault(); render(); });
  form.addEventListener("click", function (e) {
    var b = e.target.closest("[data-insert],[data-expr],[data-clear]");
    if (!b) return;
    if (b.hasAttribute("data-insert")) insert(b.getAttribute("data-insert"));
    else if (b.hasAttribute("data-expr")) { input.value = b.getAttribute("data-expr"); render(); }
    else { input.value = ""; input.focus(); render(); }
  });
  render();
  form.setAttribute("data-ready", "1");
})(this);
