/* Binary puzzle engine, ported from the Sun and Moon Android app (engine/Puzzle.kt, Rules.kt, Solver.kt,
   Logic.kt, Generator.kt). Cells: 0 empty, 1 sun, 2 moon. Signs sit on borders: right[c] between c and c+1,
   down[c] between c and c+n; 1 means the same (=), 2 means different (x). */
(function (root) {
  "use strict";

  var SUN = 1, MOON = 2, SAME = 1, DIFF = 2;
  function other(v) { return 3 - v; }
  function bitCount(x) { var n = 0; while (x) { x &= x - 1; n++; } return n; }

  var patternCache = {};
  /* Every legal line of n cells: half suns, never three equal in a row. Bit i set means a sun. */
  function patterns(n) {
    if (patternCache[n]) return patternCache[n];
    var out = [], full = (1 << n) - 1;
    for (var m = 0; m < 1 << n; m++) {
      if (bitCount(m) !== n / 2) continue;
      var moons = ~m & full;
      if (m & (m >> 1) & (m >> 2)) continue;
      if (moons & (moons >> 1) & (moons >> 2)) continue;
      out.push(m);
    }
    return (patternCache[n] = out);
  }

  function Puzzle(n, solution, givens, right, down) {
    this.n = n; this.solution = solution; this.givens = givens; this.right = right; this.down = down;
    this.half = n / 2;
    var lines = [];
    for (var r = 0; r < n; r++) { var row = []; for (var c = 0; c < n; c++) row.push(r * n + c); lines.push(row); }
    for (var k = 0; k < n; k++) { var col = []; for (var q = 0; q < n; q++) col.push(q * n + k); lines.push(col); }
    this.lines = lines;
    var signs = [];
    for (var i = 0; i < n * n; i++) {
      if (right[i]) signs.push([i, i + 1, right[i]]);
      if (down[i]) signs.push([i, i + n, down[i]]);
    }
    this.signs = signs;
  }
  Puzzle.prototype.lineSign = function (line, i) {
    var c = this.lines[line][i];
    return line < this.n ? this.right[c] : this.down[c];
  };

  /* Every broken rule: three in a row, too many of one symbol in a line, a sign that doesn't hold. */
  function conflicts(p, v) {
    var out = [];
    p.lines.forEach(function (cells, line) {
      for (var i = 0; i + 2 < cells.length;) {
        var s = v[cells[i]];
        if (s && v[cells[i + 1]] === s && v[cells[i + 2]] === s) {
          var end = i + 2;
          while (end + 1 < cells.length && v[cells[end + 1]] === s) end++;
          out.push({ problem: "three", line: line, cells: cells.slice(i, end + 1), symbol: s });
          i = end + 1;
        } else i++;
      }
      [SUN, MOON].forEach(function (s) {
        var mine = cells.filter(function (c) { return v[c] === s; });
        if (mine.length > p.half) out.push({ problem: "many", line: line, cells: mine, symbol: s });
      });
    });
    p.signs.forEach(function (sg) {
      var a = v[sg[0]], b = v[sg[1]];
      if (!a || !b) return;
      if (sg[2] === SAME && a !== b) out.push({ problem: "same", line: -1, cells: [sg[0], sg[1]], symbol: a });
      if (sg[2] === DIFF && a === b) out.push({ problem: "diff", line: -1, cells: [sg[0], sg[1]], symbol: a });
    });
    return out;
  }

  function isSolved(p, v) {
    for (var i = 0; i < v.length; i++) if (!v[i]) return false;
    return conflicts(p, v).length === 0;
  }

  /* Whole rows at a time, checked against givens, signs and the columns so far. Up to limit solutions. */
  function solve(p, limit, random) {
    var n = p.n, full = (1 << n) - 1, half = n / 2, found = [], rows = [], colSuns = new Array(n).fill(0);
    var cand = [], sameAbove = new Array(n).fill(0), diffAbove = new Array(n).fill(0);
    for (var r = 0; r < n; r++) {
      var sunB = 0, moonB = 0, sameB = 0, diffB = 0;
      for (var c = 0; c < n; c++) {
        var cell = r * n + c;
        if (p.givens[cell] === SUN) sunB |= 1 << c;
        if (p.givens[cell] === MOON) moonB |= 1 << c;
        if (c < n - 1 && p.right[cell] === SAME) sameB |= 1 << c;
        if (c < n - 1 && p.right[cell] === DIFF) diffB |= 1 << c;
        if (r > 0 && p.down[cell - n] === SAME) sameAbove[r] |= 1 << c;
        if (r > 0 && p.down[cell - n] === DIFF) diffAbove[r] |= 1 << c;
      }
      var list = patterns(n).filter(function (m) {
        return (m & sunB) === sunB && !(m & moonB) && !((m ^ (m >> 1)) & sameB) && !(~(m ^ (m >> 1)) & diffB);
      });
      if (random) shuffle(list, random);
      cand.push(list);
    }
    (function place(r) {
      if (found.length >= limit) return;
      if (r === n) {
        var g = [];
        for (var i = 0; i < n * n; i++) g.push((rows[(i / n) | 0] >> (i % n)) & 1 ? SUN : MOON);
        found.push(g);
        return;
      }
      var left = n - r - 1;
      for (var k = 0; k < cand[r].length; k++) {
        var m = cand[r][k];
        if (r > 0) {
          var prev = rows[r - 1];
          if ((m ^ prev) & sameAbove[r]) continue;
          if (~(m ^ prev) & diffAbove[r] & full) continue;
          if (r > 1) {
            var prev2 = rows[r - 2];
            if (m & prev & prev2) continue;
            if (~m & ~prev & ~prev2 & full) continue;
          }
        }
        var ok = true;
        for (var c2 = 0; c2 < n; c2++) {
          var suns = colSuns[c2] + ((m >> c2) & 1), moons = r + 1 - suns;
          if (suns > half || moons > half || suns + left < half || moons + left < half) { ok = false; break; }
        }
        if (!ok) continue;
        rows[r] = m;
        for (var c3 = 0; c3 < n; c3++) colSuns[c3] += (m >> c3) & 1;
        place(r + 1);
        for (var c4 = 0; c4 < n; c4++) colSuns[c4] -= (m >> c4) & 1;
        if (found.length >= limit) return;
      }
    })(0);
    return found;
  }

  function shuffle(list, random) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1)), t = list[i];
      list[i] = list[j]; list[j] = t;
    }
    return list;
  }

  /* ---- human style steps, simplest first (Logic.kt) ---- */
  var LEVEL = { sign: 1, pair: 1, gap: 1, count: 2, signPair: 2, balance: 3 };
  var WEIGHT = { sign: 1, pair: 1, gap: 1, count: 2, signPair: 2, balance: 6 };

  function stepSign(p, v) {
    for (var i = 0; i < p.signs.length; i++) {
      var a = p.signs[i][0], b = p.signs[i][1], s = p.signs[i][2];
      if (!v[a] === !v[b]) continue;
      var known = v[a] ? a : b, target = known === a ? b : a, k = v[known];
      return { technique: "sign", line: -1, focus: [known, target], targets: [target], values: [s === SAME ? k : other(k)], symbol: k, sign: s };
    }
    return null;
  }
  function stepPair(p, v) {
    for (var line = 0; line < p.lines.length; line++) {
      var cells = p.lines[line];
      for (var i = 0; i < cells.length - 1; i++) {
        var s = v[cells[i]];
        if (!s || v[cells[i + 1]] !== s) continue;
        var ends = [cells[i - 1], cells[i + 2]].filter(function (c) { return c !== undefined && !v[c]; });
        if (ends.length) return { technique: "pair", line: line, focus: [cells[i], cells[i + 1]], targets: ends, values: ends.map(function () { return other(s); }), symbol: s };
      }
    }
    return null;
  }
  function stepGap(p, v) {
    for (var line = 0; line < p.lines.length; line++) {
      var cells = p.lines[line];
      for (var i = 0; i < cells.length - 2; i++) {
        var s = v[cells[i]];
        if (!s || v[cells[i + 2]] !== s || v[cells[i + 1]]) continue;
        return { technique: "gap", line: line, focus: [cells[i], cells[i + 2]], targets: [cells[i + 1]], values: [other(s)], symbol: s };
      }
    }
    return null;
  }
  function stepCount(p, v) {
    for (var line = 0; line < p.lines.length; line++) {
      var cells = p.lines[line];
      var empty = cells.filter(function (c) { return !v[c]; });
      if (!empty.length) continue;
      for (var s = SUN; s <= MOON; s++) {
        var mine = cells.filter(function (c) { return v[c] === s; });
        if (mine.length === p.half) return { technique: "count", line: line, focus: mine, targets: empty, values: empty.map(function () { return other(s); }), symbol: s };
      }
    }
    return null;
  }
  function stepSignPair(p, v) {
    for (var line = 0; line < p.lines.length; line++) {
      var cells = p.lines[line];
      for (var i = 0; i < cells.length - 1; i++) {
        if (p.lineSign(line, i) !== SAME) continue;
        var a = cells[i], b = cells[i + 1];
        if (v[a] || v[b]) continue;
        var nb = [cells[i - 1], cells[i + 2]].filter(function (c) { return c !== undefined && v[c]; })[0];
        if (nb === undefined) continue;
        var s = v[nb];
        return { technique: "signPair", line: line, focus: [nb, a, b], targets: [a, b], values: [other(s), other(s)], symbol: s };
      }
    }
    return null;
  }
  function stepBalance(p, v) {
    var pats = patterns(p.n), full = (1 << p.n) - 1;
    for (var line = 0; line < p.lines.length; line++) {
      var cells = p.lines[line], suns = 0, moons = 0, same = 0, diff = 0;
      for (var i = 0; i < cells.length; i++) {
        if (v[cells[i]] === SUN) suns |= 1 << i;
        if (v[cells[i]] === MOON) moons |= 1 << i;
        if (i < cells.length - 1) {
          var sg = p.lineSign(line, i);
          if (sg === SAME) same |= 1 << i;
          if (sg === DIFF) diff |= 1 << i;
        }
      }
      var known = suns | moons;
      if (known === full) continue;
      var allSun = full, anySun = 0, matches = 0;
      for (var k = 0; k < pats.length; k++) {
        var m = pats[k];
        if ((m & suns) !== suns || (m & moons)) continue;
        var st = m ^ (m >> 1);
        if ((st & same) || (~st & diff)) continue;
        allSun &= m; anySun |= m; matches++;
      }
      if (!matches) continue;
      var fSun = allSun & ~known & full, fMoon = ~anySun & ~known & full;
      if (!fSun && !fMoon) continue;
      var targets = [], values = [];
      for (var j = 0; j < cells.length; j++) {
        if ((fSun >> j) & 1) { targets.push(cells[j]); values.push(SUN); }
        else if ((fMoon >> j) & 1) { targets.push(cells[j]); values.push(MOON); }
      }
      return { technique: "balance", line: line, focus: cells.slice(), targets: targets, values: values, symbol: values[0],
        needSuns: p.half - bitCount(suns), needMoons: p.half - bitCount(moons) };
    }
    return null;
  }

  function next(p, v, maxLevel) {
    if (maxLevel === undefined) maxLevel = 3;
    return stepSign(p, v) || stepPair(p, v) || stepGap(p, v) ||
      (maxLevel >= 2 && (stepCount(p, v) || stepSignPair(p, v))) || (maxLevel >= 3 && stepBalance(p, v)) || null;
  }

  /* A wrong symbol first, then the simplest logical step, else one cell of the solution. */
  function hint(p, v) {
    var bad = conflicts(p, v).reduce(function (a, c) { return a.concat(c.cells); }, []);
    var wrong = [];
    for (var i = 0; i < v.length; i++) if (v[i] && v[i] !== p.solution[i] && !p.givens[i]) wrong.push(i);
    if (wrong.length) {
      var cell = wrong.filter(function (c) { return bad.indexOf(c) >= 0; })[0];
      if (cell === undefined) cell = wrong[0];
      return { kind: "mistake", focus: [cell], targets: [cell], values: [0], symbol: v[cell] };
    }
    var st = next(p, v);
    if (st) { st.kind = "logic"; return st; }
    for (var k = 0; k < v.length; k++) if (!v[k]) return { kind: "reveal", focus: [k], targets: [k], values: [p.solution[k]], symbol: p.solution[k] };
    return null;
  }

  function apply(v, st) { st.targets.forEach(function (c, i) { v[c] = st.values[i]; }); }

  /* Solves from the givens with steps up to maxLevel, never guessing. */
  function grade(p, maxLevel) {
    var v = p.givens.slice(), top = 0, score = 0, steps = 0, balance = 0;
    while (v.indexOf(0) >= 0) {
      var st = next(p, v, maxLevel);
      if (!st) return { solved: false };
      for (var i = 0; i < st.targets.length; i++) if (st.values[i] !== p.solution[st.targets[i]]) return { solved: false };
      apply(v, st);
      top = Math.max(top, LEVEL[st.technique]);
      score += WEIGHT[st.technique];
      if (st.technique === "balance") balance++;
      steps++;
    }
    return { solved: conflicts(p, v).length === 0, maxLevel: top, score: score, steps: steps, balance: balance };
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

  /* Generator.generate: a random full grid, some signs that agree with it, then givens removed while the
     human style solver still finishes the board. Null when the result misses the spec. */
  function generate(spec, seed) {
    var r = random(seed), n = spec.size, N = n * n;
    var empty = new Array(N).fill(0);
    var solution = solve(new Puzzle(n, null, empty, empty, empty), 1, r)[0];
    var right = new Array(N).fill(0), down = new Array(N).fill(0), edges = [];
    for (var c = 0; c < N; c++) {
      if (c % n < n - 1) edges.push(c * 2);
      if (((c / n) | 0) < n - 1) edges.push(c * 2 + 1);
    }
    shuffle(edges, r);
    var target = spec.signs[0] + Math.floor(r() * (spec.signs[1] - spec.signs[0] + 1));
    edges.slice(0, target).forEach(function (e) {
      var a = e >> 1, b = e % 2 ? a + n : a + 1, s = solution[a] === solution[b] ? SAME : DIFF;
      if (e % 2) down[a] = s; else right[a] = s;
    });
    var p = new Puzzle(n, solution, solution.slice(), right, down);
    if (!grade(p, spec.maxLevel).solved) return null;
    var order = shuffle(Array.from({ length: N }, function (_, i) { return i; }), r), count = N;
    for (var k = 0; k < order.length; k++) {
      if (count <= (spec.minGivens || 0)) break;
      var g = p.givens.slice();
      g[order[k]] = 0;
      var trial = new Puzzle(n, solution, g, right, down);
      if (grade(trial, spec.maxLevel).solved) { p = trial; count--; }
    }
    var gr = grade(p, spec.maxLevel);
    if (!gr.solved || gr.balance < (spec.minBalance || 0)) return null;
    p.level = gr.maxLevel;
    p.score = gr.score;
    return p;
  }

  /* "n|solution|givens|right|down" with S, M, "." and =, x, "." like the app's PuzzleCodec, without the grade. */
  function encode(p) {
    var cell = function (x) { return ".SM"[x]; }, sign = function (x) { return ".=x"[x]; };
    return [p.n, p.solution.map(cell).join(""), p.givens.map(cell).join(""), p.right.map(sign).join(""), p.down.map(sign).join("")].join("|");
  }
  function decode(text) {
    var parts = text.split("|"), n = +parts[0];
    var cells = function (s) { return s.split("").map(function (ch) { return ".SM".indexOf(ch); }); };
    var signs = function (s) { return s.split("").map(function (ch) { return ".=x".indexOf(ch); }); };
    return new Puzzle(n, cells(parts[1]), cells(parts[2]), signs(parts[3]), signs(parts[4]));
  }

  var api = { SUN: SUN, MOON: MOON, SAME: SAME, DIFF: DIFF, Puzzle: Puzzle, patterns: patterns, conflicts: conflicts, isSolved: isSolved,
    solve: solve, next: next, hint: hint, apply: apply, grade: grade, generate: generate, encode: encode, decode: decode };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BinaryEngine = api;
})(this);
