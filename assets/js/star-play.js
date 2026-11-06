var STAR_BOARDS=[{"id":"8x8-1","n":8,"regions":[2,2,2,0,0,1,1,1,2,2,0,0,0,1,1,1,2,2,0,3,3,3,1,1,2,2,4,3,3,3,3,5,2,4,4,6,3,3,5,5,2,4,4,6,6,3,5,5,2,6,6,6,7,7,5,5,6,6,6,7,7,5,5,5]},{"id":"8x8-2","n":8,"regions":[0,0,0,1,2,2,2,3,0,0,1,1,1,2,3,3,0,0,0,1,1,2,3,3,4,0,0,5,5,2,3,3,4,4,4,5,5,5,3,7,6,4,6,5,5,5,5,7,6,6,6,5,5,7,7,7,6,7,7,7,7,7,7,7]},{"id":"8x8-3","n":8,"regions":[2,0,0,0,0,1,1,1,2,0,0,0,0,1,1,1,2,4,4,4,1,1,3,3,2,4,4,4,4,3,3,5,4,4,4,4,4,3,5,5,4,4,4,6,3,3,5,5,7,7,7,6,6,6,5,5,7,7,7,7,6,5,5,5]},{"id":"8x8-4","n":8,"regions":[2,2,0,0,0,1,1,1,2,2,0,0,0,1,1,1,2,2,2,3,3,1,1,1,2,2,4,3,3,3,5,5,2,2,4,3,5,5,5,5,6,6,4,3,5,7,7,5,6,6,4,4,4,7,7,7,6,6,6,4,4,7,7,7]},{"id":"10x10-1","n":10,"regions":[4,4,4,0,0,1,1,1,1,1,4,0,4,0,0,0,1,1,3,1,4,0,0,0,2,1,1,1,3,1,4,4,4,0,2,1,3,3,3,1,4,4,4,2,2,1,1,6,3,5,4,7,4,2,6,6,6,6,6,5,4,7,7,7,7,8,8,5,5,5,4,7,9,7,7,8,8,8,8,8,4,4,9,7,8,8,8,8,7,7,9,9,9,7,7,7,7,7,7,7]},{"id":"10x10-2","n":10,"regions":[0,2,2,2,2,2,2,1,1,1,0,0,4,2,4,2,2,6,1,1,0,3,4,4,4,2,6,6,6,1,0,3,4,4,4,4,6,5,1,1,0,3,4,4,4,4,6,5,5,5,0,3,4,4,4,4,6,5,7,5,0,0,8,9,4,4,6,6,7,5,8,8,8,9,6,6,6,6,7,5,8,9,9,9,9,9,9,6,7,5,8,8,8,9,9,9,9,6,6,5]},{"id":"10x10-3","n":10,"regions":[0,0,0,0,0,1,1,1,1,1,0,0,0,0,5,5,5,1,3,1,4,2,2,0,5,5,5,3,3,7,4,4,2,0,0,5,5,3,3,7,4,6,2,6,6,5,5,7,3,7,4,6,6,6,6,6,5,7,7,7,4,6,4,8,8,6,5,7,7,7,4,4,4,4,8,8,5,7,7,7,4,8,8,8,8,8,5,5,7,5,8,8,8,8,9,9,9,5,5,5]},{"id":"10x10-4","n":10,"regions":[0,0,1,1,1,1,1,1,1,8,0,0,1,1,1,2,1,1,2,8,0,1,1,1,1,2,2,2,2,8,0,1,1,1,3,3,3,4,8,8,5,5,5,1,3,3,3,4,4,8,5,5,9,3,3,6,6,6,4,8,5,7,9,9,3,3,6,6,8,8,7,7,9,9,3,3,6,9,9,8,7,7,7,9,9,3,3,9,9,8,9,9,9,9,9,9,9,9,8,8]}];
/* Two star board on /puzzles/star-battle/. STAR_BOARDS comes from build.py, which proved each board has one
   solution that the hint steps in star-logic.js (window.StarLogic) can reach. Tap a cell once for a dot, twice
   for a star. A board is solved by the rules, two stars in every row, column and region with none touching. */
