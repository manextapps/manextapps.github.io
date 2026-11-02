/* Queens engine, ported from the Queens Game Android app (engine/Puzzle, Solver, Logic, Generator).
   Boards always have exactly one solution that logic alone reaches. Works in browsers and in node. */
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

  function shuffled(arr, rand) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }

  function Puzzle(n, regions, solution, level, score) {
    this.n = n;
    this.regions = regions;
    this.solution = solution;
    this.level = level || 0;
    this.score = score || 0;
    var rc = [];
    for (var g = 0; g < n; g++) rc.push([]);
    for (var c = 0; c < n * n; c++) rc[regions[c]].push(c);
    this.regionCells = rc;
    var groups = [];
    rc.forEach(function (cells) { groups.push({ kind: "region", cells: cells }); });
    for (var r = 0; r < n; r++) groups.push({ kind: "row", cells: range(n).map(function (k) { return r * n + k; }) });
    for (var k = 0; k < n; k++) groups.push({ kind: "column", cells: range(n).map(function (r2) { return r2 * n + k; }) });
    this.groups = groups;
  }
  Puzzle.prototype.row = function (c) { return Math.floor(c / this.n); };
  Puzzle.prototype.col = function (c) { return c % this.n; };
  Puzzle.prototype.isCrownCell = function (c) { return this.solution[this.row(c)] === this.col(c); };
  Puzzle.prototype.touching = function (a, b) {
    return a !== b && Math.abs(this.row(a) - this.row(b)) <= 1 && Math.abs(this.col(a) - this.col(b)) <= 1;
  };
  Puzzle.prototype.attacks = function (a, b) {
    return this.row(a) === this.row(b) || this.col(a) === this.col(b) ||
      this.regions[a] === this.regions[b] || this.touching(a, b);
  };

  /* ---------- exhaustive solver, stops after `limit` solutions ---------- */
  function solve(n, regions, limit) {
    limit = limit || 2;
    var found = [], cols = new Array(n), masks = new Array(n * n).fill(0);
    for (var cell = 0; cell < regions.length; cell++) {
      var idx = regions[cell] * n + Math.floor(cell / n);
      masks[idx] |= 1 << (cell % n);
    }
    function fits(fromRow, usedCols, usedRegions) {
      var free = ~usedCols;
      for (var g = 0; g < n; g++) {
        if (usedRegions & (1 << g)) continue;
        var ok = false;
        for (var r = fromRow; r < n; r++) if (masks[g * n + r] & free) { ok = true; break; }
        if (!ok) return false;
      }
      return true;
    }
    function run(row, usedCols, usedRegions, prev) {
      if (found.length >= limit) return;
      if (row === n) { found.push(cols.slice()); return; }
      for (var c = 0; c < n; c++) {
        if (usedCols & (1 << c)) continue;
        if (c >= prev - 1 && c <= prev + 1) continue;
        var g = regions[row * n + c];
        if (usedRegions & (1 << g)) continue;
        var nc = usedCols | (1 << c), nr = usedRegions | (1 << g);
        if (!fits(row + 1, nc, nr)) continue;
        cols[row] = c;
        run(row + 1, nc, nr, c);
        if (found.length >= limit) return;
      }
    }
    run(0, 0, 0, -10);
    return found;
  }

  /* ---------- human style logic ---------- */
  var LEVEL = { lastCell: 1, regionInLine: 2, lineInRegion: 2, noRoom: 3, regionsFillLines: 4, linesFillRegions: 4, deadEnd: 6 };
  var WEIGHT = [0, 1, 2, 3, 5, 8, 13, 20];

  function State(p, open, crown) {
    this.p = p;
    this.open = open || new Array(p.n * p.n).fill(true);
    this.crown = crown || new Array(p.n * p.n).fill(false);
  }
  State.prototype.copy = function () { return new State(this.p, this.open.slice(), this.crown.slice()); };
  State.prototype.placeCrown = function (cell) {
    this.crown[cell] = true;
    this.open[cell] = false;
    for (var o = 0; o < this.open.length; o++) if (o !== cell && this.open[o] && this.p.attacks(cell, o)) this.open[o] = false;
  };
  State.prototype.apply = function (step) {
    if (step.crown != null) this.placeCrown(step.crown);
    var s = this;
    step.clear.forEach(function (c) { s.open[c] = false; });
  };
  State.prototype.complete = function () { return this.crown.filter(Boolean).length === this.p.n; };

  function stepLevel(st) {
    if (st.technique === "regionsFillLines" || st.technique === "linesFillRegions") return st.count >= 3 ? 5 : 4;
    return st.technique ? LEVEL[st.technique] : 7;
  }
  function mk(technique, group, focus, crown, clear, count) {
    var st = { kind: "logic", technique: technique, group: group, count: count || 1, focus: focus, crown: crown == null ? null : crown, clear: clear || [] };
    st.level = stepLevel(st);
    return st;
  }
  function openOf(s, cells) { return cells.filter(function (c) { return s.open[c]; }); }
  function hasCrown(s, cells) { return cells.some(function (c) { return s.crown[c]; }); }
  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }

  function lastCell(s) {
    var gs = s.p.groups;
    for (var i = 0; i < gs.length; i++) {
      if (hasCrown(s, gs[i].cells)) continue;
      var o = openOf(s, gs[i].cells);
      if (o.length === 1) return mk("lastCell", gs[i].kind, gs[i].cells, o[0]);
    }
    return null;
  }

  function confinement(s) {
    var p = s.p, n = p.n, i, cells, o, clear;
    for (i = 0; i < n; i++) {
      cells = p.regionCells[i];
      if (hasCrown(s, cells)) continue;
      o = openOf(s, cells);
      if (!o.length) continue;
      var rows = uniq(o.map(function (c) { return p.row(c); }));
      if (rows.length === 1) {
        clear = range(n).map(function (k) { return rows[0] * n + k; }).filter(function (c) { return s.open[c] && o.indexOf(c) < 0; });
        if (clear.length) return mk("regionInLine", "row", cells, null, clear);
      }
      var cs = uniq(o.map(function (c) { return p.col(c); }));
      if (cs.length === 1) {
        clear = range(n).map(function (r) { return r * n + cs[0]; }).filter(function (c) { return s.open[c] && o.indexOf(c) < 0; });
        if (clear.length) return mk("regionInLine", "column", cells, null, clear);
      }
    }
    for (i = 0; i < p.groups.length; i++) {
      var g = p.groups[i];
      if (g.kind === "region" || hasCrown(s, g.cells)) continue;
      o = openOf(s, g.cells);
      if (!o.length) continue;
      var regs = uniq(o.map(function (c) { return p.regions[c]; }));
      if (regs.length === 1) {
        clear = p.regionCells[regs[0]].filter(function (c) { return s.open[c] && g.cells.indexOf(c) < 0; });
        if (clear.length) return mk("lineInRegion", g.kind, g.cells, null, clear);
      }
    }
    return null;
  }

  function noRoom(s) {
    var p = s.p, best = null, bestOpen = Infinity;
    p.groups.forEach(function (g) {
      if (hasCrown(s, g.cells)) return;
      var o = openOf(s, g.cells);
      if (!o.length || o.length >= bestOpen) return;
      var killers = [];
      for (var c = 0; c < p.n * p.n; c++) {
        if (s.open[c] && o.indexOf(c) < 0 && o.every(function (x) { return p.attacks(c, x); })) killers.push(c);
      }
      if (killers.length) { best = mk("noRoom", g.kind, g.cells, null, killers); bestOpen = o.length; }
    });
    return best;
  }

  function combos(items, k) {
    var out = [];
    if (k > items.length || k <= 0) return out;
    var idx = range(k);
    for (;;) {
      out.push(idx.map(function (i) { return items[i]; }));
      var i = k - 1;
      while (i >= 0 && idx[i] === items.length - k + i) i--;
      if (i < 0) break;
      idx[i]++;
      for (var j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
    }
    return out;
  }

  function sets(s, k) {
    var p = s.p, n = p.n;
    var openRegions = range(n).filter(function (g) { return !hasCrown(s, p.regionCells[g]); });
    var rows = range(n).map(function (r) { return range(n).map(function (c) { return r * n + c; }); });
    var cols = range(n).map(function (c) { return range(n).map(function (r) { return r * n + c; }); });
    var kinds = ["row", "column"];
    for (var t = 0; t < 2; t++) {
      var kind = kinds[t];
      var lineOf = kind === "row" ? function (c) { return p.row(c); } : function (c) { return p.col(c); };
      var lines = kind === "row" ? rows : cols;
      var cr = combos(openRegions, k), i, combo, inside, used, clear;
      for (i = 0; i < cr.length; i++) {
        combo = cr[i];
        inside = [];
        combo.forEach(function (g) { inside = inside.concat(openOf(s, p.regionCells[g])); });
        used = uniq(inside.map(lineOf));
        if (used.length !== k) continue;
        clear = [];
        used.forEach(function (l) { lines[l].forEach(function (c) { if (s.open[c] && combo.indexOf(p.regions[c]) < 0) clear.push(c); }); });
        if (clear.length) {
          var focus = [];
          combo.forEach(function (g) { focus = focus.concat(p.regionCells[g]); });
          var st1 = mk("regionsFillLines", kind, focus, null, clear, k);
          st1.lines = used.slice().sort(function (a, b) { return a - b; }); st1.regions = combo.slice();
          return st1;
        }
      }
      var openLines = range(n).filter(function (l) { return !hasCrown(s, lines[l]); });
      var cl = combos(openLines, k);
      for (i = 0; i < cl.length; i++) {
        combo = cl[i];
        inside = [];
        combo.forEach(function (l) { inside = inside.concat(openOf(s, lines[l])); });
        used = uniq(inside.map(function (c) { return p.regions[c]; }));
        if (used.length !== k) continue;
        clear = [];
        used.forEach(function (g) { p.regionCells[g].forEach(function (c) { if (s.open[c] && combo.indexOf(lineOf(c)) < 0) clear.push(c); }); });
        if (clear.length) {
          var f2 = [];
          combo.forEach(function (l) { f2 = f2.concat(lines[l]); });
          var st2 = mk("linesFillRegions", kind, f2, null, clear, k);
          st2.lines = combo.slice(); st2.regions = used.slice().sort(function (a, b) { return a - b; });
          return st2;
        }
      }
    }
    return null;
  }

  function deadEnd(s) {
    var p = s.p, best = null, bestDepth = Infinity;
    for (var c = 0; c < p.n * p.n; c++) {
      if (!s.open[c]) continue;
      var trial = s.copy();
      trial.placeCrown(c);
      var depth = 0;
      while (depth < bestDepth) {
        var empty = null;
        for (var i = 0; i < p.groups.length; i++) {
          var g = p.groups[i];
          if (!hasCrown(trial, g.cells) && !g.cells.some(function (x) { return trial.open[x]; })) { empty = g; break; }
        }
        if (empty) { best = mk("deadEnd", empty.kind, empty.cells, null, [c]); best.trial = c; bestDepth = depth; break; }
        var st = lastCell(trial) || confinement(trial);
        if (!st) break;
        trial.apply(st);
        depth++;
      }
    }
    return best;
  }

  function next(s, maxLevel) {
    if (maxLevel == null) maxLevel = 6;
    var st = lastCell(s);
    if (st) return st;
    if (maxLevel >= 2 && (st = confinement(s))) return st;
    if (maxLevel >= 3 && (st = noRoom(s))) return st;
    if (maxLevel >= 4 && (st = sets(s, 2))) return st;
    if (maxLevel >= 5) for (var k = 3; k <= Math.floor(s.p.n / 2); k++) if ((st = sets(s, k))) return st;
    if (maxLevel >= 6 && (st = deadEnd(s))) return st;
    return null;
  }

  function contradiction(s) {
    return s.p.groups.some(function (g) { return !hasCrown(s, g.cells) && !g.cells.some(function (c) { return s.open[c]; }); });
  }

  function grade(p, maxLevel) {
    var s = new State(p), top = 0, score = 0, steps = [];
    while (!s.complete()) {
      if (contradiction(s)) return { solved: false, maxLevel: top, score: score, steps: steps };
      var st = next(s, maxLevel);
      if (!st) return { solved: false, maxLevel: top, score: score, steps: steps };
      if (st.crown != null && !p.isCrownCell(st.crown)) throw new Error("logic placed a wrong crown");
      if (st.clear.some(function (c) { return p.isCrownCell(c); })) throw new Error("logic cleared a crown cell");
      s.apply(st);
      top = Math.max(top, st.level);
      score += WEIGHT[st.level];
      steps.push(st);
    }
    return { solved: true, maxLevel: top, score: score, steps: steps };
  }

  /* Next hint for a player's board: a wrong crown first, a crown cell marked X, then the simplest logic step. */
  function hint(p, crowns, xs) {
    var wrong = crowns.filter(function (c) { return !p.isCrownCell(c); })[0];
    if (wrong != null) return { kind: "wrongCrown", focus: [wrong], remove: wrong, clear: [] };
    var hidden = xs.filter(function (c) { return p.isCrownCell(c); })[0];
    if (hidden != null) return { kind: "wrongX", focus: p.regionCells[p.regions[hidden]], crown: hidden, clear: [] };
    var s = new State(p);
    crowns.forEach(function (c) { s.placeCrown(c); });
    xs.forEach(function (c) { s.open[c] = false; });
    var st = next(s);
    if (st) return st;
    for (var r = 0; r < p.n; r++) {
      var cell = r * p.n + p.solution[r];
      if (crowns.indexOf(cell) < 0) return { kind: "reveal", focus: [cell], crown: cell, clear: [] };
    }
    return null;
  }

  /* ---------- generator ---------- */
  function balanced(n, regions) {
    var sizes = new Array(n).fill(0);
    regions.forEach(function (g) { sizes[g]++; });
    var cap = Math.ceil(n * n * (n <= 6 ? 0.36 : 0.28));
    return Math.max.apply(null, sizes) <= cap && sizes.filter(function (x) { return x === 1; }).length <= 1;
  }

  function placeCrowns(n, rand) {
    var cols = new Array(n), used = new Array(n).fill(false);
    function place(row) {
      if (row === n) return true;
      var order = shuffled(range(n), rand);
      for (var i = 0; i < n; i++) {
        var c = order[i];
        if (used[c] || (row > 0 && Math.abs(cols[row - 1] - c) <= 1)) continue;
        cols[row] = c; used[c] = true;
        if (place(row + 1)) return true;
        used[c] = false;
      }
      return false;
    }
    return place(0) ? cols : null;
  }

  function nbrs(n, cell) {
    var r = Math.floor(cell / n), c = cell % n, out = [];
    if (r > 0) out.push(cell - n);
    if (r < n - 1) out.push(cell + n);
    if (c > 0) out.push(cell - 1);
    if (c < n - 1) out.push(cell + 1);
    return out;
  }

  function growRegions(n, crowns, rand) {
    var regions = new Array(n * n).fill(-1), order = shuffled(range(n), rand);
    crowns.forEach(function (c, r) { regions[r * n + c] = order[r]; });
    var appetite = range(n).map(function () { return 0.45 + rand() * 1.3; });
    var sizes = new Array(n).fill(1), left = n * n - n;
    while (left > 0) {
      var frontier = [], total = 0;
      for (var cell = 0; cell < n * n; cell++) {
        if (regions[cell] !== -1) continue;
        var ns = nbrs(n, cell);
        for (var i = 0; i < ns.length; i++) {
          var g = regions[ns[i]];
          if (g >= 0) { frontier.push([cell, g]); total += appetite[g] / sizes[g]; }
        }
      }
      var pick = rand() * total;
      for (var j = 0; j < frontier.length; j++) {
        var e = frontier[j];
        pick -= appetite[e[1]] / sizes[e[1]];
        if (pick <= 0 || j === frontier.length - 1) { regions[e[0]] = e[1]; sizes[e[1]]++; break; }
      }
      left--;
    }
    return regions;
  }

  function connected(n, regions, g) {
    var start = regions.indexOf(g);
    if (start < 0) return false;
    var seen = new Array(n * n).fill(false), stack = [start], count = 0;
    seen[start] = true;
    while (stack.length) {
      var cell = stack.pop();
      count++;
      nbrs(n, cell).forEach(function (x) { if (!seen[x] && regions[x] === g) { seen[x] = true; stack.push(x); } });
    }
    return count === regions.filter(function (x) { return x === g; }).length;
  }

  function breakSolution(n, regions, crownCell, other, rand) {
    var cells = shuffled(other.map(function (c, r) { return r * n + c; }).filter(function (c) { return !crownCell[c]; }), rand);
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i], from = regions[cell];
      var targets = uniq(nbrs(n, cell).map(function (x) { return regions[x]; }).filter(function (g) { return g !== from; }));
      if (!targets.length) continue;
      regions[cell] = -1;
      var ok = connected(n, regions, from);
      regions[cell] = from;
      if (!ok) continue;
      var sizes = new Array(n).fill(0);
      regions.forEach(function (g) { sizes[g]++; });
      targets.sort(function (a, b) { return sizes[a] - sizes[b] || rand() - 0.5; });
      regions[cell] = targets[0];
      return true;
    }
    return false;
  }

  function uniqueBoard(n, rand) {
    var crowns = placeCrowns(n, rand);
    if (!crowns) return null;
    var regions = growRegions(n, crowns, rand), crownCell = new Array(n * n).fill(false);
    crowns.forEach(function (c, r) { crownCell[r * n + c] = true; });
    for (var k = 0; k < 300; k++) {
      var sols = solve(n, regions, 2);
      var other = sols.filter(function (s) { return s.join() !== crowns.join(); })[0];
      if (!other) return { regions: regions, crowns: crowns };
      if (!breakSolution(n, regions, crownCell, other, rand)) return null;
    }
    return null;
  }

  function generate(size, minLevel, maxLevel, seed, attempts) {
    attempts = attempts || 400;
    for (var a = 0; a < attempts; a++) {
      var rand = rng((seed * 7919 + a) >>> 0);
      var b = uniqueBoard(size, rand);
      if (!b || !balanced(size, b.regions)) continue;
      var probe = new Puzzle(size, b.regions, b.crowns);
      var g = grade(probe, maxLevel);
      if (!g.solved || g.maxLevel < minLevel) continue;
      return new Puzzle(size, b.regions, b.crowns, g.maxLevel, g.score);
    }
    return null;
  }

  var api = { Puzzle: Puzzle, solve: solve, grade: grade, hint: hint, generate: generate, State: State, next: next };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QueensEngine = api;
})(this);
