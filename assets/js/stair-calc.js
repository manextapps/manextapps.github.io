/* Straight stair calculator on /tools/stair-stringer-calculator/. Needs inch-math.js (window.InchMath).
   The math is the Stair Calculator app's StairEngine.straight() and its notch and throat check: the fewest risers
   that keep each one at or under the max, one tread fewer than risers, and a straight line board estimate. */
(function () {
  "use strict";
  var root = document.getElementById("st");
  var M = window.InchMath;
  if (!root || !M) return;
  var F = ["rise", "maxRiser", "tread", "thickness", "finish", "nosing"];
  var LUMBER = { "2x10": M.of(37, 4), "2x12": M.of(45, 4) };
  var MIN_THROAT = 5, MAX_RISERS = 60;
  var out = root.querySelector(".st-out"), draw = root.querySelector(".st-draw"), msg = root.querySelector(".st-msg");

  function field(name) { return root.querySelector("[name=" + name + "]"); }
  function store(v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem("stairs:last") || "null");
      localStorage.setItem("stairs:last", JSON.stringify(v));
    } catch (e) {
      return null;
    }
  }
  function len(x) { return M.feetInches(x, 16); }
  function dec(x) { return M.decimal(x, 3) + "″"; }
  function ftIn(inches) { return len(M.frac(BigInt(Math.round(inches * 16)), BigInt(16))); }
  function inch(inches) { return M.inches(M.frac(BigInt(Math.round(inches * 16)), BigInt(16)), 16); }

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

  var LABEL = { rise: "total rise", maxRiser: "max riser", tread: "tread depth", thickness: "tread thickness", finish: "floor finish", nosing: "nosing" };

  function calculate() {
    var v = read();
    if (v.bad) return { error: "Check the " + LABEL[v.bad] + ". Type it like 9' 2 1/2\", 110.5 or 2794 mm." };
    if (v.rise.n <= BigInt(0) || v.maxRiser.n <= BigInt(0) || v.tread.n <= BigInt(0)) return { error: "Total rise, max riser and tread depth need to be above zero." };
    var risers = Number(M.ceil(M.div(v.rise, v.maxRiser)));
    if (risers < 2) return { error: "The total rise fits in one step. Check the max riser." };
    if (risers > MAX_RISERS) return { error: "That makes more than " + MAX_RISERS + " risers. Check the values." };
    var riser = M.div(v.rise, M.of(risers));
    if (M.cmp(v.thickness, riser) >= 0) return { error: "Tread thickness must be less than the riser height." };
    var treads = risers - 1, run = M.mul(v.tread, M.of(treads)), R = M.num(riser), T = M.num(v.tread);
    var step = Math.hypot(R, T), notch = R * T / step;
    return {
      v: v, risers: risers, riser: riser, treads: treads, run: run,
      stringer: Math.hypot(M.num(v.rise), M.num(run)), step: step, angle: Math.atan2(R, T) * 180 / Math.PI,
      bottomCut: M.sub(riser, v.thickness), topHang: M.sub(M.add(riser, v.thickness), v.finish),
      board: M.add(v.tread, v.nosing), comfort: M.add(M.mul(riser, M.of(2)), v.tread), notch: notch,
      throat: { "2x10": M.num(LUMBER["2x10"]) - notch, "2x12": M.num(LUMBER["2x12"]) - notch },
    };
  }

  function svg(r) {
    var W = 620, H = 380, pad = 46, rise = M.num(r.v.rise), run = Math.max(M.num(r.run), 1), T = M.num(r.v.tread), R = M.num(r.riser);
    var s = Math.min((W - 2 * pad - T) / run, (H - 2 * pad) / rise), x0 = pad, y0 = H - pad;
    var pts = [[x0, y0]], x = x0, y = y0;
    for (var i = 0; i < r.risers; i++) {
      y -= R * s; pts.push([x, y]);
      if (i < r.treads) { x += T * s; pts.push([x, y]); }
    }
    var top = y, right = x, path = pts.map(function (p, k) { return (k ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
    var o = '<svg class="st-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Side view of the stair, drawn to scale: ' + r.risers + " risers of " + len(r.riser) + ", " + r.treads + " treads of " + len(r.v.tread) + '">';
    o += '<line class="st-floor" x1="8" y1="' + y0 + '" x2="' + (W - 8) + '" y2="' + y0 + '"/><line class="st-floor" x1="' + right + '" y1="' + top + '" x2="' + (W - 8) + '" y2="' + top + '"/>';
    o += '<path class="st-steps" d="' + path + '"/><line class="st-stringer" x1="' + x0 + '" y1="' + y0 + '" x2="' + right + '" y2="' + top + '"/>';
    o += '<text class="st-t" x="' + (x0 - 8) + '" y="' + ((y0 + top) / 2) + '" text-anchor="end" transform="rotate(-90 ' + (x0 - 8) + " " + ((y0 + top) / 2) + ')">' + len(r.v.rise) + "</text>";
    o += '<text class="st-t" x="' + ((x0 + right) / 2) + '" y="' + (y0 + 26) + '" text-anchor="middle">' + len(r.run) + " run</text>";
    o += '<text class="st-t muted" x="' + ((x0 + right) / 2 + 14) + '" y="' + ((y0 + top) / 2 + 22) + '">' + r.angle.toFixed(1) + "°</text>";
    return o + "</svg>";
  }

  function render() {
    var r = calculate(), vals = {};
    F.forEach(function (n) { vals[n] = field(n).value; });
    vals.lumber = field("lumber").value;
    store(vals);
    if (r.error) { msg.textContent = r.error; out.innerHTML = ""; draw.innerHTML = ""; return; }
    msg.textContent = "";
    var lum = field("lumber").value, throat = r.throat[lum];
    var rows = [
      ["Risers", r.risers + " at " + len(r.riser), dec(r.riser) + " exact"],
      ["Treads", r.treads + " at " + len(r.v.tread), "Tread boards " + len(r.board) + " deep with the nosing"],
      ["Total run", len(r.run), "From the face of the bottom riser to the face of the top one"],
      ["Stringer", "about " + ftIn(r.stringer), "Straight line over the rise and run. Buy the board longer"],
      ["Angle", r.angle.toFixed(1) + "°", "2 risers + 1 tread = " + M.inches(r.comfort, 16)],
      ["Bottom riser cut", len(r.bottomCut), "First riser on the stringer, shorter by the tread thickness"],
      ["Top of the stringer", len(r.topHang), "Below the upper subfloor to the last tread cut"],
      ["Step along the board", inch(r.step), "One riser and one tread on the framing square"],
      ["Wood left under the notches", inch(throat) + " on a " + lum.replace("x", "×"), throat >= MIN_THROAT ? "At least 5″ left" : "Under 5″. A wider board or a smaller step leaves more"],
    ];
    out.innerHTML = '<dl class="st-res">' + rows.map(function (x) { return "<div><dt>" + x[0] + "</dt><dd>" + x[1] + "<span>" + x[2] + "</span></dd></div>"; }).join("") + "</dl>";
    draw.innerHTML = svg(r);
  }

  var saved = store();
  if (saved) {
    F.forEach(function (n) { if (typeof saved[n] === "string" && saved[n]) field(n).value = saved[n]; });
    if (LUMBER[saved.lumber]) field("lumber").value = saved.lumber;
  }
  root.addEventListener("input", render);
  root.addEventListener("change", render);
  root.addEventListener("submit", function (e) { e.preventDefault(); });
  root.querySelector("[data-reset]").addEventListener("click", function () {
    var d = { rise: "9' 0\"", maxRiser: "7 3/4", tread: "10", thickness: "1", finish: "3/4", nosing: "1" };
    F.forEach(function (n) { field(n).value = d[n]; });
    field("lumber").value = "2x12";
    render();
  });
  render();
  root.setAttribute("data-ready", "1");
})();