(function () {
  "use strict";
  var root = document.getElementById("sb");
  var L = window.StarLogic, BOARDS = window.STAR_BOARDS;
  if (!root || !L || !BOARDS || !BOARDS.length) return;
  var boardEl = root.querySelector(".sb-board"), hintEl = root.querySelector(".sb-hint"), statusEl = root.querySelector(".sb-status");
  var titleEl = root.querySelector(".sb-title"), sizeBtns = root.querySelectorAll("[data-size]");
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z"/></svg>';
  var b, board, marks, history, solution, pending = null, solved = false, focusCell = 0, done = load();

  function load() { try { return JSON.parse(localStorage.getItem("star-solved") || "{}"); } catch (e) { return {}; } }
  function store() { try { localStorage.setItem("star-solved", JSON.stringify(done)); } catch (e) {} }
  function rc(c) { return "row " + (Math.floor(c / b.n) + 1) + ", column " + (c % b.n + 1); }
  function gname(kind, i) { return kind === "region" ? "region " + String.fromCharCode(65 + i) : kind + " " + (i + 1); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function bad() {
    var out = {}, st = marks;
    board.groups.forEach(function (g) {
      var s = g.cells.filter(function (c) { return st[c] === 2; });
      if (s.length > 2) s.forEach(function (c) { out[c] = 1; });
    });
    for (var a = 0; a < st.length; a++) if (st[a] === 2) for (var c = a + 1; c < st.length; c++) if (st[c] === 2 && board.touch(a, c)) { out[a] = 1; out[c] = 1; }
    return out;
  }

  function draw() {
    var n = b.n, conflicts = bad(), html = "", hiCells = {}, newStar = {}, newX = {};
    if (pending) {
      (pending.focus || []).forEach(function (c) { hiCells[c] = 1; });
      (pending.star || []).forEach(function (c) { newStar[c] = 1; });
      (pending.clear || []).forEach(function (c) { newX[c] = 1; });
    }
    for (var c = 0; c < n * n; c++) {
      var r = Math.floor(c / n), k = c % n, g = b.regions[c], m = marks[c];
      var cls = "sb-cell sb-r" + (g % 10);
      if (k < n - 1 && b.regions[c + 1] !== g) cls += " eR";
      if (r < n - 1 && b.regions[c + n] !== g) cls += " eB";
      if (conflicts[c]) cls += " sb-bad";
      if (hiCells[c]) cls += " sb-focus";
      if (newStar[c]) cls += " sb-new";
      if (newX[c] && m === 0) cls += " sb-newx";
      var inner = m === 2 ? STAR : m === 1 ? '<span class="sb-dot"></span>' : newX[c] ? '<span class="sb-x"></span>' : "";
      var lab = (k === 0 && r === 0) || b.regions.indexOf(g) === c ? '<span class="sb-l">' + String.fromCharCode(65 + g) + "</span>" : "";
      html += '<button type="button" class="' + cls + '" data-c="' + c + '" tabindex="' + (c === focusCell ? 0 : -1) + '" aria-label="' + rc(c) + ", region " +
        String.fromCharCode(65 + g) + (m === 2 ? ", star" : m === 1 ? ", dot" : "") + '">' + lab + inner + "</button>";
    }
    boardEl.style.setProperty("--n", n);
    boardEl.innerHTML = html;
    var count = marks.filter(function (v) { return v === 2; }).length;
    statusEl.textContent = solved ? "Solved. Every row, column and region has two stars." : count + " of " + 2 * n + " stars placed";
  }

  function checkSolved() {
    var ok = Object.keys(bad()).length === 0 && board.groups.every(function (g) { return g.cells.filter(function (c) { return marks[c] === 2; }).length === 2; });
    if (ok && !solved) {
      solved = true; done[b.id] = 1; store(); root.classList.add("is-solved");
      hintEl.textContent = "Solved! Try the next board, or a bigger size.";
    }
  }

  function save() { history.push(marks.slice()); if (history.length > 300) history.shift(); }

  function tap(c) {
    if (solved) return;
    save();
    marks[c] = (marks[c] + 1) % 3;
    pending = null; hintEl.textContent = "";
    focusCell = c;
    draw(); checkSolved(); draw();
    var el = boardEl.querySelector('[data-c="' + c + '"]');
    if (el) el.focus();
  }

  function explain(s) {
    if (s.tech === "confined") {
      var names = s.groups.map(function (g) { return gname(g.kind, g.i); }), where = s.lines.map(function (g) { return gname(g.kind, g.i); });
      return "The open cells of " + names.join(" and ") + " all sit in " + where.join(" and ") + ". Those need " + 2 * names.length +
        " stars between them, and so do the " + (where.length > 1 ? s.lines[0].kind + "s" : s.lines[0].kind) + ", so the other cells there are empty.";
    }
    var name = cap(gname(s.group.kind, s.group.i)), need = 2 - s.group.cells.filter(function (c) { return marks[c] === 2; }).length, w = need === 1 ? "star" : "stars";
    if (s.tech === "full") return name + " already has its two stars, so its other cells are empty.";
    if (s.tech === "only") return name + " needs " + need + " more " + w + (s.ways === 1 ? ", and there's only one way to fit " + (need === 1 ? "it" : "them") + " without two touching." :
      ". There are " + s.ways + " ways to fit " + (need === 1 ? "it" : "them") + " without two touching, and every one uses the green cell" + (s.star.length > 1 ? "s" : "") + ".") +
      " Put the star in, and the cells around it are empty.";
    if (s.tech === "cramped") return name + " needs " + need + " more " + w + ". None of its " + s.ways + " possible ways uses the marked cells, so they're empty.";
    return name + " needs " + need + " more " + w + ". Whichever of its " + s.ways + " ways you pick, a star lands next to each marked cell, so those are empty.";
  }

  function hint() {
    if (solved) return;
    if (pending) {
      save();
      pending.star.forEach(function (c) { marks[c] = 2; });
      pending.clear.forEach(function (c) { if (marks[c] === 0) marks[c] = 1; });
      pending = null; hintEl.textContent = "";
      draw(); checkSolved(); draw();
      return;
    }
    var wrong = [];
    marks.forEach(function (m, c) { if ((m === 2 && solution[c] !== 2) || (m === 1 && solution[c] === 2)) wrong.push(c); });
    if (wrong.length) {
      hintEl.textContent = "Something's off at " + rc(wrong[0]) + (wrong.length > 1 ? " and " + (wrong.length - 1) + " more" : "") + ". Undo back to before it, or clear the cell.";
      draw();
      boardEl.querySelectorAll(wrong.map(function (c) { return '[data-c="' + c + '"]'; }).join(",")).forEach(function (el) { el.classList.add("sb-bad"); });
      return;
    }
    var st = marks.slice(), s;
    // Fill in what the stars already rule out, so the hint is about a real next step.
    while ((s = L.nextStep(board, st)) && s.tech === "full") st = L.apply(st, s);
    for (var a = 0; a < st.length; a++) if (st[a] === 2) for (var c2 = 0; c2 < st.length; c2++) if (st[c2] === 0 && board.touch(a, c2)) st[c2] = 1;
    s = L.nextStep(board, st);
    if (!s) { hintEl.textContent = "Every cell is decided. Check the board."; return; }
    var focus = s.tech === "confined" ? [].concat.apply([], s.groups.map(function (g) { return g.cells; })) : s.group.cells;
    var clear = s.clear.slice();
    for (var x = 0; x < marks.length; x++) if (marks[x] === 0 && st[x] === 1 && clear.indexOf(x) < 0) clear.push(x);
    pending = { focus: focus, star: s.star, clear: clear };
    hintEl.innerHTML = explain(s) + ' <span class="sb-again">Press Hint again to fill it in.</span>';
    draw();
  }

  function start(i) {
    b = BOARDS[i];
    board = new L.Board(b.n, b.regions);
    solution = L.solve(board).state;
    marks = new Array(b.n * b.n).fill(0);
    history = []; pending = null; solved = false; focusCell = 0;
    root.classList.remove("is-solved"); hintEl.textContent = "";
    var same = BOARDS.filter(function (x) { return x.n === b.n; });
    titleEl.textContent = b.n + "×" + b.n + ", board " + (same.indexOf(b) + 1) + " of " + same.length + (done[b.id] ? " (solved before)" : "");
    sizeBtns.forEach(function (btn) { btn.setAttribute("aria-pressed", String(+btn.getAttribute("data-size") === b.n)); });
    draw();
  }
  var index = 0;

  boardEl.addEventListener("click", function (e) { var el = e.target.closest("[data-c]"); if (el) tap(+el.getAttribute("data-c")); });
  boardEl.addEventListener("keydown", function (e) {
    var el = e.target.closest("[data-c]");
    if (!el) return;
    var c = +el.getAttribute("data-c"), n = b.n, to = { ArrowLeft: c % n ? c - 1 : c, ArrowRight: c % n < n - 1 ? c + 1 : c, ArrowUp: c >= n ? c - n : c, ArrowDown: c < n * n - n ? c + n : c }[e.key];
    if (to == null) return;
    e.preventDefault();
    focusCell = to; draw();
    boardEl.querySelector('[data-c="' + to + '"]').focus();
  });
  root.querySelector("[data-hint]").addEventListener("click", hint);
  root.querySelector("[data-undo]").addEventListener("click", function () {
    if (!history.length) return;
    marks = history.pop(); pending = null; solved = false; root.classList.remove("is-solved"); hintEl.textContent = ""; draw();
  });
  root.querySelector("[data-clear]").addEventListener("click", function () { save(); start(index); });
  root.querySelector("[data-next]").addEventListener("click", function () {
    var n = b.n, same = BOARDS.map(function (x, i) { return i; }).filter(function (i) { return BOARDS[i].n === n; });
    index = same[(same.indexOf(index) + 1) % same.length]; start(index);
  });
  sizeBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var n = +btn.getAttribute("data-size");
      for (var i = 0; i < BOARDS.length; i++) if (BOARDS[i].n === n) { index = i; break; }
      start(index);
    });
  });
  start(0);
  root.setAttribute("data-ready", "1");
})();
