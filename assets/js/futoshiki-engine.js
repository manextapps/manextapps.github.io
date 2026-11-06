/* Futoshiki engine, ported from the Futoshiki Android app (engine/Puzzle.kt, Rules.kt, Solver.kt, Logic.kt,
   Generator.kt). Cells hold 0 (empty) or 1 to n. Signs sit on borders: right[c] between c and c+1, down[c]
   between c and c+n; 1 means the first cell is smaller, 2 bigger. Candidates are bit masks, bit i for i + 1. */
(function (root) {
  "use strict";

  var LESS = 1, GREATER = 2;
  var M = {
    of: function (v) { return 1 << (v - 1); },
    has: function (m, v) { return ((m >> (v - 1)) & 1) === 1; },
    count: function (m) { var n = 0; while (m) { m &= m - 1; n++; } return n; },
    single: function (m) { return m && !(m & (m - 1)) ? 31 - Math.clz32(m) + 1 : 0; },
    min: function (m) { return m ? 31 - Math.clz32(m & -m) + 1 : 0; },
    max: function (m) { return m ? 32 - Math.clz32(m) : 0; },
    range: function (lo, hi) { return lo > hi ? 0 : ((1 << hi) - 1) & ~((1 << (lo - 1)) - 1); },
    values: function (m) { var out = []; for (var v = 1; v <= 31; v++) if (M.has(m, v)) out.push(v); return out; },
  };

  function Puzzle(n, solution, givens, right, down) {
    this.n = n; this.solution = solution; this.givens = givens; this.right = right; this.down = down;
    this.full = (1 << n) - 1;
    var lines = [], r, c;
    for (r = 0; r < n; r++) { var row = []; for (c = 0; c < n; c++) row.push(r * n + c); lines.push(row); }
    for (c = 0; c < n; c++) { var col = []; for (r = 0; r < n; r++) col.push(r * n + c); lines.push(col); }
    this.lines = lines;
    var signs = [], rel = [], smaller = [], bigger = [];
    for (var i = 0; i < n * n; i++) {
      smaller.push([]); bigger.push([]);
      if (right[i]) signs.push([i, i + 1, right[i]]);
      if (down[i]) signs.push([i, i + n, down[i]]);
    }
    signs.forEach(function (s) { rel.push(s[2] === LESS ? [s[0], s[1]] : [s[1], s[0]]); });
    rel.forEach(function (x) { smaller[x[1]].push(x[0]); bigger[x[0]].push(x[1]); });
    this.signs = signs; this.relations = rel; this.smaller = smaller; this.bigger = bigger;
  }
  Puzzle.prototype.isRow = function (line) { return line < this.n; };

  function conflicts(p, v) {
    var out = [];
    p.lines.forEach(function (cells, line) {
      for (var x = 1; x <= p.n; x++) {
        var same = cells.filter(function (c) { return v[c] === x; });
        if (same.length > 1) out.push({ problem: "repeat", line: line, cells: same, value: x });
      }
    });
    p.signs.forEach(function (s) {
      var a = v[s[0]], b = v[s[1]];
      if (!a || !b) return;
      if (s[2] === LESS ? a >= b : a <= b) out.push({ problem: "sign", line: -1, cells: [s[0], s[1]], value: a });
    });
    return out;
  }

  function isSolved(p, v) { return v.indexOf(0) < 0 && conflicts(p, v).length === 0; }

  function shuffle(list, random) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1)), t = list[i];
      list[i] = list[j]; list[j] = t;
    }
    return list;
  }

  /* Plain backtracking on the cell with the fewest numbers left, independent of the human style steps. */
  function solve(p, limit, random) {
    var n = p.n, grid = p.givens.slice(), rowUsed = new Array(n).fill(0), colUsed = new Array(n).fill(0), found = [], ok = true;
    for (var c = 0; c < grid.length; c++) {
      var x = grid[c];
      if (!x) continue;
      var bit = M.of(x), r = (c / n) | 0, k = c % n;
      if ((rowUsed[r] & bit) || (colUsed[k] & bit)) ok = false;
      rowUsed[r] |= bit; colUsed[k] |= bit;
      if (p.smaller[c].some(function (d) { return grid[d] && grid[d] >= x; })) ok = false;
    }
    if (!ok) return found;
    function options(c) {
      var m = p.full & ~(rowUsed[(c / n) | 0] | colUsed[c % n]);
      p.smaller[c].forEach(function (d) { if (grid[d]) m &= M.range(grid[d] + 1, n); });
      p.bigger[c].forEach(function (d) { if (grid[d]) m &= M.range(1, grid[d] - 1); });
      return m;
    }
    (function place() {
      if (found.length >= limit) return;
      var best = -1, bestMask = 0, bestCount = 99;
      for (var c = 0; c < grid.length; c++) {
        if (grid[c]) continue;
        var m = options(c), cnt = M.count(m);
        if (cnt < bestCount) { best = c; bestMask = m; bestCount = cnt; if (cnt <= 1) break; }
      }
      if (best < 0) { found.push(grid.slice()); return; }
      if (!bestCount) return;
      var choices = M.values(bestMask);
      if (random) shuffle(choices, random);
      var r = (best / n) | 0, k = best % n;
      for (var i = 0; i < choices.length; i++) {
        var b = M.of(choices[i]);
        grid[best] = choices[i]; rowUsed[r] |= b; colUsed[k] |= b;
        place();
        rowUsed[r] &= ~b; colUsed[k] &= ~b; grid[best] = 0;
        if (found.length >= limit) return;
      }
    })();
    return found;
  }

  /* ---- human style steps (Logic.kt) ---- */
  var LEVEL = { single: 1, sign: 2, chain: 3, pair: 4 };
  var WEIGHT = { single: 1, sign: 2, chain: 4, pair: 8 };

  function lineCandidates(p, v) {
    var n = p.n, rowUsed = new Array(n).fill(0), colUsed = new Array(n).fill(0);
    for (var c = 0; c < v.length; c++) if (v[c]) { rowUsed[(c / n) | 0] |= M.of(v[c]); colUsed[c % n] |= M.of(v[c]); }
    var out = [];
    for (var i = 0; i < v.length; i++) out.push(v[i] ? M.of(v[i]) : p.full & ~(rowUsed[(i / n) | 0] | colUsed[i % n]));
    return out.indexOf(0) >= 0 ? null : out;
  }
  function hopLow(p, v, c) {
    var lo = 1, from = -1;
    p.smaller[c].forEach(function (d) { var x = v[d] ? v[d] + 1 : 2; if (x > lo) { lo = x; from = d; } });
    return [lo, from];
  }
  function hopHigh(p, v, c) {
    var hi = p.n, from = -1;
    p.bigger[c].forEach(function (d) { var x = v[d] ? v[d] - 1 : p.n - 1; if (x < hi) { hi = x; from = d; } });
    return [hi, from];
  }
  function oneHop(p, v, lines) {
    var out = lines.map(function (m, c) { return v[c] ? m : m & M.range(hopLow(p, v, c)[0], hopHigh(p, v, c)[0]); });
    return out.indexOf(0) >= 0 ? null : out;
  }

  /* Longest runs of signs down (lo) and up (hi) from each empty cell, to a filled number or an empty end. */
  function Chains(p, v) {
    function side(lower) {
      var value = [], next = [], state = [];
      for (var i = 0; i < p.n * p.n; i++) { value.push(0); next.push(-1); state.push(0); }
      function bound(c) {
        if (v[c]) return v[c];
        if (state[c] === 2) return value[c];
        if (state[c] === 1) return lower ? 1 : p.n;
        state[c] = 1;
        var best = lower ? 1 : p.n;
        (lower ? p.smaller[c] : p.bigger[c]).forEach(function (d) {
          var x = lower ? bound(d) + 1 : bound(d) - 1;
          if (lower ? x > best : x < best) { best = x; next[c] = d; }
        });
        value[c] = best; state[c] = 2;
        return best;
      }
      return { bound: bound, next: next };
    }
    var low = side(true), high = side(false);
    this.lo = low.bound; this.hi = high.bound;
    this.filled = function (c) { return !!v[c]; };
    this.path = function (c, lower) {
      var s = lower ? low : high;
      s.bound(c);
      var out = [], at = c;
      while (!v[at]) { var nx = s.next[at]; if (nx < 0) break; out.push(nx); at = nx; }
      return out;
    };
  }

  function propagate(p, cand) {
    var changed = true;
    while (changed) {
      changed = false;
      for (var i = 0; i < p.relations.length; i++) {
        var a = p.relations[i][0], b = p.relations[i][1];
        var na = cand[a] & M.range(1, M.max(cand[b]) - 1), nb = cand[b] & M.range(M.min(cand[a]) + 1, p.n);
        if (na !== cand[a] || nb !== cand[b]) {
          cand[a] = na; cand[b] = nb; changed = true;
          if (!na || !nb) return false;
        }
      }
    }
    return true;
  }

  function signCells(p, c) { return p.smaller[c].concat(p.bigger[c]); }

  function blocker(p, v, cell, x, inRow) {
    var cross = p.lines[inRow ? p.n + cell % p.n : (cell / p.n) | 0];
    for (var i = 0; i < cross.length; i++) if (v[cross[i]] === x) return cross[i];
    return null;
  }

  function step(technique, target, value, extra) {
    var s = { kind: "logic", technique: technique, target: target, value: value, line: -1, focus: [], bounds: [], usesLines: false, pairMask: 0, pairLine: -1 };
    for (var k in extra || {}) s[k] = extra[k];
    return s;
  }

  function signStep(p, v, lines, c, x) {
    var lo = hopLow(p, v, c), hi = hopHigh(p, v, c), bounds = [];
    if (lo[1] >= 0) bounds.push({ lower: true, value: lo[0], length: 1, anchor: v[lo[1]], cells: [lo[1]] });
    if (hi[1] >= 0) bounds.push({ lower: false, value: hi[0], length: 1, anchor: v[hi[1]], cells: [hi[1]] });
    return step("sign", c, x, { focus: bounds.reduce(function (a, b) { return a.concat(b.cells); }, []), bounds: bounds,
      usesLines: M.count(p.full & M.range(lo[0], hi[0])) > 1 });
  }

  function chainStep(p, lines, ch, c, x) {
    var lo = ch.lo(c), hi = ch.hi(c), bounds = [];
    [true, false].forEach(function (lower) {
      if ((lower && lo === 1) || (!lower && hi === p.n)) return;
      var path = ch.path(c, lower), end = path[path.length - 1];
      bounds.push({ lower: lower, value: lower ? lo : hi, length: path.length, anchor: ch.filled(end) ? ch.lo(end) : 0, cells: path });
    });
    var focus = [];
    bounds.forEach(function (b) { b.cells.forEach(function (x2) { if (focus.indexOf(x2) < 0) focus.push(x2); }); });
    return step("chain", c, x, { focus: focus, bounds: bounds, usesLines: M.count(p.full & M.range(lo, hi)) > 1 });
  }

  function singles(p, v, lines, cand, technique, ch) {
    for (var c = 0; c < v.length; c++) {
      if (v[c]) continue;
      var x = M.single(cand[c]);
      if (!x) continue;
      if (technique === "single") return step("single", c, x);
      if (technique === "sign") return signStep(p, v, lines, c, x);
      return ch ? chainStep(p, lines, ch, c, x) : step(technique, c, x, { focus: signCells(p, c) });
    }
    for (var line = 0; line < p.lines.length; line++) {
      var cells = p.lines[line];
      for (var val = 1; val <= p.n; val++) {
        if (cells.some(function (q) { return v[q] === val; })) continue;
        var spots = cells.filter(function (q) { return !v[q] && M.has(cand[q], val); });
        if (spots.length !== 1) continue;
        var target = spots[0];
        var others = cells.filter(function (q) { return q !== target && !v[q]; });
        var focus = technique === "single"
          ? others.map(function (e) { return blocker(p, v, e, val, p.isRow(line)); }).filter(function (b, i, a) { return b !== null && a.indexOf(b) === i; })
          : others.filter(function (q) { return M.has(lines[q], val); });
        return step(technique, target, val, { line: line, focus: focus });
      }
    }
    return null;
  }

  function findPairs(p, v, cand) {
    var out = [];
    p.lines.forEach(function (cells, line) {
      var open = cells.filter(function (c) { return !v[c] && M.count(cand[c]) === 2; });
      for (var i = 0; i < open.length; i++) for (var j = i + 1; j < open.length; j++) if (cand[open[i]] === cand[open[j]]) out.push([line, open[i], open[j]]);
    });
    return out;
  }

  function eliminatePair(p, v, cand, line, a, b) {
    var mask = cand[a], changed = false;
    p.lines[line].forEach(function (c) {
      if (c === a || c === b || v[c]) return;
      if (cand[c] & mask) { cand[c] &= ~mask; changed = true; }
    });
    return changed;
  }

  function pairs(p, v, lines, settled) {
    var found = findPairs(p, v, settled);
    for (var i = 0; i < found.length; i++) {
      var line = found[i][0], a = found[i][1], b = found[i][2], cand = settled.slice();
      if (!eliminatePair(p, v, cand, line, a, b)) continue;
      if (!propagate(p, cand)) return null;
      var st = singles(p, v, lines, cand, "pair");
      if (!st) continue;
      return step("pair", st.target, st.value, { line: st.line, focus: [a, b], pairMask: settled[a], pairLine: line });
    }
    var all = settled.slice(), changed = true;
    while (changed) {
      changed = false;
      findPairs(p, v, all).forEach(function (f) { if (eliminatePair(p, v, all, f[0], f[1], f[2])) changed = true; });
      if (!propagate(p, all)) return null;
    }
    var last = singles(p, v, lines, all, "pair");
    return last ? step("pair", last.target, last.value, { line: last.line, focus: signCells(p, last.target) }) : null;
  }

  function next(p, v, maxLevel) {
    if (maxLevel === undefined) maxLevel = 4;
    var lines = lineCandidates(p, v);
    if (!lines) return null;
    var s = singles(p, v, lines, lines, "single");
    if (s) return s;
    if (maxLevel >= 2) {
      var hop = oneHop(p, v, lines);
      if (!hop) return null;
      s = singles(p, v, lines, hop, "sign");
      if (s) return s;
    }
    if (maxLevel >= 3) {
      var ch = new Chains(p, v);
      var chained = lines.map(function (m, c) { return v[c] ? m : m & M.range(ch.lo(c), ch.hi(c)); });
      if (chained.indexOf(0) >= 0) return null;
      s = singles(p, v, lines, chained, "chain", ch);
      if (s) return s;
      var settled = lines.slice();
      if (!propagate(p, settled)) return null;
      s = singles(p, v, lines, settled, "chain");
      if (s) return s;
      if (maxLevel >= 4) return pairs(p, v, lines, settled);
    }
    return null;
  }

  function hint(p, v) {
    var bad = conflicts(p, v).reduce(function (a, c) { return a.concat(c.cells); }, []), wrong = [];
    for (var i = 0; i < v.length; i++) if (v[i] && v[i] !== p.solution[i] && !p.givens[i]) wrong.push(i);
    if (wrong.length) {
      var cell = wrong.filter(function (c) { return bad.indexOf(c) >= 0; })[0];
      if (cell === undefined) cell = wrong[0];
      return { kind: "mistake", target: cell, value: 0, wrong: v[cell], focus: [], bounds: [] };
    }
    var s = next(p, v);
    if (s) return s;
    var k = v.indexOf(0);
    return k < 0 ? null : { kind: "reveal", target: k, value: p.solution[k], focus: [], bounds: [] };
  }

  function apply(v, s) { v[s.target] = s.value; }

  function grade(p, maxLevel) {
    var v = p.givens.slice(), top = 0, score = 0, steps = 0, counts = { single: 0, sign: 0, chain: 0, pair: 0 };
    while (v.indexOf(0) >= 0) {
      var s = next(p, v, maxLevel);
      if (!s || s.value !== p.solution[s.target]) return { solved: false };
      apply(v, s);
      top = Math.max(top, LEVEL[s.technique]);
      score += WEIGHT[s.technique];
      counts[s.technique]++;
      steps++;
    }
    return { solved: conflicts(p, v).length === 0, maxLevel: top, score: score, steps: steps, counts: counts };
  }

  function random(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Generator.generate: a random Latin square, signs that agree with it, givens removed while the human style
     solver still finishes, then signs it doesn't need. Null when the result misses the spec. */
  function generate(spec, seed) {
    var r = random(seed), n = spec.size, N = n * n, empty = new Array(N).fill(0);
    var solution = solve(new Puzzle(n, null, empty, empty, empty), 1, r)[0];
    var right = new Array(N).fill(0), down = new Array(N).fill(0), edges = [];
    for (var c = 0; c < N; c++) {
      if (c % n < n - 1) edges.push(c * 2);
      if (((c / n) | 0) < n - 1) edges.push(c * 2 + 1);
    }
    shuffle(edges, r);
    var target = spec.signs[0] + Math.floor(r() * (spec.signs[1] - spec.signs[0] + 1)) + n;
    edges.slice(0, target).forEach(function (e) {
      var a = e >> 1, b = e % 2 ? a + n : a + 1, s = solution[a] < solution[b] ? LESS : GREATER;
      if (e % 2) down[a] = s; else right[a] = s;
    });
    var p = new Puzzle(n, solution, solution.slice(), right, down);
    if (!grade(p, spec.maxLevel).solved) return null;
    var cells = shuffle(Array.from({ length: N }, function (_, i) { return i; }), r), count = N;
    for (var k = 0; k < cells.length; k++) {
      if (count <= (spec.minGivens || 0)) break;
      var g = p.givens.slice();
      g[cells[k]] = 0;
      var trial = new Puzzle(n, solution, g, p.right, p.down);
      if (grade(trial, spec.maxLevel).solved) { p = trial; count--; }
    }
    var signCount = p.signs.length;
    shuffle(edges.slice(), r).forEach(function (e) {
      if (signCount <= spec.signs[0]) return;
      var a = e >> 1, rr = p.right.slice(), dd = p.down.slice(), list = e % 2 ? dd : rr;
      if (!list[a]) return;
      list[a] = 0;
      var t = new Puzzle(n, solution, p.givens, rr, dd);
      if (grade(t, spec.maxLevel).solved) { p = t; signCount--; }
    });
    var gr = grade(p, spec.maxLevel);
    if (!gr.solved || gr.maxLevel < spec.minLevel || gr.counts.pair < (spec.minPairs || 0)) return null;
    p.level = gr.maxLevel;
    p.score = gr.score;
    return p;
  }

  var SIGNS = ".<>";
  function encode(p) {
    return [p.n, p.solution.join(""), p.givens.join(""), p.right.map(function (s) { return SIGNS[s]; }).join(""),
      p.down.map(function (s) { return SIGNS[s]; }).join("")].join("|");
  }
  function decode(text) {
    var parts = text.split("|"), n = +parts[0];
    var nums = function (s) { return s.split("").map(Number); };
    var signs = function (s) { return s.split("").map(function (ch) { return SIGNS.indexOf(ch); }); };
    return new Puzzle(n, nums(parts[1]), nums(parts[2]), signs(parts[3]), signs(parts[4]));
  }

  var api = { LESS: LESS, GREATER: GREATER, Mask: M, Puzzle: Puzzle, conflicts: conflicts, isSolved: isSolved, solve: solve,
    next: next, hint: hint, apply: apply, grade: grade, generate: generate, encode: encode, decode: decode };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FutoshikiEngine = api;
})(this);
