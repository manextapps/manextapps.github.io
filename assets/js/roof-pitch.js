/* Roof pitch calculator on /tools/roof-pitch-calculator/. Needs inch-math.js (window.InchMath).
   Pitch is rise per 12 of run: angle = atan(rise / run), percent grade = 100 x rise / run, rafter factor = sqrt(1 + (rise / run)^2).
   Whichever of rise and run, angle or percent was typed last is the source; the other fields follow it. build.py checks the chart
   with the same formulas, and the headless QA checks this script against the chart. */
(function () {
  "use strict";
  var root = document.getElementById("rp");
  var M = window.InchMath;
  if (!root || !M) return;
  var F = ["rise", "run", "deg", "pct", "roofRun"];
  var DEFAULTS = { rise: "9", run: "24", roofRun: "14' 0\"", src: "rr" };
  var out = root.querySelector(".st-out"), draw = root.querySelector(".st-draw"), msg = root.querySelector(".st-msg");
  var src = "rr";

  function field(name) { return root.querySelector("[name=" + name + "]"); }
  function store(v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem("roofPitch:last") || "null");
      localStorage.setItem("roofPitch:last", JSON.stringify(v));
    } catch (e) {
      return null;
    }
  }
  function trim(s) { return s.indexOf(".") < 0 ? s : s.replace(/0+$/, "").replace(/\.$/, ""); }
  function fix(x, places) { return trim(x.toFixed(places)); }
  function len(x) { return M.feetInches(x, 16).replace(/′ (\d+\/\d+″)$/, "′ 0 $1"); }
  function tape(inches) { return M.frac(BigInt(Math.round(inches * 16)), BigInt(16)); }
  function plain(s) { var m = /^\s*(\d*\.?\d+)\s*(?:°|%|deg|degrees)?\s*$/i.exec(s); return m ? Number(m[1]) : null; }
  function mark(name, bad) { if (bad) field(name).setAttribute("aria-invalid", "true"); else field(name).removeAttribute("aria-invalid"); }

  function calculate() {
    F.forEach(function (n) { mark(n, false); });
    var p, x12 = null;
    if (src === "rr") {
      var rise = M.parseLength(field("rise").value), run = M.parseLength(field("run").value);
      if (!rise || rise.n < BigInt(0)) { mark("rise", true); return { error: "Check the rise. Type it like 6, 4 1/2 or 115 mm." }; }
      if (!run || run.n <= BigInt(0)) { mark("run", true); return { error: "The run needs to be above zero. Type it like 12, 2' 0\" or 305 mm." }; }
      x12 = M.mul(M.div(rise, run), M.of(12));
      p = M.num(rise) / M.num(run);
    } else if (src === "deg") {
      var d = plain(field("deg").value);
      if (d === null || d >= 90) { mark("deg", true); return { error: "Type an angle from 0 up to, but not including, 90°." }; }
      p = Math.tan(d * Math.PI / 180);
    } else {
      var g = plain(field("pct").value);
      if (g === null) { mark("pct", true); return { error: "Type the percent grade as a number, like 50." }; }
      p = g / 100;
    }
    var roofRun = null, rr = field("roofRun").value.trim();
    if (rr) {
      roofRun = M.parseLength(rr);
      if (!roofRun || roofRun.n <= BigInt(0)) { mark("roofRun", true); return { error: "Check the roof run, or leave it empty. Type it like 14' 0\"." }; }
    }
    var deg = Math.atan(p) * 180 / Math.PI, factor = Math.sqrt(1 + p * p);
    return { p: p, x12: x12, deg: deg, pct: p * 100, factor: factor, roofRun: roofRun };
  }

  function pitchText(r) { return fix(r.x12 ? M.num(r.x12) : 12 * r.p, 2) + "/12"; }
  function perFoot(r) { return M.inches(r.x12 ? r.x12 : tape(12 * r.p), 16); }

  function svg(r) {
    var W = 620, H = 330, pad = 34, top = 30;
    var run = r.roofRun ? M.num(r.roofRun) : 12, rise = run * r.p;
    var s = Math.min((W - 2 * pad) / (2 * run), (H - top - 2 * pad) / Math.max(rise, 1e-9));
    var halfW = run * s, h = rise * s, cx = W / 2;
    H = Math.round(Math.max(150, h + top + 2 * pad + 10));
    var base = H - pad - 10;
    var L = cx - halfW, R = cx + halfW, T = base - h;
    var runText = r.roofRun ? len(r.roofRun) : "12″", riseText = r.roofRun ? len(tape(run * r.p)) : perFoot(r);
    var rafter = r.roofRun ? len(tape(run * r.factor)) : (12 * r.factor).toFixed(2) + "″";
    var o = '<svg class="st-svg rp-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Roof drawn to scale at ' + pitchText(r) + ", " + r.deg.toFixed(2) +
      "°: " + runText + " of run rises " + riseText + ", with a rafter line of " + rafter + '">';
    o += '<line class="st-floor" x1="8" y1="' + base + '" x2="' + (W - 8) + '" y2="' + base + '"/>';
    o += '<path class="rp-roof" d="M' + L.toFixed(1) + " " + base + " L" + cx.toFixed(1) + " " + T.toFixed(1) + " L" + R.toFixed(1) + " " + base + ' Z"/>';
    o += '<path class="rp-side" d="M' + L.toFixed(1) + " " + base + " L" + cx.toFixed(1) + " " + T.toFixed(1) + '"/>';
    if (h > 2) o += '<line class="hs-head" x1="' + cx + '" y1="' + base + '" x2="' + cx + '" y2="' + T.toFixed(1) + '"/>';
    var arc = Math.min(54, halfW * 0.6), a = Math.atan(r.p);
    if (arc > 8 && r.deg > 0.5) {
      o += '<path class="rp-arc" d="M' + (L + arc).toFixed(1) + " " + base + " A" + arc.toFixed(1) + " " + arc.toFixed(1) + " 0 0 0 " +
        (L + arc * Math.cos(a)).toFixed(1) + " " + (base - arc * Math.sin(a)).toFixed(1) + '"/>';
    }
    o += '<text class="st-t muted" x="' + (L + Math.max(arc, 10) + 8).toFixed(1) + '" y="' + (base - 8) + '">' + fix(r.deg, 2) + "°</text>";
    o += '<text class="st-t" x="' + ((L + cx) / 2).toFixed(1) + '" y="' + (base + 24) + '" text-anchor="middle">' + runText + " run</text>";
    o += '<text class="st-t" x="' + (cx + 8) + '" y="' + Math.min(base - 8, (base + T) / 2 + 6).toFixed(1) + '">' + riseText + " rise</text>";
    var mx = (L + cx) / 2, my = (base + T) / 2, ang = -r.deg;
    if (r.deg > 60) { mx = L - 8; my = Math.max(top, T + 20); ang = 0; }
    o += '<text class="st-t" x="' + mx.toFixed(1) + '" y="' + (my - 10).toFixed(1) + '" text-anchor="' + (r.deg > 60 ? "end" : "middle") + '"' +
      (ang ? ' transform="rotate(' + ang.toFixed(2) + " " + mx.toFixed(1) + " " + (my - 10).toFixed(1) + ')"' : "") + ">" + rafter + " rafter</text>";
    return o + "</svg>";
  }

  function render() {
    var r = calculate(), vals = { src: src };
    F.forEach(function (n) { vals[n] = field(n).value; });
    store(vals);
    if (r.error) { msg.textContent = r.error; out.innerHTML = ""; draw.innerHTML = ""; return; }
    msg.textContent = "";
    if (src !== "deg") field("deg").value = fix(r.deg, 2);
    if (src !== "pct") field("pct").value = fix(r.pct, 1);
    if (src !== "rr") { field("rise").value = fix(12 * r.p, 3); field("run").value = "12"; }
    var rows = [
      ["Pitch", pitchText(r), perFoot(r) + " of rise per foot of run"],
      ["Angle", r.deg.toFixed(2) + "°", "Plumb cut " + r.deg.toFixed(2) + "°, seat cut " + (90 - r.deg).toFixed(2) + "°"],
      ["Percent grade", fix(r.pct, 1) + "%", "Rise ÷ run × 100"],
      ["Rafter factor", r.factor.toFixed(4), (12 * r.factor).toFixed(2) + "″ of rafter per foot of run"],
    ];
    if (r.roofRun) {
      var run = M.num(r.roofRun);
      rows.push(["Roof rise", len(tape(run * r.p)), "Over a run of " + len(r.roofRun)]);
      rows.push(["Rafter line length", len(tape(run * r.factor)), "Run × rafter factor, before any overhang"]);
    }
    out.innerHTML = '<dl class="st-res">' + rows.map(function (x) { return "<div><dt>" + x[0] + "</dt><dd>" + x[1] + "<span>" + x[2] + "</span></dd></div>"; }).join("") + "</dl>";
    draw.innerHTML = svg(r);
  }

  function load(v) {
    src = v.src === "deg" || v.src === "pct" ? v.src : "rr";
    F.forEach(function (n) { if (typeof v[n] === "string") field(n).value = v[n]; });
  }

  var saved = store();
  if (saved) load(saved);
  root.addEventListener("input", function (e) {
    var n = e.target.name;
    if (n === "rise" || n === "run") src = "rr";
    else if (n === "deg" || n === "pct") src = n;
    render();
  });
  root.addEventListener("submit", function (e) { e.preventDefault(); });
  root.querySelector("[data-reset]").addEventListener("click", function () {
    field("deg").value = ""; field("pct").value = "";
    load(DEFAULTS);
    render();
  });
  Array.prototype.forEach.call(root.querySelectorAll("[data-pitch]"), function (b) {
    b.addEventListener("click", function () {
      src = "rr"; field("rise").value = b.getAttribute("data-pitch"); field("run").value = "12";
      render();
    });
  });
  render();
  root.setAttribute("data-ready", "1");
})();
