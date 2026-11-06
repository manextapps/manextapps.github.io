/* Two star logic for /puzzles/star-battle/: the deductions the hints explain, in the order they are tried.
   A cell is 0 open, 1 empty, 2 star. Works in browsers and in node (tools/star_build.js uses it to keep only
   boards these steps can finish); build.py checks every board with its own Python version. */
(function (root) {
  "use strict";
  var STARS = 2;

  function Board(n, regions) {
    this.n = n;
    this.regions = regions;
    var gs = [];
    for (var g = 0; g < n; g++) gs.push({ kind: "region", i: g, cells: cellsWhere(n, function (c) { return regions[c] === g; }) });
    for (var r = 0; r < n; r++) gs.push({ kind: "row", i: r, cells: cellsWhere(n, function (c) { return Math.floor(c / n) === r; }) });
    for (var k = 0; k < n; k++) gs.push({ kind: "column", i: k, cells: cellsWhere(n, function (c) { return c % n === k; }) });
    this.groups = gs;
  }
  function cellsWhere(n, f) { var a = []; for (var c = 0; c < n * n; c++) if (f(c)) a.push(c); return a; }
  Board.prototype.touch = function (a, b) {
    var n = this.n;
    return a !== b && Math.abs(Math.floor(a / n) - Math.floor(b / n)) <= 1 && Math.abs(a % n - b % n) <= 1;
  };
  Board.prototype.lineOf = function (kind, c) {
    return kind === "row" ? Math.floor(c / this.n) : kind === "column" ? c % this.n : this.regions[c];
  };

  function stars(st, cells) { var s = 0; cells.forEach(function (c) { if (st[c] === 2) s++; }); return s; }
  function open(st, cells) { return cells.filter(function (c) { return st[c] === 0; }); }

  /* Every way to put [need] more stars on the open cells of a group without two touching. */
  function placements(b, cells, need) {
    var out = [];
    (function go(start, pick) {
      if (pick.length === need) { out.push(pick.slice()); return; }
      for (var i = start; i < cells.length; i++) {
        if (pick.some(function (p) { return b.touch(p, cells[i]); })) continue;
        pick.push(cells[i]); go(i + 1, pick); pick.pop();
      }
    })(0, []);
    return out;
  }

  function combos(items, k) {
    var out = [];
    (function go(start, pick) {
      if (pick.length === k) { out.push(pick.slice()); return; }
      for (var i = start; i < items.length; i++) { pick.push(items[i]); go(i + 1, pick); pick.pop(); }
    })(0, []);
    return out;
  }

  /* The next deduction, or null when these steps are stuck. A step either places stars (and empties every
     cell touching them) or empties cells. */
  function nextStep(b, st) {
    var n = b.n, i, g;
    for (i = 0; i < b.groups.length; i++) {
      g = b.groups[i];
      var rest = open(st, g.cells);
      if (stars(st, g.cells) === STARS && rest.length) return { tech: "full", group: g, star: [], clear: rest };
    }
    for (i = 0; i < b.groups.length; i++) {
      g = b.groups[i];
      var need = STARS - stars(st, g.cells), op = open(st, g.cells);
      if (need <= 0) continue;
      var pl = placements(b, op, need);
      if (!pl.length) return { tech: "broken", group: g, star: [], clear: [] };
      var must = op.filter(function (c) { return pl.every(function (p) { return p.indexOf(c) >= 0; }); });
      if (must.length) {
        var clear = [];
        for (var c = 0; c < n * n; c++) if (st[c] === 0 && must.indexOf(c) < 0 && must.some(function (m) { return b.touch(m, c); })) clear.push(c);
        return { tech: "only", group: g, star: must, clear: clear, ways: pl.length };
      }
      var dead = op.filter(function (c) { return !pl.some(function (p) { return p.indexOf(c) >= 0; }); });
      var shadow = [];
      for (var x = 0; x < n * n; x++) {
        if (st[x] !== 0 || dead.indexOf(x) >= 0) continue;
        if (pl.every(function (p) { return p.indexOf(x) < 0 && p.some(function (s) { return b.touch(s, x); }); })) shadow.push(x);
      }
      if (dead.length || shadow.length) return { tech: dead.length ? "cramped" : "shadow", group: g, star: [], clear: dead.concat(shadow), ways: pl.length };
    }
    var pairs = [["region", "row"], ["region", "column"], ["row", "region"], ["column", "region"]];
    for (var k = 1; k <= 3; k++) {
      for (var q = 0; q < pairs.length; q++) {
        var kindA = pairs[q][0], kindB = pairs[q][1];
        var A = b.groups.filter(function (gr) { return gr.kind === kindA && open(st, gr.cells).length; });
        var sets = combos(A, k);
        for (var s = 0; s < sets.length; s++) {
          var set = sets[s], needA = 0, lines = [], inside = [];
          set.forEach(function (gr) {
            needA += STARS - stars(st, gr.cells);
            gr.cells.forEach(function (c) { inside.push(c); if (st[c] === 0 && lines.indexOf(b.lineOf(kindB, c)) < 0) lines.push(b.lineOf(kindB, c)); });
          });
          if (lines.length !== k) continue;
          var lineGroups = b.groups.filter(function (gr) { return gr.kind === kindB && lines.indexOf(gr.i) >= 0; });
          var needB = 0;
          lineGroups.forEach(function (gr) { needB += STARS - stars(st, gr.cells); });
          if (needA !== needB) continue;
          var cl = [];
          lineGroups.forEach(function (gr) { gr.cells.forEach(function (c) { if (st[c] === 0 && inside.indexOf(c) < 0) cl.push(c); }); });
          if (cl.length) return { tech: "confined", groups: set, lines: lineGroups, star: [], clear: cl };
        }
      }
    }
    return null;
  }

  function apply(st, step) {
    var out = st.slice();
    step.star.forEach(function (c) { out[c] = 2; });
    step.clear.forEach(function (c) { if (out[c] === 0) out[c] = 1; });
    return out;
  }

  /* Runs the steps from an empty board; [solved] is true when they place every star. */
  function solve(b) {
    var st = new Array(b.n * b.n).fill(0), steps = [], step;
    while ((step = nextStep(b, st)) && step.tech !== "broken") { steps.push(step); st = apply(st, step); }
    return { solved: st.filter(function (v) { return v === 2; }).length === STARS * b.n && st.indexOf(0) < 0, steps: steps, state: st };
  }

  var api = { Board: Board, nextStep: nextStep, apply: apply, solve: solve, placements: placements, STARS: STARS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.StarLogic = api;
})(this);
