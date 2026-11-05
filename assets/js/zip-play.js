var ZIP_START={"n":6,"numbers":[5,21,29,33,25,30,19,13,6,7,4,16],"walls":[],"solution":[5,11,17,23,22,21,27,28,29,35,34,33,32,26,25,31,30,24,18,19,20,14,13,12,6,0,1,7,8,2,3,4,10,9,15,16]};
/* Zip board on /puzzles/zip-puzzle/. Needs zip-engine.js (window.ZipEngine).
   Same rules as the app's PathGame: start on 1, a free neighbour extends the line, going back over it erases. */
(function () {
  "use strict";
  var root = document.getElementById("zp");
  if (!root || !window.ZipEngine) return;
  var Z = window.ZipEngine;
  var boardEl = root.querySelector(".zp-board");
  var statusEl = root.querySelector(".zp-status");
  var hintEl = root.querySelector(".zp-hint");
  var titleEl = root.querySelector(".zp-title");
  var sizeBtns = root.querySelectorAll("[data-size]");
  var levelBtns = root.querySelectorAll("[data-level]");
  var LEVELS = ["Easy", "Medium", "Hard"];
  var C = 40;
  var p, path, history, solved, hints, startedAt, size = 6, level = 1, drag = null, busy = false;

  function name(c) { return String.fromCharCode(65 + c % p.n) + (Math.floor(c / p.n) + 1); }
  function head() { return path.length ? path[path.length - 1] : null; }
  function reached() { var k = 0; path.forEach(function (c) { if (p.numberAt[c]) k++; }); return k; }
  function last() { return p.numbers[p.numbers.length - 1]; }

  function canExtend(c) {
    var h = head();
    if (h === null || path.indexOf(c) >= 0 || !p.grid.adjacent(h, c) || h === last()) return false;
    var k = p.numberAt[c];
    return !k || k === reached() + 1;
  }

  // Returns true when the line changed.
  function moveTo(c) {
    if (!path.length || c === p.numbers[0]) {
      if (c !== p.numbers[0] || (path.length === 1 && path[0] === c)) return false;
      path = [c];
      return true;
    }
    var at = path.indexOf(c);
    if (at >= 0) {
      if (at === path.length - 1) return false;
      path = path.slice(0, at + 1);
      return true;
    }
    if (!canExtend(c)) return false;
    path = path.concat([c]);
    return true;
  }

  // A fast finger can skip cells; walk toward it one neighbour at a time and stop at the first blocked step.
  function walkTo(target) {
    var guard = p.n * p.n;
    while (guard-- > 0) {
      var h = head();
      if (h === null || h === target) return;
      if (path.indexOf(target) >= 0 || p.grid.adjacent(h, target)) { moveTo(target); return; }
      var hr = Math.floor(h / p.n), hc = h % p.n, tr = Math.floor(target / p.n), tc = target % p.n;
      var dr = Math.sign(tr - hr), dc = Math.sign(tc - hc);
      var first = Math.abs(tr - hr) >= Math.abs(tc - hc) ? [h + dr * p.n, h + dc] : [h + dc, h + dr * p.n];
      var moved = false;
      for (var i = 0; i < 2 && !moved; i++) {
        var step = first[i];
        if (step === h || !p.grid.adjacent(h, step)) continue;
        moved = moveTo(step);
      }
      if (!moved) return;
    }
  }

  function svg() {
    var n = p.n, s = n * C, out = '<svg class="zp-svg" viewBox="0 0 ' + s + " " + s + '" aria-hidden="true">';
    var onPath = {};
    path.forEach(function (c) { onPath[c] = true; });
    for (var c = 0; c < n * n; c++) {
      out += '<rect class="zp-c' + (onPath[c] ? " on" : "") + '" x="' + ((c % n) * C + 2) + '" y="' + (Math.floor(c / n) * C + 2) + '" width="' + (C - 4) + '" height="' + (C - 4) + '" rx="6"/>';
    }
    if (path.length > 1) {
      out += '<polyline class="zp-ln" points="' + path.map(function (x) { return ((x % n) * C + 20) + "," + (Math.floor(x / n) * C + 20); }).join(" ") + '"/>';
    }
    p.walls.forEach(function (w) {
      var a = Math.min(w[0], w[1]), b = Math.max(w[0], w[1]), r = Math.floor(a / n), k = a % n;
      out += b === a + 1
        ? '<line class="zp-wall" x1="' + (k + 1) * C + '" y1="' + (r * C + 2) + '" x2="' + (k + 1) * C + '" y2="' + ((r + 1) * C - 2) + '"/>'
        : '<line class="zp-wall" x1="' + (k * C + 2) + '" y1="' + (r + 1) * C + '" x2="' + ((k + 1) * C - 2) + '" y2="' + (r + 1) * C + '"/>';
    });
    var h = head();
    if (h !== null && !p.numberAt[h]) out += '<circle class="zp-head" cx="' + ((h % n) * C + 20) + '" cy="' + (Math.floor(h / n) * C + 20) + '" r="9"/>';
    p.numbers.forEach(function (c, i) {
      var x = (c % n) * C + 20, y = Math.floor(c / n) * C + 20;
      out += '<circle class="zp-dot' + (onPath[c] ? " on" : "") + (c === h ? " head" : "") + '" cx="' + x + '" cy="' + y + '" r="13"/>' +
        '<text class="zp-num" x="' + x + '" y="' + (y + 5) + '">' + (i + 1) + "</text>";
    });
    return out + "</svg>";
  }

  function draw() {
    boardEl.innerHTML = svg();
    var total = p.n * p.n, k = reached();
    if (solved) {
      var secs = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      statusEl.textContent = "Solved in " + Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0") +
        (hints ? " with " + hints + (hints === 1 ? " hint" : " hints") : "") + ". Every cell is filled and the numbers are in order.";
    } else if (!path.length) {
      statusEl.textContent = "Start on 1. " + total + " cells to fill, " + p.numbers.length + " numbers to link.";
    } else if (head() === last()) {
      statusEl.textContent = "You reached the last number, but " + (total - path.length) + " cells are still empty. Back up and find a way through them.";
    } else {
      statusEl.textContent = path.length + " of " + total + " cells. Next number: " + (k + 1) + ". The line ends at " + name(head()) + ".";
    }
  }

  function check() {
    if (solved || !Z.isSolution(p, path)) return;
    solved = true;
    root.classList.add("is-solved");
    hintEl.textContent = "Nice. Tap New board for another one, or pick a different size.";
    if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "zip-solved-" + p.n, event: true });
  }

  function save() { history.push(path.slice()); if (history.length > 300) history.shift(); }
  function changed() { if (!startedAt) startedAt = Date.now(); check(); draw(); }

  function cellAt(e) {
    var r = boardEl.getBoundingClientRect();
    var col = Math.floor((e.clientX - r.left) / r.width * p.n), row = Math.floor((e.clientY - r.top) / r.height * p.n);
    if (col < 0 || row < 0 || col >= p.n || row >= p.n) return null;
    return row * p.n + col;
  }

  boardEl.addEventListener("pointerdown", function (e) {
    if (solved || busy) return;
    var c = cellAt(e);
    if (c === null) return;
    e.preventDefault();
    drag = { before: path.slice(), id: e.pointerId };
    try { boardEl.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
    if (path.length && path.indexOf(c) < 0 && !p.grid.adjacent(head(), c) && c !== p.numbers[0]) walkTo(c);
    else moveTo(c);
    hintEl.textContent = path.length ? "" : "The line starts on 1.";
    changed();
  });
  boardEl.addEventListener("pointermove", function (e) {
    if (!drag || drag.id !== e.pointerId || solved) return;
    var c = cellAt(e);
    if (c === null || c === head()) return;
    var before = path.length + ":" + head();
    walkTo(c);
    if (before !== path.length + ":" + head()) changed();
  });
  function endDrag() {
    if (!drag) return;
    if (drag.before.join() !== path.join()) { history.push(drag.before); if (history.length > 300) history.shift(); }
    drag = null;
  }
  boardEl.addEventListener("pointerup", endDrag);
  boardEl.addEventListener("pointercancel", endDrag);

  var DIRS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  boardEl.addEventListener("keydown", function (e) {
    if (solved || busy) return;
    var d = DIRS[e.key];
    if (!d && e.key !== "Enter" && e.key !== " " && e.key !== "Backspace") return;
    e.preventDefault();
    var before = path.slice();
    if (!path.length) moveTo(p.numbers[0]);
    else if (e.key === "Backspace") { if (path.length > 1) path = path.slice(0, -1); }
    else if (d) {
      var h = head(), r = Math.floor(h / p.n) + d[0], c = h % p.n + d[1];
      if (r >= 0 && c >= 0 && r < p.n && c < p.n) {
        var t = r * p.n + c;
        if (p.grid.adjacent(h, t)) moveTo(t);
      }
    }
    if (before.join() !== path.join()) { history.push(before); hintEl.textContent = ""; changed(); }
  });

  function hint() {
    if (solved || busy) return;
    var h = Z.hint(p, path);
    if (!h) return;
    save();
    var wrong = path.length > h.kept;
    path = h.path;
    hints++;
    var to = p.numberAt[head()];
    var msg = wrong ? "Your line was right for its first " + h.kept + (h.kept === 1 ? " cell" : " cells") + ", so I cut it there and drew the next stretch"
      : h.kept ? "I drew the next stretch" : "Here's the start of the line";
    msg += to ? " up to number " + to + "." : ". It isn't at the next number yet, so tap Hint again or carry on from " + name(head()) + ".";
    hintEl.textContent = msg;
    if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "zip-hint", event: true });
    changed();
  }

  function start(puzzle, title) {
    p = puzzle;
    path = []; history = []; solved = false; hints = 0; startedAt = 0;
    root.classList.remove("is-solved");
    titleEl.textContent = title;
    boardEl.setAttribute("aria-label", p.n + " by " + p.n + " Zip board" + (p.walls.length ? " with " + p.walls.length + " walls" : "") +
      ". Numbers: " + p.numbers.map(function (c, i) { return (i + 1) + " at " + name(c); }).join(", ") +
      (p.walls.length ? ". Walls between " + p.walls.map(function (w) { return name(w[0]) + " and " + name(w[1]); }).join(", ") : "") +
      ". Arrow keys draw the line, Backspace takes back one cell.");
    draw();
  }

  function pressed() {
    sizeBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(+b.dataset.size === size)); });
    levelBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(+b.dataset.level === level)); });
  }

  function fresh() {
    pressed();
    if (busy) return;
    busy = true;
    hintEl.textContent = "";
    statusEl.textContent = "Making a " + size + " by " + size + " board...";
    root.classList.add("is-busy");
    setTimeout(function () {
      var pz = Z.generate(size, level, Math.floor(Math.random() * 1e9));
      busy = false;
      root.classList.remove("is-busy");
      start(pz, size + " by " + size + ", " + LEVELS[level]);
    }, 30);
  }

  sizeBtns.forEach(function (b) { b.addEventListener("click", function () { size = +b.dataset.size; fresh(); }); });
  levelBtns.forEach(function (b) { b.addEventListener("click", function () { level = +b.dataset.level; fresh(); }); });
  root.querySelector("[data-new]").addEventListener("click", fresh);
  root.querySelector("[data-hint]").addEventListener("click", hint);
  root.querySelector("[data-undo]").addEventListener("click", function () {
    if (busy || !history.length) return;
    path = history.pop(); solved = false; root.classList.remove("is-solved"); hintEl.textContent = ""; draw();
  });
  root.querySelector("[data-reset]").addEventListener("click", function () {
    if (busy || !path.length) return;
    save(); path = []; solved = false; root.classList.remove("is-solved"); hintEl.textContent = ""; draw();
  });

  var s = window.ZIP_START;
  start(new Z.Puzzle(s.n, s.numbers, s.solution, s.walls), "Start here: a 6 by 6 board");
  pressed();
  root.setAttribute("data-ready", "1");
})();
