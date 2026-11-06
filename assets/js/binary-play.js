var BN_START="6|MSMMSSMSMMSSSMSSMMSMSMMSMSMSSMSMSSMM|..M...M..............MM...........M.|........=.......=.xx................|.............................=......";
/* Binary puzzle board on /puzzles/binary-puzzle/. Needs binary-engine.js (window.BinaryEngine) and BN_START.
   Same play as the Sun and Moon app: tap cycles empty, sun, moon; fixed cells can't change; a hint marks the
   cells it talks about and Apply fills them in. New boards come from the app's generator with its pack rules. */
(function () {
  "use strict";
  var root = document.getElementById("bn");
  if (!root || !window.BinaryEngine) return;
  var B = window.BinaryEngine;
  var LEVELS = {
    easy: { size: 6, maxLevel: 2, signs: [4, 6], minGivens: 10, name: "Easy 6x6" },
    medium: { size: 6, maxLevel: 3, signs: [4, 7], minBalance: 1, name: "Medium 6x6" },
    hard: { size: 8, maxLevel: 3, signs: [6, 10], minBalance: 2, name: "Hard 8x8" },
    expert: { size: 10, maxLevel: 3, signs: [9, 14], minBalance: 5, name: "Expert 10x10" },
  };
  var SUN = '<svg viewBox="-79 -79 158 158" aria-hidden="true"><g class="bn-sun"><circle r="25"/>' +
    [0, 45, 90, 135, 180, 225, 270, 315].map(function (a) {
      var x = Math.sin(a * Math.PI / 180), y = -Math.cos(a * Math.PI / 180);
      return '<line x1="' + (37 * x).toFixed(1) + '" y1="' + (37 * y).toFixed(1) + '" x2="' + (46 * x).toFixed(1) + '" y2="' + (46 * y).toFixed(1) + '"/>';
    }).join("") + "</g></svg>";
  var MOON = '<svg viewBox="-79 -79 158 158" aria-hidden="true"><path class="bn-moon" d="M18 -37A40 40 0 1 0 31 27A34 34 0 0 1 18 -37Z"/></svg>';
  var boardEl = root.querySelector(".bn-board");
  var msgEl = root.querySelector(".bn-msg");
  var titleEl = root.querySelector(".bn-title");
  var applyBtn = root.querySelector("[data-apply]");
  var binBox = root.querySelector("[name=digits]");
  var plainBox = root.querySelector("[name=plain]");
  var p, v, history, cellEls, cursor = 0, step = null, level = "medium", started, done;

  function store(k, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(k) || "null");
      localStorage.setItem(k, JSON.stringify(val));
    } catch (e) {
      return null;
    }
  }

  function symbol(x) {
    if (!x) return "";
    if (binBox.checked) return '<span class="bn-digit">' + (x === B.SUN ? "1" : "0") + "</span>";
    return x === B.SUN ? SUN : MOON;
  }
  function word(x) { return binBox.checked ? (x === B.SUN ? "1" : "0") : x === B.SUN ? "sun" : "moon"; }
  function words(x) { return binBox.checked ? (x === B.SUN ? "1s" : "0s") : x === B.SUN ? "suns" : "moons"; }
  function where(line) { return line < p.n ? "row " + (line + 1) : "column " + (line - p.n + 1); }

  function load(puzzle) {
    p = puzzle;
    v = p.givens.slice();
    history = [];
    step = null;
    done = false;
    cursor = Math.min(cursor, p.n * p.n - 1);
    started = Date.now();
    titleEl.textContent = LEVELS[level].name;
    root.classList.remove("is-solved");
    build();
    say("");
    root.setAttribute("data-ready", "1");
  }

  function build() {
    var n = p.n, html = "";
    for (var i = 0; i < n * n; i++) {
      html += '<div class="bn-cell' + (p.givens[i] ? " fixed" : "") + '" data-i="' + i + '" role="gridcell"></div>';
    }
    p.signs.forEach(function (s) {
      var a = s[0], b = s[1], r = Math.floor(a / n), c = a % n, x, y;
      if (b === a + 1) { x = (c + 1) / n; y = (r + 0.5) / n; } else { x = (c + 0.5) / n; y = (r + 1) / n; }
      html += '<span class="bn-badge" style="left:' + (x * 100) + "%;top:" + (y * 100) + '%" aria-hidden="true">' + (s[2] === B.SAME ? "=" : "&times;") + "</span>";
    });
    boardEl.style.setProperty("--n", n);
    boardEl.innerHTML = html;
    cellEls = boardEl.querySelectorAll(".bn-cell");
    paint();
  }

  function label(i) {
    var r = Math.floor(i / p.n) + 1, c = i % p.n + 1;
    return "Row " + r + ", column " + c + ": " + (v[i] ? word(v[i]) : "empty") + (p.givens[i] ? ", fixed" : "");
  }

  function paint() {
    var bad = {};
    B.conflicts(p, v).forEach(function (c) { c.cells.forEach(function (x) { bad[x] = 1; }); });
    var focus = step ? step.focus : [], targets = step ? step.targets : [];
    for (var i = 0; i < cellEls.length; i++) {
      var el = cellEls[i];
      el.innerHTML = symbol(v[i]);
      el.classList.toggle("bad", !!bad[i]);
      el.classList.toggle("focus", focus.indexOf(i) >= 0);
      el.classList.toggle("target", targets.indexOf(i) >= 0);
      el.classList.toggle("cursor", i === cursor);
      el.setAttribute("aria-label", label(i));
    }
  }

  function say(t) { msgEl.textContent = t; }

  function conflictText() {
    var c = B.conflicts(p, v)[0];
    if (!c) return "";
    if (c.problem === "three") return "Three " + words(c.symbol) + " side by side aren't allowed.";
    if (c.problem === "many") return where(c.line).charAt(0).toUpperCase() + where(c.line).slice(1) + " has more than " + p.half + " " + words(c.symbol) + ".";
    if (c.problem === "same") return "Cells joined by = have to match.";
    return "Cells joined by × have to be different.";
  }

  function set(i, x) {
    if (done || p.givens[i] || v[i] === x) return;
    history.push(v.slice());
    v[i] = x;
    changed();
  }

  function changed() {
    step = null;
    applyBtn.hidden = true;
    paint();
    if (B.isSolved(p, v)) {
      done = true;
      root.classList.add("is-solved");
      var s = Math.round((Date.now() - started) / 1000);
      say("Solved in " + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") + ". Tap New board for another.");
      if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "binary-solved-" + level, event: true });
      return;
    }
    say(conflictText());
  }

  function hintText(st) {
    var s = st.symbol, o = 3 - s, n = st.targets.length;
    if (st.kind === "mistake") return "This " + word(s) + " doesn't fit the solution. Apply clears it.";
    if (st.kind === "reveal") return "There's no simple step from here. Apply fills in the marked cell.";
    var w = st.line >= 0 ? where(st.line) : "";
    switch (st.technique) {
      case "sign":
        return st.sign === B.SAME ? "The = sign means these two cells match, so the empty one is a " + word(s) + " too." :
          "The × sign means these two cells are different. Next to a " + word(s) + ", the empty one is a " + word(o) + ".";
      case "pair":
        return "Two " + words(s) + " side by side in " + w + ". " + (n === 1 ? "The next cell has" : "The cells on both ends have") +
          " to be " + (n === 1 ? "a " + word(o) : words(o)) + ", or there'd be three in a row.";
      case "gap": return "A cell between two " + words(s) + " has to be a " + word(o) + ", or there'd be three in a row.";
      case "count": return w.charAt(0).toUpperCase() + w.slice(1) + " already has " + p.half + " " + words(s) + ". " +
        (n === 1 ? "The last empty cell is a " + word(o) + "." : "All " + n + " empty cells are " + words(o) + ".");
      case "signPair": return "These two cells are joined by =. If they were " + words(s) + ", they'd make three with their neighbour, so both are " + words(o) + ".";
      case "balance":
        return w.charAt(0).toUpperCase() + w.slice(1) + " still needs " + st.needSuns + " " + (st.needSuns === 1 ? word(B.SUN) : words(B.SUN)) +
          " and " + st.needMoons + " " + (st.needMoons === 1 ? word(B.MOON) : words(B.MOON)) +
          ". Every way to place them without breaking a rule fills the marked " + (n === 1 ? "cell" : "cells") + " the same way.";
    }
    return "";
  }

  function hint() {
    if (done) return;
    step = B.hint(p, v);
    if (!step) return;
    applyBtn.hidden = false;
    paint();
    say(hintText(step));
    if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "binary-hint", event: true });
  }

  function apply() {
    if (!step) return;
    history.push(v.slice());
    B.apply(v, step);
    changed();
  }

  function newBoard() {
    root.classList.add("is-busy");
    setTimeout(function () {
      var spec = LEVELS[level], puzzle = null;
      // Classic boards: no = or x signs at all, so the givens alone have to pin down the one answer.
      if (plainBox.checked) spec = Object.assign({}, spec, { signs: [0, 0] });
      for (var tries = 0; !puzzle && tries < 400; tries++) {
        puzzle = B.generate(spec, (Math.random() * 4294967296) >>> 0);
        if (puzzle && B.solve(puzzle, 2).length !== 1) puzzle = null;
      }
      root.classList.remove("is-busy");
      if (puzzle) load(puzzle);
    }, 20);
  }

  boardEl.addEventListener("click", function (e) {
    var el = e.target.closest("[data-i]");
    if (!el) return;
    var i = Number(el.getAttribute("data-i"));
    cursor = i;
    if (p.givens[i]) { paint(); return; }
    set(i, (v[i] + 1) % 3);
  });

  boardEl.addEventListener("keydown", function (e) {
    var n = p.n, r = Math.floor(cursor / n), c = cursor % n;
    var moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[e.key]) {
      e.preventDefault();
      r = Math.max(0, Math.min(n - 1, r + moves[e.key][0]));
      c = Math.max(0, Math.min(n - 1, c + moves[e.key][1]));
      cursor = r * n + c;
      paint();
      say(label(cursor));
      return;
    }
    var key = e.key.toLowerCase(), to = null;
    if (key === " " || key === "enter") to = (v[cursor] + 1) % 3;
    else if (key === "s" || key === "1") to = B.SUN;
    else if (key === "m" || key === "0") to = B.MOON;
    else if (key === "backspace" || key === "delete") to = 0;
    if (to === null) return;
    e.preventDefault();
    set(cursor, to);
  });

  root.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || root.classList.contains("is-busy")) return;
    if (b.hasAttribute("data-level")) {
      level = b.getAttribute("data-level");
      opts();
      newBoard();
    } else if (b.hasAttribute("data-hint")) hint();
    else if (b.hasAttribute("data-apply")) apply();
    else if (b.hasAttribute("data-undo")) {
      if (!history.length) return;
      v = history.pop();
      done = false;
      root.classList.remove("is-solved");
      changed();
    } else if (b.hasAttribute("data-clear")) {
      if (!history.length) return;
      history.push(v.slice());
      v = p.givens.slice();
      changed();
    } else if (b.hasAttribute("data-new")) newBoard();
  });

  binBox.addEventListener("change", function () { opts(); paint(); });
  plainBox.addEventListener("change", function () { opts(); newBoard(); });

  function opts() {
    root.querySelectorAll("[data-level]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-level") === level)); });
    root.classList.toggle("as-digits", binBox.checked);
    store("binary:settings", { level: level, digits: binBox.checked, plain: plainBox.checked });
  }

  var saved = store("binary:settings");
  if (saved) {
    if (LEVELS[saved.level]) level = saved.level;
    binBox.checked = !!saved.digits;
    plainBox.checked = !!saved.plain;
  }
  opts();
  if (level === "medium" && !plainBox.checked && window.BN_START) load(B.decode(window.BN_START));
  else newBoard();
})();
