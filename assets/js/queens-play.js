var QN_GUIDED={"n":6,"seed":12,"regions":[0,0,0,5,5,5,0,0,5,5,5,4,0,5,5,5,4,4,0,1,5,3,4,4,0,1,1,2,2,2,1,1,2,2,2,2],"solution":[0,2,5,3,1,4],"steps":[{"technique":"lastCell","group":"region","focus":[21],"crown":21,"clear":[]},{"technique":"regionInLine","group":"column","focus":[11,16,17,22,23],"crown":null,"clear":[5,29,35]},{"technique":"regionInLine","group":"row","focus":[27,28,29,32,33,34,35],"crown":null,"clear":[30,31]},{"technique":"lastCell","group":"region","focus":[19,25,26,30,31],"crown":25,"clear":[]},{"technique":"lastCell","group":"region","focus":[27,28,29,32,33,34,35],"crown":34,"clear":[]},{"technique":"lastCell","group":"region","focus":[3,4,5,8,9,10,13,14,15,20],"crown":8,"clear":[]},{"technique":"lastCell","group":"region","focus":[11,16,17,22,23],"crown":17,"clear":[]},{"technique":"lastCell","group":"region","focus":[0,1,2,6,7,12,18,24],"crown":0,"clear":[]}]};
/* Queens board on /puzzles/queens-puzzle/. Needs queens-engine.js (window.QueensEngine).
   Tap a cell: empty, X, queen, empty. Hint explains the next step in words before it changes anything. */
