/* Kaleidoscope drawing toy on /tools/kaleidoscope-drawing/. Every stroke is kept as points around the center
   (-1 to 1) with the settings it was drawn with, so the picture can be redrawn at any size: on screen, after an
   undo, and at 2048 px for the saved PNG. */
(function () {
  "use strict";
  var root = document.getElementById("kd");
  if (!root) return;
  var canvas = root.querySelector("canvas"), ctx = canvas.getContext("2d");
  var segIn = root.querySelector("[name=segments]"), segOut = root.querySelector(".kd-seg"), mirrorIn = root.querySelector("[name=mirror]");
  var sizeIn = root.querySelector("[name=size]"), guidesIn = root.querySelector("[name=guides]"), paperIn = root.querySelector("[name=paper]");
  var inks = root.querySelectorAll("[data-ink]"), undoBtn = root.querySelector("[data-undo]"), redoBtn = root.querySelector("[data-redo]");
  var PAPERS = { cream: "#f6efe0", black: "#16171b", white: "#ffffff" };
  var strokes = [], redo = [], current = null, ink = inks[0].getAttribute("data-ink"), px = 1, STORE = "kaleidoscope:v1";

  function settings() {
    return { n: Math.max(2, Math.min(24, Number(segIn.value) || 8)), mirror: mirrorIn.checked, size: Number(sizeIn.value) || 6, ink: ink };
  }

  function strokePath(c, pts, scale) {
    c.beginPath();
    c.moveTo(pts[0][0] * scale, pts[0][1] * scale);
    if (pts.length === 1) { c.lineTo(pts[0][0] * scale + 0.01, pts[0][1] * scale); return; }
    for (var i = 1; i < pts.length - 1; i++) {
      var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      c.quadraticCurveTo(pts[i][0] * scale, pts[i][1] * scale, mx * scale, my * scale);
    }
    var last = pts[pts.length - 1];
    c.lineTo(last[0] * scale, last[1] * scale);
  }

  /* One stroke, repeated n times around the center, and mirrored inside each slice when Mirror is on. */
  function drawStroke(c, s, half) {
    c.strokeStyle = s.ink;
    c.lineWidth = s.size * half / 300;
    c.lineCap = "round";
    c.lineJoin = "round";
    for (var k = 0; k < s.n; k++) {
      for (var m = 0; m < (s.mirror ? 2 : 1); m++) {
        c.save();
        c.rotate(2 * Math.PI * k / s.n);
        if (m) c.scale(1, -1);
        strokePath(c, s.pts, half);
        c.stroke();
        c.restore();
      }
    }
  }

  function render(c, size, withGuides) {
    var half = size / 2;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = PAPERS[paperIn.value] || PAPERS.cream;
    c.fillRect(0, 0, size, size);
    c.translate(half, half);
    if (withGuides) {
      var n = settings().n;
      c.strokeStyle = paperIn.value === "black" ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.12)";
      c.lineWidth = Math.max(1, size / 600);
      c.setLineDash([size / 120, size / 80]);
      for (var k = 0; k < n; k++) {
        var a = 2 * Math.PI * k / n;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * half * 1.5, Math.sin(a) * half * 1.5); c.stroke();
      }
      c.setLineDash([]);
    }
    strokes.forEach(function (s) { drawStroke(c, s, half); });
    if (current) drawStroke(c, current, half);
  }

  function redraw() { render(ctx, canvas.width, guidesIn.checked); }

  function resize() {
    var w = canvas.clientWidth;
    px = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.height = Math.round(w * px);
    redraw();
  }

  function point(e) {
    var r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1];
  }

  function sync() {
    undoBtn.disabled = !strokes.length;
    redoBtn.disabled = !redo.length;
    segOut.textContent = settings().n;
    try { localStorage.setItem(STORE, JSON.stringify({ strokes: strokes.slice(-400), paper: paperIn.value })); } catch (e) {}
  }

  canvas.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    var s = settings();
    current = { n: s.n, mirror: s.mirror, size: s.size, ink: s.ink, pts: [point(e)] };
    redraw();
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!current) return;
    var p = point(e), last = current.pts[current.pts.length - 1];
    // Skip points closer than about half a pixel, so a slow hand doesn't pile up thousands of them.
    if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) < 1 / canvas.clientWidth) return;
    current.pts.push([Math.round(p[0] * 10000) / 10000, Math.round(p[1] * 10000) / 10000]);
    redraw();
  });
  function finish() {
    if (!current) return;
    strokes.push(current); current = null; redo = [];
    redraw(); sync();
  }
  canvas.addEventListener("pointerup", finish);
  canvas.addEventListener("pointercancel", finish);

  function undo() { if (strokes.length) { redo.push(strokes.pop()); redraw(); sync(); } }
  function again() { if (redo.length) { strokes.push(redo.pop()); redraw(); sync(); } }
  undoBtn.addEventListener("click", undo);
  redoBtn.addEventListener("click", again);
  root.querySelector("[data-clear]").addEventListener("click", function () {
    if (!strokes.length) return;
    // Clearing is undoable: the strokes go onto the redo stack in order, newest last.
    redo = redo.concat(strokes.slice().reverse()); strokes = [];
    redraw(); sync();
  });
  root.querySelector("[data-save]").addEventListener("click", function () {
    var out = document.createElement("canvas");
    out.width = out.height = 2048;
    render(out.getContext("2d"), 2048, false);
    out.toBlob(function (blob) {
      if (!blob) return;
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "kaleidoscope.png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    }, "image/png");
  });
  inks.forEach(function (b) {
    b.addEventListener("click", function () {
      ink = b.getAttribute("data-ink");
      inks.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    });
  });
  [segIn, mirrorIn, guidesIn, paperIn].forEach(function (el) { el.addEventListener("input", function () { redraw(); sync(); }); });
  document.addEventListener("keydown", function (e) {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== "range" && e.target.type !== "checkbox") return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) again(); else undo(); }
  });

  try {
    var saved = JSON.parse(localStorage.getItem(STORE) || "null");
    if (saved && Array.isArray(saved.strokes)) {
      strokes = saved.strokes.filter(function (s) { return s && Array.isArray(s.pts) && s.pts.length && s.n >= 2 && s.n <= 24; });
      if (PAPERS[saved.paper]) paperIn.value = saved.paper;
    }
  } catch (e) {}
  window.addEventListener("resize", resize);
  resize(); sync();
  root.setAttribute("data-ready", "1");
})();
