/* How many stairs on /tools/how-many-stairs/. Needs inch-math.js (window.InchMath).
   Total rise is the ceiling height plus the floor between the levels. The riser count is the Stair Calculator app's
   StairEngine rule (the fewest risers at or under the max), and the stairwell opening keeps the headroom above the
   nosing line: (headroom + floor) x tread / riser, measured back from the top riser. build.py checks the same math. */
(function () {
  "use strict";
  var root = document.getElementById("hs");
  var M = window.InchMath;
  if (!root || !M) return;
  var F = ["ceiling", "floor", "maxRiser", "tread", "headroom"];
  var DEFAULTS = { ceiling: "9' 0\"", floor: "10 1/2", maxRiser: "7 3/4", tread: "10", headroom: "6' 8\"" };
  var LABEL = { ceiling: "ceiling height", floor: "floor thickness", maxRiser: "max riser", tread: "tread depth", headroom: "headroom" };
  var MAX_RISERS = 60;
  var out = root.querySelector(".st-out"), draw = root.querySelector(".st-draw"), msg = root.querySelector(".st-msg");
  var opts = root.querySelector(".hs-opts"), preset = root.querySelector("[name=preset]");

  function field(name) { return root.querySelector("[name=" + name + "]"); }
  function store(v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem("howManyStairs:last") || "null");
      localStorage.setItem("howManyStairs:last", JSON.stringify(v));
    } catch (e) {
      return null;
    }
  }
  function len(x) { return M.feetInches(x, 16).replace(/′ (\d+\/\d+″)$/, "′ 0 $1"); }
  function ftIn(inches) { return len(M.frac(BigInt(Math.round(inches * 16)), BigInt(16))); }

  function read() {
    var v = {}, bad = null;
    F.forEach(function (name) {
      var x = M.parseLength(field(name).value);
      field(name).removeAttribute("aria-invalid");
      if (!x || x.n < BigInt(0)) { if (!bad) bad = name; field(name).setAttribute("aria-invalid", "true"); }
      v[name] = x;
    });
    return bad ? { bad: bad } : v;
  }

  function stair(v, risers) {
    var rise = M.add(v.ceiling, v.floor), riser = M.div(rise, M.of(risers)), treads = risers - 1;
    var run = M.mul(v.tread, M.of(treads)), R = M.num(riser), T = M.num(v.tread);
    return {
      rise: rise, risers: risers, riser: riser, treads: treads, run: run, angle: Math.atan2(R, T) * 180 / Math.PI,
      opening: (M.num(v.headroom) + M.num(v.floor)) * T / R, stringer: Math.hypot(M.num(rise), M.num(run)),
    };
  }

  function calculate() {
    var v = read();
    if (v.bad) return { error: "Check the " + LABEL[v.bad] + ". Type it like 9' 0\", 108 or 2743 mm." };
    if (v.ceiling.n <= BigInt(0) || v.maxRiser.n <= BigInt(0) || v.tread.n <= BigInt(0)) return { error: "Ceiling height, max riser and tread depth need to be above zero." };
    var rise = M.add(v.ceiling, v.floor);
    var risers = Number(M.ceil(M.div(rise, v.maxRiser)));
    if (risers < 2) return { error: "That rise fits in one step. Check the max riser." };
    if (risers > MAX_RISERS) return { error: "That makes more than " + MAX_RISERS + " risers. Check the values." };
    var list = [];
    for (var n = risers; n < risers + 3 && n <= MAX_RISERS; n++) list.push(stair(v, n));
    return { v: v, best: list[0], list: list };
  }

  function svg(r, v) {
    var W = 620, H = 380, pad = 40;
    var rise = M.num(r.rise), run = Math.max(M.num(r.run), 1), T = M.num(v.tread), R = M.num(r.riser), fl = M.num(v.floor);
    var before = Math.max(24, run * 0.15), after = Math.max(30, run * 0.2);
    var s = Math.min((W - 2 * pad) / (before + run + after), (H - 2 * pad) / rise);
    var X = function (x) { return pad + (x + before) * s; }, Y = function (y) { return H - pad - y * s; };
    var pts = [[0, 0]], x = 0, y = 0;
    for (var i = 0; i < r.risers; i++) {
      y += R; pts.push([x, y]);
      if (i < r.treads) { x += T; pts.push([x, y]); }
    }
    var path = pts.map(function (p, k) { return (k ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1); }).join(" ");
    var edge = Math.max(-before, run - r.opening);
    var o = '<svg class="st-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Side view drawn to scale: ' + r.risers + " risers of " + len(r.riser) +
      " climbing " + len(r.rise) + ", with the floor above cut open " + ftIn(r.opening) + ' back from the top step">';
    o += '<line class="st-floor" x1="8" y1="' + Y(0) + '" x2="' + (W - 8) + '" y2="' + Y(0) + '"/>';
    if (edge > -before) o += '<rect class="hs-slab" x="' + X(-before) + '" y="' + Y(rise) + '" width="' + ((edge + before) * s).toFixed(1) + '" height="' + (fl * s).toFixed(1) + '"/>';
    o += '<rect class="hs-slab" x="' + X(run) + '" y="' + Y(rise) + '" width="' + ((after) * s).toFixed(1) + '" height="' + (fl * s).toFixed(1) + '"/>';
    o += '<path class="st-steps" d="' + path + '"/>';
    if (edge > 0) {
      var nose = R + edge * R / T;
      o += '<line class="hs-head" x1="' + X(edge) + '" y1="' + Y(nose) + '" x2="' + X(edge) + '" y2="' + Y(rise - fl) + '"/>';
      o += '<text class="st-t muted" x="' + (X(edge) + 6) + '" y="' + ((Y(nose) + Y(rise - fl)) / 2) + '">' + len(v.headroom) + " headroom</text>";
    }
    o += '<line class="st-stringer" x1="' + X(Math.max(edge, -before)) + '" y1="' + (Y(rise) - 10) + '" x2="' + X(run) + '" y2="' + (Y(rise) - 10) + '"/>';
    o += '<text class="st-t" x="' + ((X(Math.max(edge, -before)) + X(run)) / 2) + '" y="' + (Y(rise) - 18) + '" text-anchor="middle">' + ftIn(r.opening) + " opening</text>";
    o += '<text class="st-t" x="' + (X(0) + (X(run) - X(0)) / 2) + '" y="' + (Y(0) + 26) + '" text-anchor="middle">' + len(r.run) + " run</text>";
    o += '<text class="st-t" x="' + (X(run) + 8) + '" y="' + ((Y(0) + Y(rise)) / 2) + '">' + len(r.rise) + " rise</text>";
    return o + "</svg>";
  }

  function render() {
    var r = calculate(), vals = {};
    F.forEach(function (n) { vals[n] = field(n).value; });
    store(vals);
    if (r.error) { msg.textContent = r.error; out.innerHTML = ""; draw.innerHTML = ""; opts.innerHTML = ""; return; }
    msg.textContent = "";
    var b = r.best;
    var rows = [
      ["Total rise", len(b.rise), "Ceiling height plus the floor between"],
      ["Steps to climb", b.risers + " risers", "Each " + len(b.riser) + ", " + M.decimal(b.riser, 3) + "″ exact"],
      ["Treads", String(b.treads), "One fewer than risers. The upper floor is the last step"],
      ["Total run", len(b.run), "Floor space from the bottom riser to the top one"],
      ["Angle", b.angle.toFixed(1) + "°", "2 risers + 1 tread = " + M.inches(M.add(M.mul(b.riser, M.of(2)), r.v.tread), 16)],
      ["Stairwell opening", "about " + ftIn(b.opening), "Measured back from the top riser, for " + len(r.v.headroom) + " of headroom"],
    ];
    out.innerHTML = '<dl class="st-res">' + rows.map(function (x) { return "<div><dt>" + x[0] + "</dt><dd>" + x[1] + "<span>" + x[2] + "</span></dd></div>"; }).join("") + "</dl>";
    opts.innerHTML = '<table><caption>The fewest risers, and what one or two more would give</caption><thead><tr><th class="num">Risers</th><th class="num">Riser height</th><th class="num">Treads</th><th class="num">Run</th><th class="num">Angle</th></tr></thead><tbody>' +
      r.list.map(function (s) {
        return "<tr><td class=\"num\"><strong>" + s.risers + "</strong></td><td class=\"num\">" + len(s.riser) + "</td><td class=\"num\">" + s.treads +
          "</td><td class=\"num\">" + len(s.run) + "</td><td class=\"num\">" + s.angle.toFixed(1) + "°</td></tr>";
      }).join("") + "</tbody></table>";
    draw.innerHTML = svg(b, r.v);
  }

  function syncPreset() {
    var f = M.parseLength(field("floor").value), match = "";
    Array.prototype.forEach.call(preset.options, function (o) {
      if (o.value && f && M.cmp(M.parseLength(o.value), f) === 0) match = o.value;
    });
    preset.value = match;
  }

  var saved = store();
  if (saved) F.forEach(function (n) { if (typeof saved[n] === "string" && saved[n]) field(n).value = saved[n]; });
  syncPreset();
  preset.addEventListener("change", function () {
    if (preset.value) field("floor").value = preset.value;
    render();
  });
  root.addEventListener("input", function (e) {
    if (e.target === preset) return;
    if (e.target.name === "floor") syncPreset();
    render();
  });
  root.addEventListener("submit", function (e) { e.preventDefault(); });
  root.querySelector("[data-reset]").addEventListener("click", function () {
    F.forEach(function (n) { field(n).value = DEFAULTS[n]; });
    syncPreset();
    render();
  });
  render();
  root.setAttribute("data-ready", "1");
})();
