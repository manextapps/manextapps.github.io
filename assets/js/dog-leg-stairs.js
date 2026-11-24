/* Dog legged (U shaped) stair on /tools/dog-legged-staircase-calculator/. Needs inch-math.js (window.InchMath).
   Risers are the fewest at or under the max (the Stair Calculator app's StairEngine rule), split into two flights with
   the extra riser in the first. Each flight has one tread fewer than risers, because the mid landing and the upper
   floor act as the last tread. Stair hall length = longer flight + mid landing + floor landing, both as deep as a
   flight is wide; hall width = two flights + the gap between them. */
(function () {
  "use strict";
  var root = document.getElementById("dl");
  var M = window.InchMath;
  if (!root || !M) return;
  var F = ["height", "maxRiser", "tread", "width", "gap"];
  var DEFAULTS = { height: "10'", maxRiser: "190", tread: "250", width: "1000", gap: "100", plain: "mm", show: "mm" };
  var LABEL = { height: "floor to floor height", maxRiser: "max riser", tread: "tread", width: "flight width", gap: "gap between flights" };
  var MM = M.of(254, 10);
  var out = root.querySelector(".st-out"), draw = root.querySelector(".st-draw"), msg = root.querySelector(".st-msg"), notes = root.querySelector(".dl-notes");

  function field(name) { return root.querySelector("[name=" + name + "]"); }
  function store(v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem("dogLeg:last") || "null");
      localStorage.setItem("dogLeg:last", JSON.stringify(v));
    } catch (e) {
      return null;
    }
  }

  /* Inches as an exact fraction. "3 m", "300 cm", "3048 mm", 10', 10' 0", 7 3/4"; a bare number takes the chosen unit. */
  function parse(text, plain) {
    var s = String(text).trim().toLowerCase().replace(/(\d),(\d)/g, "$1.$2");
    if (!s) return null;
    var m = /^(\d+(?:\.\d+)?|\.\d+)\s*(mm|cm|m)$/.exec(s);
    if (m) {
      var v = M.number(m[1]);
      if (!v) return null;
      return M.div(M.mul(v, M.of(m[2] === "m" ? 1000 : m[2] === "cm" ? 10 : 1)), MM);
    }
    if (/^[\d.\s\/]+$/.test(s)) s += plain === "mm" ? " mm" : "\"";
    return M.parseLength(s);
  }

  function toMm(x) { return M.num(M.mul(x, MM)); }
  function metricLen(x) { var mm = toMm(x); return mm >= 1000 ? (mm / 1000).toFixed(2) + " m" : Math.round(mm) + " mm"; }
  function impLen(x) { return M.feetInches(x, 16).replace(/′ (\d+\/\d+″)$/, "′ 0 $1"); }
  function riserMetric(x) { return (Math.round(toMm(x) * 10) / 10) + " mm"; }
  function both(x, show, small) {
    var a = small ? riserMetric(x) : metricLen(x), b = small ? M.inches(x, 16) : impLen(x);
    return show === "mm" ? [a, b] : [b, a];
  }

  function calculate() {
    var plain = field("plain").value, v = {}, bad = null;
    F.forEach(function (name) {
      var x = parse(field(name).value, plain);
      field(name).removeAttribute("aria-invalid");
      if (!x || x.n < BigInt(0) || (name !== "gap" && x.n === BigInt(0))) { if (!bad) bad = name; field(name).setAttribute("aria-invalid", "true"); }
      v[name] = x;
    });
    if (bad) return { error: "Check the " + LABEL[bad] + ". Type it like 3048 mm, 3 m or 10' 0\"." };
    var n = Number(M.ceil(M.div(v.height, v.maxRiser)));
    if (n < 4) return { error: "That rise needs fewer than 4 risers, too few for two flights. Check the height and the max riser." };
    if (n > 60) return { error: "That makes more than 60 risers. Check the values." };
    var riser = M.div(v.height, M.of(n)), n1 = Math.ceil(n / 2), n2 = n - n1;
    var going1 = M.mul(v.tread, M.of(n1 - 1)), going2 = M.mul(v.tread, M.of(n2 - 1));
    var stairLen = M.add(going1, v.width), hallLen = M.add(stairLen, v.width), hallW = M.add(M.mul(v.width, M.of(2)), v.gap);
    return { v: v, n: n, riser: riser, n1: n1, n2: n2, going1: going1, going2: going2, stairLen: stairLen, hallLen: hallLen, hallW: hallW,
      landingH: M.mul(riser, M.of(n1)), blondel: M.add(M.mul(riser, M.of(2)), v.tread) };
  }

  function svg(r, show) {
    var W = 620, pad = 34, L = M.num(r.hallLen), H = M.num(r.hallW), w = M.num(r.v.width), g = M.num(r.v.gap), T = M.num(r.v.tread);
    var s = (W - 2 * pad) / L, Hpx = H * s + 2 * pad + 22;
    var X = function (x) { return (pad + x * s).toFixed(1); }, Y = function (y) { return (pad + (H - y) * s).toFixed(1); };
    var g1 = M.num(r.going1), g2 = M.num(r.going2), x0 = w, xL = w + g1;
    var o = '<svg class="st-svg dl-svg" viewBox="0 0 ' + W + " " + Hpx.toFixed(0) + '" role="img" aria-label="Plan view drawn to scale: a stair hall of ' +
      both(r.hallLen, show)[0] + " by " + both(r.hallW, show)[0] + ", flight one with " + (r.n1 - 1) + " treads going up to the mid landing, flight two with " +
      (r.n2 - 1) + ' treads coming back">';
    o += '<rect class="dl-hall" x="' + X(0) + '" y="' + Y(H) + '" width="' + (L * s).toFixed(1) + '" height="' + (H * s).toFixed(1) + '"/>';
    o += '<rect class="dl-land" x="' + X(xL) + '" y="' + Y(H) + '" width="' + (w * s).toFixed(1) + '" height="' + (H * s).toFixed(1) + '"/>';
    o += '<rect class="dl-flight" x="' + X(x0) + '" y="' + Y(w) + '" width="' + (g1 * s).toFixed(1) + '" height="' + (w * s).toFixed(1) + '"/>';
    o += '<rect class="dl-flight" x="' + X(xL - g2) + '" y="' + Y(H) + '" width="' + (g2 * s).toFixed(1) + '" height="' + (w * s).toFixed(1) + '"/>';
    var i, x;
    for (i = 1; i < r.n1 - 1; i++) { x = X(x0 + i * T); o += '<line class="dl-tread" x1="' + x + '" y1="' + Y(w) + '" x2="' + x + '" y2="' + Y(0) + '"/>'; }
    for (i = 1; i < r.n2 - 1; i++) { x = X(xL - i * T); o += '<line class="dl-tread" x1="' + x + '" y1="' + Y(H) + '" x2="' + x + '" y2="' + Y(H - w) + '"/>'; }
    var a1 = Y(w / 2), a2 = Y(H - w / 2), mid = (xL + w / 2);
    o += '<path class="dl-walk" d="M' + X(x0 + T * 0.3) + " " + a1 + " L" + X(mid) + " " + a1 + " L" + X(mid) + " " + a2 + " L" + X(xL - g2 + T * 0.3) + " " + a2 + '"/>';
    o += '<path class="dl-arrow" d="M' + X(xL - g2 + T * 0.3) + " " + a2 + " l9 -6 v12 z\"/>";
    o += '<text class="st-t" x="' + X(x0 + g1 / 2) + '" y="' + (Number(a1) + 22) + '" text-anchor="middle">Up, flight 1 (' + r.n1 + " risers)</text>";
    o += '<text class="st-t" x="' + X(xL - g2 / 2) + '" y="' + (Number(a2) - 12) + '" text-anchor="middle">Flight 2 (' + r.n2 + " risers)</text>";
    o += '<text class="st-t muted" x="' + X(mid) + '" y="' + (Number(Y(H)) + 22) + '" text-anchor="middle">Landing</text>';
    o += '<text class="st-t muted" x="' + X(w / 2) + '" y="' + (Number(Y(H / 2)) + 5) + '" text-anchor="middle">Floor</text>';
    o += '<text class="st-t" x="' + X(L / 2) + '" y="' + (Hpx - 10).toFixed(1) + '" text-anchor="middle">' + both(r.hallLen, show)[0] + " long, " + both(r.hallW, show)[0] + " wide</text>";
    return o + "</svg>";
  }

  function render() {
    var vals = {};
    F.concat(["plain", "show"]).forEach(function (n) { vals[n] = field(n).value; });
    store(vals);
    var r = calculate(), show = field("show").value;
    if (r.error) { msg.textContent = r.error; out.innerHTML = ""; draw.innerHTML = ""; notes.innerHTML = ""; return; }
    msg.textContent = "";
    function cell(label, x, note, small) { var b = both(x, show, small); return [label, b[0], b[1] + (note ? ". " + note : "")]; }
    var rows = [
      [ "Risers", r.n + " in all", "Flight 1 has " + r.n1 + ", flight 2 has " + r.n2 ],
      cell("Riser height", r.riser, "The fewest risers at or under your max", true),
      [ "Treads", (r.n1 - 1) + " + " + (r.n2 - 1), "One fewer than risers in each flight. The landing and the upper floor are the last steps" ],
      cell("Flight 1 length", r.going1, "Bottom riser to the landing edge"),
      cell("Flight 2 length", r.going2, "Landing edge to the top riser"),
      cell("Mid landing height", r.landingH, "Above the lower floor"),
      cell("Stair hall length", r.hallLen, "Longer flight, mid landing and a floor landing"),
      cell("Stair hall width", r.hallW, "Two flights and the gap between them"),
    ];
    out.innerHTML = '<dl class="st-res">' + rows.map(function (x) { return "<div><dt>" + x[0] + "</dt><dd>" + x[1] + "<span>" + x[2] + "</span></dd></div>"; }).join("") + "</dl>";
    var list = [], b = toMm(r.blondel), rise1 = M.num(r.landingH);
    list.push("Two risers plus one tread come to " + Math.round(b) + " mm (" + M.inches(r.blondel, 16) + "). England's Approved Document K asks for 550 to 700 mm.");
    if (r.n1 > 12) list.push("Flight 1 has " + r.n1 + " risers. India's Model Building Bye Laws 2016 allow 12 risers per flight in a house, so add a second landing or lower the floor height per flight.");
    if (rise1 > 151) list.push("Flight 1 climbs " + impLen(r.landingH) + ", more than the 151″ the IRC allows between landings.");
    if (toMm(r.landingH) < 2200) list.push("The mid landing sits " + metricLen(r.landingH) + " up, under the 2.2 m of headroom the bylaws ask for in a passage, so nobody can walk under it. The space can still take a cupboard.");
    notes.innerHTML = "<ul>" + list.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>";
    draw.innerHTML = svg(r, show);
  }

  var saved = store();
  if (saved) F.concat(["plain", "show"]).forEach(function (n) { if (typeof saved[n] === "string" && saved[n]) field(n).value = saved[n]; });
  root.addEventListener("input", render);
  root.addEventListener("change", render);
  root.addEventListener("submit", function (e) { e.preventDefault(); });
  root.querySelector("[data-reset]").addEventListener("click", function () {
    Object.keys(DEFAULTS).forEach(function (n) { field(n).value = DEFAULTS[n]; });
    render();
  });
  root.querySelectorAll("[data-preset]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var p = btn.getAttribute("data-preset").split("|");
      ["height", "maxRiser", "tread", "width", "gap", "plain", "show"].forEach(function (n, i) { field(n).value = p[i]; });
      render();
    });
  });
  render();
  root.setAttribute("data-ready", "1");
})();
