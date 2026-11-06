var FS_START="5|4315221435325141524354321|0300000005000000000000020|........<......<..>..>>..|>.......>.......>........";
/* Futoshiki board on /puzzles/futoshiki/. Needs futoshiki-engine.js (window.FutoshikiEngine) and FS_START.
   Same play as the Futoshiki app: pick a cell, then a number; notes mode keeps pencil marks; a hint marks the
   cells it talks about and Apply fills the cell in. New boards come from the app's generator and pack rules. */
(function () {
  "use strict";
  var root = document.getElementById("fs");
  if (!root || !window.FutoshikiEngine) return;
  var F = window.FutoshikiEngine;
  var LEVELS = {
    easy: { size: 4, maxLevel: 2, minLevel: 2, signs: [4, 6], minGivens: 1, name: "Easy 4x4" },
    medium: { size: 5, maxLevel: 3, minLevel: 2, signs: [8, 11], name: "Medium 5x5" },
    hard: { size: 6, maxLevel: 4, minLevel: 4, signs: [12, 16], minPairs: 1, name: "Hard 6x6" },
  };
  var CHEVRON = '<svg viewBox="-12 -14 24 28" aria-hidden="true"><path d="M-7-11 7 0-7 11"/></svg>';
  var boardEl = root.querySelector(".fs-board");
  var padEl = root.querySelector(".fs-pad");
  var msgEl = root.querySelector(".fs-msg");
  var titleEl = root.querySelector(".fs-title");
  var applyBtn = root.querySelector("[data-apply]");
  var notesBtn = root.querySelector("[data-notes]");
  var p, v, notes, history, cellEls, cursor = 0, step = null, level = "medium", started, done, noting = false;

  function store(k, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(k) || "null");
      localStorage.setItem(k, JSON.stringify(val));
    } catch (e) {
      return null;
    }
  }

  function load(puzzle) {
    p = puzzle;
    v = p.givens.slice();
    notes = v.map(function () { return 0; });
    history = [];
    step = null;
    done = false;
    cursor = 0;
    while (cursor < v.length - 1 && p.givens[cursor]) cursor++;
    started = Date.now();
    titleEl.textContent = LEVELS[level].name;
    root.classList.remove("is-solved");
    applyBtn.hidden = true;
    build();
    say("");
    root.setAttribute("data-ready", "1");
  }

  function build() {
    var n = p.n, html = "";
    for (var i = 0; i < n * n; i++) html += '<div class="fs-cell' + (p.givens[i] ? " fixed" : "") + '" data-i="' + i + '" role="gridcell"></div>';
    p.signs.forEach(function (s) {
      var a = s[0], b = s[1], r = Math.floor(a / n), c = a % n, across = b === a + 1;
      var x = across ? (c + 1) / n : (c + 0.5) / n, y = across ? (r + 0.5) / n : (r + 1) / n;
      var angle = across ? (s[2] === F.GREATER ? 0 : 180) : (s[2] === F.GREATER ? 90 : -90);
      html += '<span class="fs-sign" style="left:' + (x * 100) + "%;top:" + (y * 100) + "%;transform:rotate(" + angle + 'deg)" aria-hidden="true">' + CHEVRON + "</span>";
    });
    boardEl.style.setProperty("--n", n);
    boardEl.innerHTML = html;
    cellEls = boardEl.querySelectorAll(".fs-cell");
    var pad = "";
    for (var k = 1; k <= n; k++) pad += '<button type="button" class="fs-key" data-num="' + k + '">' + k + "</button>";
    padEl.innerHTML = pad + '<button type="button" class="fs-key" data-num="0" aria-label="Erase">&times;</button>';
    paint();
  }

  function rel(a, b) {
    for (var i = 0; i < p.relations.length; i++) if (p.relations[i][0] === a && p.relations[i][1] === b) return true;
    return false;
  }

  function label(i) {
    var n = p.n, r = Math.floor(i / n), c = i % n, parts = [];
    if (c > 0) parts.push(rel(i - 1, i) ? "bigger than the cell to its left" : rel(i, i - 1) ? "smaller than the cell to its left" : "");
    if (c < n - 1) parts.push(rel(i + 1, i) ? "bigger than the cell to its right" : rel(i, i + 1) ? "smaller than the cell to its right" : "");
    if (r > 0) parts.push(rel(i - n, i) ? "bigger than the cell above" : rel(i, i - n) ? "smaller than the cell above" : "");
    if (r < n - 1) parts.push(rel(i + n, i) ? "bigger than the cell below" : rel(i, i + n) ? "smaller than the cell below" : "");
    parts = parts.filter(Boolean);
    return "Row " + (r + 1) + ", column " + (c + 1) + ": " + (v[i] || "empty") + (p.givens[i] ? ", fixed" : "") + (parts.length ? ", " + parts.join(", ") : "");
  }

  function paint() {
    var bad = {};
    F.conflicts(p, v).forEach(function (c) { c.cells.forEach(function (x) { bad[x] = 1; }); });
    var focus = step ? step.focus : [], target = step ? step.target : -1;
    for (var i = 0; i < cellEls.length; i++) {
      var el = cellEls[i], html = "";
      if (v[i]) html = '<span class="fs-v">' + v[i] + "</span>";
      else if (notes[i]) {
        html = '<span class="fs-notes" style="--n:' + Math.ceil(Math.sqrt(p.n)) + '">';
        for (var k = 1; k <= p.n; k++) html += "<i>" + (notes[i] >> (k - 1) & 1 ? k : "") + "</i>";
        html += "</span>";
      }
      el.innerHTML = html;
      el.classList.toggle("bad", !!bad[i]);
      el.classList.toggle("focus", focus.indexOf(i) >= 0);
      el.classList.toggle("target", i === target);
      el.classList.toggle("cursor", i === cursor);
      el.setAttribute("aria-label", label(i));
    }
  }

  function say(t) { msgEl.textContent = t; }

  function conflictText() {
    var c = F.conflicts(p, v)[0];
    if (!c) return "";
    if (c.problem === "repeat") return (c.line < p.n ? "This row" : "This column") + " has more than one " + c.value + ".";
    return "The " + v[c.cells[0]] + " and the " + v[c.cells[1]] + " don't fit the sign between them.";
  }

  function put(i, x) {
    if (done || p.givens[i]) return;
    if (noting && x) {
      if (v[i]) return;
      history.push({ v: v.slice(), notes: notes.slice() });
      notes[i] ^= 1 << (x - 1);
      paint();
      return;
    }
    if (v[i] === x && !(x === 0 && notes[i])) return;
    history.push({ v: v.slice(), notes: notes.slice() });
    v[i] = x;
    if (x === 0) notes[i] = 0;
    changed();
  }

  function changed() {
    step = null;
    applyBtn.hidden = true;
    paint();
    if (F.isSolved(p, v)) {
      done = true;
      root.classList.add("is-solved");
      var s = Math.round((Date.now() - started) / 1000);
      say("Solved in " + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") + ". Tap New board for another.");
      if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "futoshiki-solved-" + level, event: true });
      return;
    }
    say(conflictText());
  }

  function where(line) { return line < p.n ? "row" : "column"; }

  function boundText(b) {
    if (b.length === 1 && b.lower) return b.anchor ? "This cell is bigger than the " + b.anchor + " next to it." : "This cell is bigger than the marked cell next to it, so it can't be 1.";
    if (b.length === 1) return b.anchor ? "This cell is smaller than the " + b.anchor + " next to it." : "This cell is smaller than the marked cell next to it, so it can't be " + p.n + ".";
    var k = b.anchor ? b.length - 1 : b.length;
    var dir = b.lower ? "down" : "up", most = b.lower ? "at least " : "at most ";
    if (b.anchor) return "The signs step " + dir + " from here through " + k + (k === 1 ? " cell" : " cells") + " to the " + b.anchor + ", so this cell is " + most + b.value + ".";
    return "The signs step " + dir + " " + k + (k === 1 ? " time" : " times") + " from here, so this cell is " + most + b.value + ".";
  }

  function hintText(s) {
    var x = s.value;
    if (s.kind === "mistake") return "This " + s.wrong + " doesn't fit the solution. Apply clears it.";
    if (s.kind === "reveal") return "There's no simple step from here. Apply fills in the marked cell.";
    var hidden = s.line >= 0;
    if (s.technique === "single") {
      if (!hidden) return "Its row and column already hold every other number, so this cell must be " + x + ".";
      return x + " can only go here in this " + where(s.line) + ". The other free cells already have a " + x + " in their " + (s.line < p.n ? "column" : "row") + ".";
    }
    if (s.technique === "sign" || s.technique === "chain") {
      if (hidden) return x + " can only go here in this " + where(s.line) + ". The signs and the " + (s.line < p.n ? "columns" : "rows") + " rule it out everywhere else.";
      if (!s.bounds.length) return "Follow the signs around this cell along with its row and column, and only " + x + " is left.";
      return s.bounds.map(boundText).join(" ") + (s.usesLines ? " Its row and column rule out the rest, so it must be " + x + "." : " So it must be " + x + ".");
    }
    var end = !hidden ? "With the signs, that leaves only " + x + " for this cell." : "With the signs, that leaves this cell as the only place for " + x + " in its " + where(s.line) + ".";
    if (s.pairLine >= 0) {
      var two = F.Mask.values(s.pairMask);
      return "The two marked cells in this " + where(s.pairLine) + " can only hold " + two[0] + " and " + two[1] + ", so no other cell in the " + where(s.pairLine) + " can. " + end;
    }
    return "Pairs of cells that can only hold the same two numbers, together with the signs, leave " + (hidden ? "this cell as the only place for " + x + "." : "only " + x + " for this cell.");
  }

  function hint() {
    if (done) return;
    step = F.hint(p, v);
    if (!step) return;
    applyBtn.hidden = false;
    paint();
    say(hintText(step));
    if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "futoshiki-hint", event: true });
  }

  /* A board as SVG for printing: fixed numbers, signs, and the answer when [values] is the solution. */
  function boardSvg(pz, values) {
    var n = pz.n, C = 60, o = '<svg class="fsp-svg" viewBox="0 0 ' + n * C + " " + n * C + '" role="img" aria-label="Futoshiki board">';
    for (var i = 0; i < n * n; i++) {
      var x = (i % n) * C, y = Math.floor(i / n) * C, v = values[i];
      o += '<rect x="' + (x + 7) + '" y="' + (y + 7) + '" width="' + (C - 14) + '" height="' + (C - 14) + '" rx="6" class="' + (pz.givens[i] ? "g" : "") + '"/>';
      if (v) o += '<text x="' + (x + C / 2) + '" y="' + (y + C / 2 + 8) + '" class="' + (pz.givens[i] ? "g" : "a") + '">' + v + "</text>";
    }
    pz.signs.forEach(function (s) {
      var a = s[0], across = s[1] === a + 1, cx = across ? ((a % n) + 1) * C : (a % n) * C + C / 2, cy = across ? Math.floor(a / n) * C + C / 2 : (Math.floor(a / n) + 1) * C;
      var angle = across ? (s[2] === F.GREATER ? 0 : 180) : (s[2] === F.GREATER ? 90 : -90);
      o += '<path d="M-5-8 5 0-5 8" transform="translate(' + cx + " " + cy + ") rotate(" + angle + ')"/>';
    });
    return o + "</svg>";
  }

  function makeBoard(spec) {
    for (var tries = 0; tries < 400; tries++) {
      var pz = F.generate(spec, (Math.random() * 4294967296) >>> 0);
      if (pz && F.solve(pz, 2).length === 1) return pz;
    }
    return null;
  }

  // Printing a sheet: six new boards at this level, and their answers on a page of their own.
  var printRoot = document.createElement("div");
  printRoot.id = "fs-print-root";
  document.body.appendChild(printRoot);
  window.addEventListener("afterprint", function () { printRoot.innerHTML = ""; });

  function printSheet() {
    var boards = [];
    for (var k = 0; k < 6; k++) { var pz = makeBoard(LEVELS[level]); if (pz) boards.push(pz); }
    var name = LEVELS[level].name, sheet = "", key = "";
    boards.forEach(function (pz, k) {
      sheet += "<figure><figcaption>" + (k + 1) + "</figcaption>" + boardSvg(pz, pz.givens) + "</figure>";
      key += "<figure><figcaption>" + (k + 1) + "</figcaption>" + boardSvg(pz, pz.solution) + "</figure>";
    });
    printRoot.innerHTML = '<section class="fsp-page"><p class="fsp-title">Futoshiki, ' + name + ". Fill every row and column with 1 to " + LEVELS[level].size +
      ' once, and make every sign true.</p><div class="fsp-grid">' + sheet + '</div><p class="fsp-foot">www.manextapps.com/puzzles/futoshiki/</p></section>' +
      '<section class="fsp-page fsp-key"><p class="fsp-title">Answers</p><div class="fsp-grid">' + key + "</div></section>";
    window.print();
  }

  function newBoard() {
    root.classList.add("is-busy");
    setTimeout(function () {
      var spec = LEVELS[level], puzzle = null;
      for (var tries = 0; !puzzle && tries < 400; tries++) {
        puzzle = F.generate(spec, (Math.random() * 4294967296) >>> 0);
        if (puzzle && F.solve(puzzle, 2).length !== 1) puzzle = null;
      }
      root.classList.remove("is-busy");
      if (puzzle) load(puzzle);
    }, 20);
  }

  boardEl.addEventListener("click", function (e) {
    var el = e.target.closest("[data-i]");
    if (!el) return;
    cursor = Number(el.getAttribute("data-i"));
    paint();
    boardEl.focus({ preventScroll: true });
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
    var d = Number(e.key);
    if (e.key.length === 1 && d >= 1 && d <= n) { e.preventDefault(); put(cursor, d); }
    else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") { e.preventDefault(); put(cursor, 0); }
    else if (e.key.toLowerCase() === "n") { e.preventDefault(); toggleNotes(); }
  });

  function toggleNotes() {
    noting = !noting;
    notesBtn.setAttribute("aria-pressed", String(noting));
    root.classList.toggle("is-noting", noting);
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || root.classList.contains("is-busy")) return;
    if (b.hasAttribute("data-num")) put(cursor, Number(b.getAttribute("data-num")));
    else if (b.hasAttribute("data-level")) {
      level = b.getAttribute("data-level");
      opts();
      newBoard();
    } else if (b.hasAttribute("data-hint")) hint();
    else if (b.hasAttribute("data-apply")) {
      if (!step) return;
      history.push({ v: v.slice(), notes: notes.slice() });
      F.apply(v, step);
      notes[step.target] = 0;
      cursor = step.target;
      changed();
    } else if (b.hasAttribute("data-notes")) toggleNotes();
    else if (b.hasAttribute("data-undo")) {
      if (!history.length) return;
      var h = history.pop();
      v = h.v;
      notes = h.notes;
      done = false;
      root.classList.remove("is-solved");
      changed();
    } else if (b.hasAttribute("data-clear")) {
      if (!history.length) return;
      history.push({ v: v.slice(), notes: notes.slice() });
      v = p.givens.slice();
      notes = v.map(function () { return 0; });
      changed();
    } else if (b.hasAttribute("data-new")) newBoard();
    else if (b.hasAttribute("data-print")) printSheet();
  });

  function opts() {
    root.querySelectorAll("[data-level]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-level") === level)); });
    store("futoshiki:settings", { level: level });
  }

  var saved = store("futoshiki:settings");
  if (saved && LEVELS[saved.level]) level = saved.level;
  opts();
  if (level === "medium" && window.FS_START) load(F.decode(window.FS_START));
  else newBoard();
})();