(function () {
  "use strict";
  var root = document.getElementById("qn");
  if (!root || !window.QueensEngine) return;
  var Q = window.QueensEngine;
  var boardEl = root.querySelector(".qn-board");
  var statusEl = root.querySelector(".qn-status");
  var hintEl = root.querySelector(".qn-hint");
  var titleEl = root.querySelector(".qn-title");
  var tabs = root.querySelectorAll("[data-size]");
  var SPECS = { 6: [6, 1, 3], 7: [7, 2, 3], 8: [8, 2, 4], 9: [9, 3, 6] };
  var CROWN = '<svg viewBox="0 0 32 24" aria-hidden="true"><path d="M3 20 1 5l8 6 7-10 7 10 8-6-2 15Z" fill="currentColor"/></svg>';
  var p, marks, history, pending, solved, guided;

  function letter(g) { return String.fromCharCode(65 + g); }
  function cellName(c) { return "row " + (p.row(c) + 1) + ", column " + (p.col(c) + 1); }
  function groupName(kind, cells) {
    var c = cells[0];
    if (kind === "region") return "region " + letter(p.regions[c]);
    if (kind === "row") return "row " + (p.row(c) + 1);
    return "column " + (p.col(c) + 1);
  }

  function explain(st) {
    if (st.kind === "wrongCrown") return "The queen on " + cellName(st.remove) + " isn't part of the answer. Take it off and look again.";
    if (st.kind === "wrongX") return "You crossed out " + cellName(st.crown) + ", but that's where region " + letter(p.regions[st.crown]) + "'s queen goes.";
    if (st.kind === "reveal") return "There's no simple step left from here, so here's one queen: " + cellName(st.crown) + ".";
    var g = groupName(st.group, st.focus);
    switch (st.technique) {
      case "lastCell": return "Only one cell of " + g + " can still hold a queen, so the queen goes on " + cellName(st.crown) + ".";
      case "regionInLine": return "Every open cell of region " + letter(p.regions[st.focus[0]]) + " is in one " + st.group +
        ". That " + st.group + " belongs to region " + letter(p.regions[st.focus[0]]) + ", so the other cells in it can't hold a queen.";
      case "lineInRegion": return "All the open cells of " + g + " are in region " + letter(p.regions[st.clear[0]]) +
        ". Its queen is that region's queen, so the rest of region " + letter(p.regions[st.clear[0]]) + " is out.";
      case "noRoom": return "A queen on any marked cell would rule out every open cell of " + g + ", which still needs a queen. So the marked cells are out.";
      case "regionsFillLines": return "Regions " + names(st.regions) + " fit inside " + st.group + "s " + nums(st.lines) +
        ". Those " + st.count + " " + st.group + "s hold the queens of those regions, so no other region can use them.";
      case "linesFillRegions": return st.group.charAt(0).toUpperCase() + st.group.slice(1) + "s " + nums(st.lines) + " only have open cells in regions " +
        names(st.regions) + ". Their queens are the queens of those regions, so the rest of those regions is out.";
      case "deadEnd": return "Imagine a queen on " + cellName(st.clear[0]) + ". Follow the forced moves and " + g + " ends up with no room at all. So that cell is out.";
    }
    return "";
  }
  function names(gs) { return join(gs.map(letter)); }
  function nums(ls) { return join(ls.map(function (v) { return String(v + 1); })); }
  function join(a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }

  function crowns() { var a = []; marks.forEach(function (m, c) { if (m === 2) a.push(c); }); return a; }
  function xs() { var a = []; marks.forEach(function (m, c) { if (m === 1) a.push(c); }); return a; }

  function conflicts() {
    var bad = {}, cr = crowns();
    cr.forEach(function (a) {
      cr.forEach(function (b) {
        if (a !== b && (p.row(a) === p.row(b) || p.col(a) === p.col(b) || p.regions[a] === p.regions[b] || p.touching(a, b))) bad[a] = bad[b] = true;
      });
    });
    return bad;
  }

  function draw() {
    var n = p.n, bad = conflicts(), html = "";
    boardEl.style.setProperty("--n", n);
    for (var c = 0; c < n * n; c++) {
      var g = p.regions[c], cls = "qn-cell r" + g;
      if (c % n < n - 1 && p.regions[c + 1] !== g) cls += " eR";
      if (c + n < n * n && p.regions[c + n] !== g) cls += " eB";
      if (bad[c]) cls += " bad";
      if (pending && pending.focus && pending.focus.indexOf(c) >= 0) cls += " focus";
      if (pending && pending.clear && pending.clear.indexOf(c) >= 0) cls += " will-x";
      if (pending && (pending.crown === c || pending.remove === c)) cls += " will-q";
      var mark = marks[c] === 2 ? CROWN : marks[c] === 1 ? '<span class="qn-x">&times;</span>' : "";
      var state = marks[c] === 2 ? "queen" : marks[c] === 1 ? "crossed out" : "empty";
      html += '<button type="button" class="' + cls + '" data-c="' + c + '" aria-label="Row ' + (p.row(c) + 1) + ", column " + (p.col(c) + 1) +
        ", region " + letter(g) + ", " + state + '"><span class="qn-l" aria-hidden="true">' + letter(g) + "</span>" + mark + "</button>";
    }
    boardEl.innerHTML = html;
    var placed = crowns().length;
    if (solved) statusEl.textContent = "Solved. Every row, column and region has one queen.";
    else if (Object.keys(bad).length) statusEl.textContent = "Two queens clash. The striped cells show where.";
    else statusEl.textContent = placed + " of " + n + " queens placed.";
  }

  function save() { history.push(marks.slice()); if (history.length > 200) history.shift(); }

  function check() {
    var cr = crowns();
    solved = cr.length === p.n && !Object.keys(conflicts()).length;
    if (solved) {
      root.classList.add("is-solved");
      hintEl.innerHTML = guided ? "That's the whole method: rule cells out, then place the queen that's left. Pick a size above for a new board." :
        "Nice. Pick a size above for another board.";
      if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "queens-solved-" + p.n, event: true });
    }
  }

  function tap(c) {
    if (solved) return;
    save();
    marks[c] = (marks[c] + 1) % 3;
    pending = null;
    hintEl.textContent = "";
    check();
    draw();
  }

  function hint() {
    if (solved) return;
    if (pending) {
      save();
      if (pending.remove != null) marks[pending.remove] = 0;
      if (pending.crown != null) marks[pending.crown] = 2;
      (pending.clear || []).forEach(function (c) { if (marks[c] === 0) marks[c] = 1; });
      if (pending.kind === "logic" && pending.crown != null) autoX(pending.crown);
      pending = null;
      hintEl.textContent = "Done. Tap Hint again for the next step, or try it yourself.";
      check();
      draw();
      return;
    }
    var st = Q.hint(p, crowns(), xs());
    if (!st) return;
    pending = st;
    hintEl.innerHTML = '<strong>' + label(st) + '</strong> ' + explain(st) + ' <span class="qn-again">Tap Hint again to make this move.</span>';
    if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "queens-hint", event: true });
    draw();
  }

  function autoX(c) {
    for (var o = 0; o < p.n * p.n; o++) if (o !== c && marks[o] === 0 && p.attacks(c, o)) marks[o] = 1;
  }

  function label(st) {
    var names = { lastCell: "Last cell.", regionInLine: "Region in one line.", lineInRegion: "Line in one region.", noRoom: "No room.",
      regionsFillLines: "Regions fill lines.", linesFillRegions: "Lines fill regions.", deadEnd: "Dead end." };
    if (st.kind === "logic") return names[st.technique] || "";
    return st.kind === "reveal" ? "One queen." : "Check this.";
  }

  function start(puzzle, isGuided, title) {
    p = puzzle; guided = isGuided;
    marks = new Array(p.n * p.n).fill(0);
    history = []; pending = null; solved = false;
    root.classList.remove("is-solved");
    titleEl.textContent = title;
    hintEl.textContent = isGuided ? "New to Queens? Tap Hint and I'll walk you through this board one step at a time." : "";
    draw();
  }

  function fresh(size) {
    var s = SPECS[size], seed = Math.floor(Math.random() * 1e9), pz = null;
    for (var k = 0; k < 6 && !pz; k++) pz = Q.generate(s[0], s[1], s[2], seed + k * 101, 60);
    if (!pz) { hintEl.textContent = "That board didn't come out right. Tap the size again for another one."; return; }
    start(pz, false, size + " by " + size + " board");
    tabs.forEach(function (t) { t.setAttribute("aria-pressed", String(+t.dataset.size === size)); });
  }

  boardEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-c]");
    if (b) tap(+b.dataset.c);
  });
  root.querySelector("[data-hint]").addEventListener("click", hint);
  root.querySelector("[data-undo]").addEventListener("click", function () {
    if (!history.length) return;
    marks = history.pop(); pending = null; solved = false; root.classList.remove("is-solved"); hintEl.textContent = ""; draw();
  });
  root.querySelector("[data-clear]").addEventListener("click", function () {
    save(); marks = marks.map(function () { return 0; }); pending = null; solved = false; root.classList.remove("is-solved"); hintEl.textContent = ""; draw();
  });
  tabs.forEach(function (t) { t.addEventListener("click", function () { fresh(+t.dataset.size); }); });

  var g = window.QN_GUIDED;
  start(new Q.Puzzle(g.n, g.regions, g.solution), true, "Start here: a 6 by 6 board");
  root.setAttribute("data-ready", "1");
})();
