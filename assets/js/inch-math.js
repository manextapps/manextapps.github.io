/* Exact inch arithmetic for the measuring pages: fractions as BigInt pairs, the Construction Calculator app's
   rounding (Rational.roundTo: nearest mark, halves away from zero) and its feet, inch and fraction text. */
(function (root) {
  "use strict";
  var B = BigInt, ZERO = B(0), ONE = B(1);

  function gcd(a, b) { a = a < ZERO ? -a : a; b = b < ZERO ? -b : b; while (b) { var t = a % b; a = b; b = t; } return a; }
  function frac(n, d) { if (d < ZERO) { n = -n; d = -d; } var g = gcd(n, d) || ONE; return { n: n / g, d: d / g }; }
  function add(a, b) { return frac(a.n * b.d + b.n * a.d, a.d * b.d); }
  function sub(a, b) { return frac(a.n * b.d - b.n * a.d, a.d * b.d); }
  function mul(a, b) { return frac(a.n * b.n, a.d * b.d); }
  function div(a, b) { return frac(a.n * b.d, a.d * b.n); }
  function cmp(a, b) { var x = a.n * b.d - b.n * a.d; return x > ZERO ? 1 : x < ZERO ? -1 : 0; }
  function of(n, d) { return frac(B(n), B(d || 1)); }
  function num(x) { return Number(x.n) / Number(x.d); }
  function ceil(x) { var q = x.n / x.d; return x.n % x.d && x.n > ZERO ? q + ONE : q; }

  /* A plain number: "3", "3.4375", "3 7/16", "7/16". */
  function number(s) {
    s = s.trim();
    var m = /^(\d+)?\s*(?:(\d+)\/(\d+))?$/.exec(s);
    if (m && (m[1] || m[2])) {
      if (m[3] === "0") return null;
      var whole = frac(B(m[1] || 0), ONE);
      return m[2] ? frac(whole.n * B(m[3]) + B(m[2]), B(m[3])) : whole;
    }
    m = /^(\d*)\.(\d+)$/.exec(s);
    if (!m) return null;
    return frac(B((m[1] || "0") + m[2]), B(10) ** B(m[2].length));
  }

  /* Inches from text like 9' 2 1/2", 9 ft 2.5 in, 110 1/2, 110.5" or 2794 mm. Null when it doesn't read. */
  function parseLength(text) {
    var s = String(text).toLowerCase().replace(/[″"]|inches|inch|in\b/g, " ").replace(/\s+/g, " ").trim();
    if (!s) return null;
    var mm = /^(.*\S)\s*mm$/.exec(s);
    if (mm) { var v = number(mm[1]); return v && div(v, of(254, 10)); }
    var ft = /^(\S+)\s*(?:['′]|ft|feet|foot)\s*(.*)$/.exec(s), inches = ZERO, total;
    if (ft) {
      var f = number(ft[1]);
      if (!f) return null;
      total = mul(f, of(12));
      if (ft[2].trim()) { var r = number(ft[2]); if (!r) return null; total = add(total, r); }
      return total;
    }
    return number(s) || null;
  }

  function roundTo(x, den) {
    var d = B(den), neg = x.n < ZERO, n = neg ? -x.n : x.n;
    var r = (B(2) * n * d + x.d) / (B(2) * x.d);
    return frac(neg ? -r : r, d);
  }

  /* "11 3/4", "3/4", "0". */
  function inchPart(x) {
    var w = x.n / x.d, r = x.n % x.d;
    if (!r) return String(w);
    var f = frac(r, x.d);
    return (w ? w + " " : "") + f.n + "/" + f.d;
  }

  /* 239 3/4 in reads "19′ 11 3/4″"; under a foot, "7 11/16″". */
  function feetInches(x, den) {
    var r = roundTo(x, den || 16), feet = r.n / (r.d * B(12)), rest = sub(r, of(Number(feet) * 12));
    return (feet ? feet + "′ " : "") + inchPart(rest) + "″";
  }

  function inches(x, den) { return inchPart(roundTo(x, den || 16)) + "″"; }

  function decimal(x, places) {
    var neg = x.n < ZERO, n = neg ? -x.n : x.n, scale = B(10) ** B(places);
    var v = (n * scale * B(2) + x.d) / (x.d * B(2)), s = v.toString().padStart(places + 1, "0");
    var txt = s.slice(0, s.length - places) + (places ? "." + s.slice(s.length - places) : "");
    if (places) txt = txt.replace(/0+$/, "").replace(/\.$/, "");
    return (neg && v ? "−" : "") + txt;
  }

  var api = { frac: frac, of: of, add: add, sub: sub, mul: mul, div: div, cmp: cmp, num: num, ceil: ceil, number: number,
    parseLength: parseLength, roundTo: roundTo, inchPart: inchPart, feetInches: feetInches, inches: inches, decimal: decimal };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.InchMath = api;
})(this);
