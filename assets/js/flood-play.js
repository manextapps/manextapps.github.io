/* Flood It board on /puzzles/flood-it-strategy/. Needs flood-engine.js (window.FloodEngine).
   Same rules as the app: the flood starts in the top left corner, the move limit is par plus 4 like the
   app's quick play, and stars are 3 at par or better, 2 within par plus 2, 1 otherwise. */
(function () {
  "use strict";
  var root = document.getElementById("fl");
  if (!root || !window.FloodEngine) return;
  var F = window.FloodEngine;
  var NAMES = ["Blue", "Green", "Yellow", "Red", "Purple", "Sky blue"];
  var SYMBOLS = [
    '<circle r=".78"/>', '<path d="M0-1 1 0 0 1-1 0Z"/>', '<path d="M-.25-1h.5v2h-.5ZM-1-.25h2v.5h-2Z"/>',
    '<path d="M0-.95 1 .8H-1Z"/>', '<path d="M-.8-.8h1.6v1.6h-1.6Z"/>', '<path d="M-.61-.85h.38v1.7h-.38ZM.23-.85h.38v1.7h-.38Z"/>',
  ];
  var SLACK = 4;
  var boardEl = root.querySelector(".fl-board");
  var colorsEl = root.querySelector(".fl-colors");
  var statusEl = root.querySelector(".fl-status");
  var msgEl = root.querySelector(".fl-msg");
  var symBox = root.querySelector("[name=symbols]");
  var size = 12, colors = 6, p, cells, history, moves, hints, over, cellEls;

  function store(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null");
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      return null;
    }
  }

  function sym(c) { return '<svg viewBox="-1.2 -1.2 2.4 2.4" aria-hidden="true">' + SYMBOLS[c] + "</svg>"; }

  function par() { return p.solution.length; }
  function limit() { return par() + SLACK; }
  function solved() { for (var i = 1; i < cells.length; i++) if (cells[i] !== cells[0]) return false; return true; }

  function newBoard() {
    root.classList.add("is-busy");
    setTimeout(function () {
      p = F.generate(size, colors, (Math.random() * 4294967296) >>> 0);
      cells = p.cells.slice();
      history = [];
      moves = 0;
      hints = 0;
      over = false;
      root.classList.remove("is-busy", "is-solved");
      drawBoard();
      drawColors();
      say("");
      status();
      root.setAttribute("data-ready", "1");
    }, 20);
  }

  function drawBoard() {
    var html = "";
    for (var i = 0; i < cells.length; i++) html += '<span class="fl-t c' + cells[i] + '">' + sym(cells[i]) + "</span>";
    boardEl.style.setProperty("--n", size);
    boardEl.innerHTML = html;
    cellEls = boardEl.children;
  }

  function paint(dist) {
    for (var i = 0; i < cells.length; i++) {
      var el = cellEls[i], cls = "fl-t c" + cells[i];
      if (el.className === cls) continue;
      el.style.transitionDelay = dist && dist[i] >= 0 ? Math.min(dist[i] * 18, 500) + "ms" : "0ms";
      el.className = cls;
      el.innerHTML = sym(cells[i]);
    }
  }

  function drawColors() {
    var html = "";
    for (var c = 0; c < colors; c++) {
      html += '<button type="button" class="fl-pick c' + c + '" data-color="' + c + '" aria-label="' + NAMES[c] + ", key " + (c + 1) + '">' + sym(c) + "<span>" + (c + 1) + "</span></button>";
    }
    colorsEl.innerHTML = html;
  }

  function status() {
    statusEl.textContent = "Moves " + moves + " of " + limit() + ". Par " + par() + ".";
    colorsEl.querySelectorAll("[data-color]").forEach(function (b) {
      var on = Number(b.getAttribute("data-color")) === cells[0];
      b.setAttribute("aria-pressed", String(on));
      b.classList.remove("is-hint");
    });
  }

  function say(t) { msgEl.textContent = t; }

  function play(c) {
    if (!p || over || c === cells[0] || c >= colors) return;
    history.push(cells);
    var f = F.fill(cells, size, c);
    cells = f.cells;
    moves++;
    paint(f.distance);
    status();
    if (solved()) {
      over = true;
      root.classList.add("is-solved");
      var stars = moves <= par() ? 3 : moves <= par() + 2 ? 2 : 1;
      say("Flooded in " + moves + " moves. Par is " + par() + (moves < par() ? ", so you beat my solver. " : ". ") +
        (stars === 3 ? "That's three stars." : stars === 2 ? "That's two stars." : "That's one star.") + " Tap New board for another.");
      if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "flood-solved-" + size, event: true });
    } else if (moves >= limit()) {
      over = true;
      say("Out of moves. Tap Undo a few times, or Restart to try the same board again.");
    } else {
      say(f.absorbed ? "" : "That color doesn't touch your flood, so it took nothing. Undo gives the move back.");
    }
  }

  function undo() {
    if (!history.length) return;
    cells = history.pop();
    moves--;
    over = false;
    root.classList.remove("is-solved");
    paint(null);
    status();
    say("");
  }

  function hint() {
    if (!p || over) return;
    var next = F.solve(cells, size, colors, Math.max(25, F.beamWidthFor(size) / 4))[0];
    if (next === undefined) return;
    hints++;
    var b = colorsEl.querySelector('[data-color="' + next + '"]');
    b.classList.add("is-hint");
    say("Try " + NAMES[next].toLowerCase() + " next. That's what my solver would play from here.");
    if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "flood-hint", event: true });
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || root.classList.contains("is-busy")) return;
    if (b.hasAttribute("data-color")) play(Number(b.getAttribute("data-color")));
    else if (b.hasAttribute("data-size")) { size = Number(b.getAttribute("data-size")); opts(); newBoard(); }
    else if (b.hasAttribute("data-colors")) { colors = Number(b.getAttribute("data-colors")); opts(); newBoard(); }
    else if (b.hasAttribute("data-undo")) undo();
    else if (b.hasAttribute("data-hint")) hint();
    else if (b.hasAttribute("data-new")) newBoard();
    else if (b.hasAttribute("data-restart")) {
      if (!history.length) return;
      cells = history[0];
      history = [];
      moves = 0;
      over = false;
      root.classList.remove("is-solved");
      paint(null);
      status();
      say("");
    }
  });

  root.addEventListener("keydown", function (e) {
    if (e.target.matches("input, select") || e.metaKey || e.ctrlKey || e.altKey) return;
    var n = Number(e.key);
    if (n >= 1 && n <= colors) { e.preventDefault(); play(n - 1); }
    else if (e.key === "Backspace") { e.preventDefault(); undo(); }
  });

  symBox.addEventListener("change", function () { root.classList.toggle("no-symbols", !symBox.checked); opts(); });

  function opts() {
    root.querySelectorAll("[data-size]").forEach(function (b) { b.setAttribute("aria-pressed", String(Number(b.getAttribute("data-size")) === size)); });
    root.querySelectorAll("[data-colors]").forEach(function (b) { b.setAttribute("aria-pressed", String(Number(b.getAttribute("data-colors")) === colors)); });
    store("flood:settings", { size: size, colors: colors, symbols: symBox.checked });
  }

  var saved = store("flood:settings");
  if (saved) {
    if ([8, 10, 12, 14].indexOf(saved.size) >= 0) size = saved.size;
    if ([4, 5, 6].indexOf(saved.colors) >= 0) colors = saved.colors;
    if (saved.symbols === false) { symBox.checked = false; root.classList.add("no-symbols"); }
  }
  opts();
  newBoard();
})();
