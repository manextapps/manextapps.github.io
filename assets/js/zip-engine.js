/* Zip number path engine, ported from the Zip Puzzle Android app (engine/Grid, HamiltonianPath, Solver, PuzzleGenerator).
   A board is a path through every cell; numbers are added until exactly one path fits. Works in browsers and in node. */
(function (root) {
  "use strict";

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function wallKey(a, b) { return a < b ? a + ":" + b : b + ":" + a; }

  function Grid(n, walls) {
    this.n = n;
    this.cells = n * n;
    var set = {};
    (walls || []).forEach(function (w) { set[wallKey(w[0], w[1])] = true; });
    this.walls = set;
    this.nb = [];
    for (var c = 0; c < this.cells; c++) {
      var r = Math.floor(c / n), col = c % n, list = [];
      if (r > 0) list.push(c - n);
      if (col < n - 1) list.push(c + 1);
      if (r < n - 1) list.push(c + n);
      if (col > 0) list.push(c - 1);
      this.nb.push(list.filter(function (o) { return !set[wallKey(c, o)]; }));
    }
  }
  Grid.prototype.adjacent = function (a, b) { return this.nb[a].indexOf(b) >= 0; };
  Grid.prototype.wall = function (a, b) { return !!this.walls[wallKey(a, b)]; };

  function allEdges(n) {
    var out = [];
    for (var c = 0; c < n * n; c++) {
      if (c % n < n - 1) out.push([c, c + 1]);
      if (Math.floor(c / n) < n - 1) out.push([c, c + n]);
    }
    return out;
  }

  function serpentine(n) {
    var p = [];
    for (var r = 0; r < n; r++) for (var i = 0; i < n; i++) p.push(r * n + (r % 2 === 0 ? i : n - 1 - i));
    return p;
  }

  // Backbite Markov chain from a serpentine start; enough steps mix it well away from the serpentine shape.
  function randomPath(grid, rand) {
    var path = serpentine(grid.n), pos = [], last = path.length - 1, steps = grid.cells * grid.cells * 4;
    path.forEach(function (c, i) { pos[c] = i; });
    function reverse(i, j) {
      while (i < j) {
        var a = path[i], b = path[j];
        path[i] = b; path[j] = a; pos[b] = i; pos[a] = j; i++; j--;
      }
    }
    for (var s = 0; s < steps; s++) {
      var fromStart = rand() < 0.5;
      var end = fromStart ? path[0] : path[last], beside = fromStart ? path[1] : path[last - 1];
      var opts = grid.nb[end].filter(function (o) { return o !== beside; });
      if (!opts.length) continue;
      var idx = pos[opts[Math.floor(rand() * opts.length)]];
      // Joining the end to the target makes a loop; cutting the edge next to the target keeps one path.
      if (fromStart) reverse(0, idx - 1); else reverse(idx + 1, last);
    }
    return rand() < 0.5 ? path : path.reverse();
  }

  // Paths from the first number through every number in order and every cell, ending on the last number.
  // Stops at `limit` solutions or when the node budget runs out (then complete is false, never a guess).
  function search(grid, numbers, limit, maxNodes) {
    var N = grid.cells, idx = new Int32Array(N).fill(-1), end = numbers[numbers.length - 1];
    numbers.forEach(function (c, i) { idx[c] = i; });
    var visited = new Uint8Array(N), path = new Int32Array(N), seen = new Uint8Array(N), queue = new Int32Array(N);
    var sols = [], nodes = maxNodes;

    function reachesAll(head, remaining) {
      seen.fill(0);
      var w = 0, r = 0, reached = 0, nb = grid.nb[head];
      for (var i = 0; i < nb.length; i++) if (!visited[nb[i]] && !seen[nb[i]]) { seen[nb[i]] = 1; queue[w++] = nb[i]; }
      while (r < w) {
        var c = queue[r++];
        reached++;
        var cn = grid.nb[c];
        for (var j = 0; j < cn.length; j++) if (!visited[cn[j]] && !seen[cn[j]]) { seen[cn[j]] = 1; queue[w++] = cn[j]; }
      }
      return reached === remaining;
    }

    function solvable(head, remaining) {
      if (remaining === 0) return true;
      for (var c = 0; c < N; c++) {
        if (visited[c]) continue;
        var deg = 0, nb = grid.nb[c];
        for (var i = 0; i < nb.length; i++) if (!visited[nb[i]] || nb[i] === head) deg++;
        // Every free cell is entered and left, except the final cell which is only entered.
        if (deg < (c === end ? 1 : 2)) return false;
      }
      return reachesAll(head, remaining);
    }

    function extend(head, len, next) {
      if (--nodes <= 0) return;
      if (len === N) {
        if (head === end && next === numbers.length) sols.push(Array.prototype.slice.call(path));
        return;
      }
      var nb = grid.nb[head];
      for (var i = 0; i < nb.length; i++) {
        var c = nb[i];
        if (visited[c]) continue;
        var k = idx[c];
        if (k >= 0 && k !== next) continue;
        if (c === end && len + 1 !== N) continue;
        visited[c] = 1;
        path[len] = c;
        if (solvable(c, N - len - 1)) extend(c, len + 1, k >= 0 ? next + 1 : next);
        visited[c] = 0;
        if (sols.length >= limit || nodes <= 0) return;
      }
    }

    visited[numbers[0]] = 1;
    path[0] = numbers[0];
    extend(numbers[0], 1, 1);
    return { solutions: sols, complete: nodes > 0 || sols.length >= limit };
  }

  var BUDGET = 50000;

  function Puzzle(n, numbers, solution, walls) {
    this.n = n;
    this.numbers = numbers;
    this.solution = solution;
    this.walls = walls || [];
    this.grid = new Grid(n, this.walls);
    this.numberAt = {};
    for (var i = 0; i < numbers.length; i++) this.numberAt[numbers[i]] = i + 1;
  }

  function unique(p, budget) {
    var r = search(p.grid, p.numbers, 2, budget || BUDGET);
    return r.complete && r.solutions.length === 1 && r.solutions[0].join() === p.solution.join();
  }

  // difficulty: 0 easy (extra numbers), 1 medium (a few extra, walls from 7x7), 2 hard (minimal numbers, walls).
  function generate(n, difficulty, seed, budget) {
    budget = budget || BUDGET;
    var rand = rng((seed * 31 + n * 7 + difficulty) >>> 0);
    var grid0 = new Grid(n), path = randomPath(grid0, rand), cells = n * n, last = cells - 1;
    var count = difficulty === 0 ? 0 : difficulty === 1 ? (n >= 7 ? Math.floor(n / 3) : 0) : n - 1;
    var walls = [];
    if (count) {
      var used = {};
      for (var i = 0; i + 1 < path.length; i++) used[wallKey(path[i], path[i + 1])] = true;
      var free = allEdges(n).filter(function (e) { return !used[wallKey(e[0], e[1])]; });
      for (var j = free.length - 1; j > 0; j--) { var k = Math.floor(rand() * (j + 1)), t = free[j]; free[j] = free[k]; free[k] = t; }
      walls = free.slice(0, count).sort(function (a, b) { return a[0] * 1000 + a[1] - (b[0] * 1000 + b[1]); });
    }
    var grid = new Grid(n, walls), positions = [0, last];

    function solveWith(pos) {
      var sorted = pos.slice().sort(function (a, b) { return a - b; });
      return search(grid, sorted.map(function (x) { return path[x]; }), 2, budget);
    }
    function widestGapMiddle(pos) {
      var s = pos.slice().sort(function (a, b) { return a - b; }), best = 0, at = 0;
      for (var i = 0; i + 1 < s.length; i++) if (s[i + 1] - s[i] > best) { best = s[i + 1] - s[i]; at = i; }
      return Math.floor((s[at] + s[at + 1]) / 2);
    }

    for (;;) {
      var r = solveWith(positions);
      if (r.complete && r.solutions.length === 1) break;
      var open = [];
      for (var x = 1; x < last; x++) if (positions.indexOf(x) < 0) open.push(x);
      if (!open.length) break;
      var alt = null;
      for (var s = 0; s < r.solutions.length; s++) if (r.solutions[s].join() !== path.join()) { alt = r.solutions[s]; break; }
      if (!alt) { positions.push(widestGapMiddle(positions)); continue; }
      var cands = open.filter(function (x) { return path[x] !== alt[x]; });
      if (!cands.length) cands = open;
      positions.push(cands[Math.floor(rand() * cands.length)]);
    }

    var inner = positions.filter(function (x) { return x !== 0 && x !== last; });
    for (var m = inner.length - 1; m > 0; m--) { var q = Math.floor(rand() * (m + 1)), tt = inner[m]; inner[m] = inner[q]; inner[q] = tt; }
    inner.forEach(function (x) {
      var without = positions.filter(function (y) { return y !== x; });
      var res = solveWith(without);
      if (res.complete && res.solutions.length === 1) positions = without;
    });

    var extra = difficulty === 0 ? Math.round(cells * 0.14) : difficulty === 1 ? Math.round(cells * 0.05) : 0;
    var target = Math.min(cells, positions.length + extra);
    while (positions.length < target) positions.push(widestGapMiddle(positions));
    positions.sort(function (a, b) { return a - b; });
    return new Puzzle(n, positions.map(function (x) { return path[x]; }), path, walls);
  }

  function isSolution(p, path) {
    var N = p.n * p.n;
    if (path.length !== N) return false;
    var seen = {}, k = 0;
    for (var i = 0; i < N; i++) {
      var c = path[i];
      if (seen[c] || c < 0 || c >= N) return false;
      seen[c] = true;
      if (i > 0 && !p.grid.adjacent(path[i - 1], c)) return false;
      if (p.numberAt[c]) { if (p.numberAt[c] !== k + 1) return false; k++; }
    }
    return path[0] === p.numbers[0] && path[N - 1] === p.numbers[p.numbers.length - 1] && k === p.numbers.length;
  }

  // Keeps the correct start of the player's path and adds the answer up to the next number, at most 6 new cells.
  function hint(p, path) {
    var sol = p.solution, correct = 0;
    while (correct < path.length && path[correct] === sol[correct]) correct++;
    if (correct === sol.length) return null;
    var from = Math.max(correct, 1), next = from;
    while (next < sol.length && !p.numberAt[sol[next]]) next++;
    var end = Math.min(next, correct + 5);
    return { kept: correct, path: sol.slice(0, end + 1) };
  }

  var api = { Grid: Grid, Puzzle: Puzzle, search: search, unique: unique, generate: generate, isSolution: isSolution, hint: hint, BUDGET: BUDGET };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ZipEngine = api;
})(this);
