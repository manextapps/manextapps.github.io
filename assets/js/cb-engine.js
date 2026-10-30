/*
 * Code breaker puzzle engine for the web: a port of Crack the Vault's puzzle-engine
 * (Clue, Codes, LogicSolver, Generator). Runs in the browser and in node (build checks).
 *
 * Differences from the Kotlin original, all on purpose:
 * - The random generator is sfc32 seeded with FNV-1a 32, pure 32 bit integer math, and the
 *   generator's cost function uses integer ratios instead of ln(). Browsers are free to round
 *   Math.log differently, and a daily puzzle must be identical on every device.
 * - Codes are handled as digit strings, candidates as indexes into flat typed arrays.
 */
(function (root) {
  "use strict";

  function hash32(text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i) & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  function Rng(seed) {
    var s = seed >>> 0;
    function splitmix() {
      s = (s + 0x9e3779b9) >>> 0;
      var z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
      return (z ^ (z >>> 16)) >>> 0;
    }
    this.a = splitmix();
    this.b = splitmix();
    this.c = splitmix();
    this.d = splitmix();
    for (var i = 0; i < 12; i++) this.next();
  }
  Rng.prototype.next = function () {
    var t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t >>> 0;
  };
  Rng.prototype.int = function (bound) {
    var limit = 4294967296 - (4294967296 % bound);
    for (;;) {
      var r = this.next();
      if (r < limit) return r % bound;
    }
  };
  Rng.prototype.shuffle = function (list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = this.int(i + 1);
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  };

  function randomCode(n, rng) {
    var digits = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    return digits.slice(0, n).join("");
  }

  function evaluate(secret, guess) {
    var exact = 0;
    var total = 0;
    for (var i = 0; i < secret.length; i++) {
      if (secret.charCodeAt(i) === guess.charCodeAt(i)) exact++;
      if (guess.indexOf(secret.charAt(i)) >= 0) total++;
    }
    return { exact: exact, total: total };
  }

  function clueOf(secret, guess) {
    var fb = evaluate(secret, guess);
    return { guess: guess, exact: fb.exact, total: fb.total };
  }

  function kind(c) {
    if (c.total === 0) return "none";
    if (c.exact === c.total) return "inplace";
    if (c.exact === 0) return "misplaced";
    return "mixed";
  }

  function distinct(s) {
    for (var i = 0; i < s.length; i++) if (s.indexOf(s.charAt(i)) !== i) return false;
    return true;
  }

  function clueProblems(c, n) {
    var out = [];
    if (c.guess.length !== n) out.push("length");
    if (!/^[0-9]+$/.test(c.guess)) out.push("not digits");
    if (!distinct(c.guess)) out.push("repeats a digit");
    if (c.exact < 0 || c.total < 0) out.push("negative");
    if (c.exact > c.total) out.push("exact above total");
    if (c.total > n) out.push("total above length");
    if (c.total === n && c.exact === n - 1) out.push("impossible feedback");
    if (c.exact === n) out.push("reveals the code");
    return out;
  }

  var tables = {};
  function table(n) {
    if (tables[n]) return tables[n];
    var codes = [];
    var digits = [];
    var masks = [];
    (function fill(prefix, used) {
      if (prefix.length === n) {
        codes.push(prefix);
        masks.push(used);
        for (var i = 0; i < n; i++) digits.push(prefix.charCodeAt(i) - 48);
        return;
      }
      for (var d = 0; d < 10; d++) if (!(used & (1 << d))) fill(prefix + d, used | (1 << d));
    })("", 0);
    tables[n] = { n: n, codes: codes, digits: Uint8Array.from(digits), masks: Uint16Array.from(masks) };
    return tables[n];
  }

  function popcount(x) {
    var c = 0;
    while (x) {
      x &= x - 1;
      c++;
    }
    return c;
  }

  function maskOf(code) {
    var m = 0;
    for (var i = 0; i < code.length; i++) m |= 1 << (code.charCodeAt(i) - 48);
    return m;
  }

  function matcher(n, clue) {
    var t = table(n);
    var g = [];
    for (var i = 0; i < n; i++) g.push(clue.guess.charCodeAt(i) - 48);
    var gm = maskOf(clue.guess);
    return function (idx) {
      if (popcount(t.masks[idx] & gm) !== clue.total) return false;
      var exact = 0;
      var base = idx * n;
      for (var i = 0; i < n; i++) if (t.digits[base + i] === g[i]) exact++;
      return exact === clue.exact;
    };
  }

  function filterIdx(n, idxs, clue) {
    var m = matcher(n, clue);
    var out = [];
    for (var i = 0; i < idxs.length; i++) if (m(idxs[i])) out.push(idxs[i]);
    return out;
  }

  function solutions(n, clues, limit) {
    var t = table(n);
    var ms = clues.map(function (c) { return matcher(n, c); });
    var out = [];
    for (var idx = 0; idx < t.codes.length; idx++) {
      var ok = true;
      for (var j = 0; j < ms.length && ok; j++) ok = ms[j](idx);
      if (ok) {
        out.push(t.codes[idx]);
        if (limit && out.length >= limit) break;
      }
    }
    return out;
  }

  /* ---------- Knowledge and step by step logic solver ---------- */

  var UNKNOWN = 0, IN = 1, OUT = 2;
  var CAT_IN_PLACE = 1, CAT_MISPLACED = 2, CAT_ABSENT = 4;
  var LEVEL = {
    NONE_CLUE: 1, SLOT_SINGLE: 2, DIGIT_SINGLE: 2, DIGIT_NO_SLOT: 2,
    CLUE_ACCOUNTED: 3, CLUE_FORCED: 3, CODE_FULL: 3, CODE_REMAINING: 3, CONTRADICTION: 5,
  };

  function Knowledge(n, status, slots) {
    this.n = n;
    this.status = status || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var full = (1 << n) - 1;
    this.slots = slots || [full, full, full, full, full, full, full, full, full, full];
  }
  Knowledge.prototype.copy = function () {
    return new Knowledge(this.n, this.status.slice(), this.slots.slice());
  };
  Knowledge.prototype.isIn = function (d) { return this.status[d] === IN; };
  Knowledge.prototype.isOut = function (d) { return this.status[d] === OUT; };
  Knowledge.prototype.isUnknown = function (d) { return this.status[d] === UNKNOWN; };
  Knowledge.prototype.canBeAt = function (d, p) {
    return this.status[d] !== OUT && ((this.slots[d] >> p) & 1) === 1;
  };
  Knowledge.prototype.slotMask = function (d) { return this.status[d] === OUT ? 0 : this.slots[d]; };
  Knowledge.prototype.fixedAt = function (d) {
    if (this.status[d] === IN && popcount(this.slots[d]) === 1) return 31 - Math.clz32(this.slots[d]);
    return -1;
  };
  Knowledge.prototype.candidatesAt = function (p) {
    var out = [];
    for (var d = 0; d < 10; d++) if (this.canBeAt(d, p)) out.push(d);
    return out;
  };
  Knowledge.prototype.digitAtSlot = function (p) {
    var c = this.candidatesAt(p);
    return c.length === 1 && this.fixedAt(c[0]) === p ? c[0] : -1;
  };
  Knowledge.prototype.isSolved = function () {
    for (var p = 0; p < this.n; p++) if (this.digitAtSlot(p) < 0) return false;
    return true;
  };
  Knowledge.prototype.solvedCode = function () {
    if (!this.isSolved()) return null;
    var s = "";
    for (var p = 0; p < this.n; p++) s += this.digitAtSlot(p);
    return s;
  };
  Knowledge.prototype.isNew = function (f) {
    switch (f.t) {
      case "in": return this.status[f.d] !== IN;
      case "out": return this.status[f.d] !== OUT;
      case "at": return this.fixedAt(f.d) !== f.p;
      default: return this.canBeAt(f.d, f.p);
    }
  };
  Knowledge.prototype.apply = function (f) {
    switch (f.t) {
      case "in":
        if (this.status[f.d] === OUT) return false;
        this.status[f.d] = IN;
        return true;
      case "out":
        if (this.status[f.d] === IN) return false;
        this.status[f.d] = OUT;
        return true;
      case "at": {
        var bit = 1 << f.p;
        if (this.status[f.d] === OUT || (this.slots[f.d] & bit) === 0) return false;
        this.status[f.d] = IN;
        this.slots[f.d] = bit;
        for (var e = 0; e < 10; e++) if (e !== f.d) this.slots[e] &= ~bit;
        return true;
      }
      default:
        this.slots[f.d] &= ~(1 << f.p);
        return true;
    }
  };
  Knowledge.prototype.options = function (d, i) {
    var s = 0;
    if (this.status[d] !== IN) s |= CAT_ABSENT;
    if (this.status[d] !== OUT) {
      if ((this.slots[d] >> i) & 1) s |= CAT_IN_PLACE;
      if (this.slots[d] & ~(1 << i)) s |= CAT_MISPLACED;
    }
    return s;
  };
  Knowledge.prototype.contradiction = function (clues) {
    var inCount = 0, possible = 0, d, p;
    for (d = 0; d < 10; d++) {
      if (this.status[d] === IN) {
        inCount++;
        if (this.slots[d] === 0) return { type: "digit", digit: d };
      }
      if (this.status[d] !== OUT && this.slots[d] !== 0) possible++;
    }
    if (inCount > this.n) return { type: "toomany" };
    if (possible < this.n) return { type: "toofew" };
    for (p = 0; p < this.n; p++) if (this.candidatesAt(p).length === 0) return { type: "slot", pos: p };
    for (p = 0; p < this.n; p++) {
      var fixedHere = 0;
      for (d = 0; d < 10; d++) if (this.fixedAt(d) === p) fixedHere++;
      if (fixedHere > 1) return { type: "slot", pos: p };
    }
    var cats = [CAT_IN_PLACE, CAT_MISPLACED, CAT_ABSENT];
    for (var ci = 0; ci < clues.length; ci++) {
      var clue = clues[ci];
      for (var k = 0; k < 3; k++) {
        var cat = cats[k];
        var req = required(clue, cat);
        var must = 0, can = 0;
        for (var i = 0; i < clue.guess.length; i++) {
          var o = this.options(clue.guess.charCodeAt(i) - 48, i);
          if (o & cat) {
            can++;
            if (o === cat) must++;
          }
        }
        if (must > req || can < req) return { type: "clue", clue: ci };
      }
      for (var j = 0; j < clue.guess.length; j++) {
        if (this.options(clue.guess.charCodeAt(j) - 48, j) === 0) return { type: "clue", clue: ci };
      }
    }
    return null;
  };

  function required(clue, cat) {
    if (cat === CAT_IN_PLACE) return clue.exact;
    if (cat === CAT_MISPLACED) return clue.total - clue.exact;
    return clue.guess.length - clue.total;
  }

  function factKey(f) { return f.t + f.d + (f.p === undefined ? "" : "@" + f.p); }

  function uniqueFacts(list) {
    var seen = {};
    return list.filter(function (f) {
      var key = factKey(f);
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function LogicSolver(n, clues) {
    this.n = n;
    this.clues = clues;
  }

  LogicSolver.prototype.solve = function (start, maxSteps) {
    var k = (start || new Knowledge(this.n)).copy();
    var steps = [];
    maxSteps = maxSteps || 400;
    while (!k.isSolved() && steps.length < maxSteps) {
      var step = this.next(k, true, false);
      if (!step) return { solved: false, code: null, steps: steps };
      for (var i = 0; i < step.facts.length; i++) {
        if (!k.apply(step.facts[i])) throw new Error("solver produced an inconsistent fact");
      }
      steps.push(step);
    }
    return { solved: k.isSolved(), code: k.solvedCode(), steps: steps };
  };

  LogicSolver.prototype.next = function (k, allowContradiction, skipNone) {
    var s;
    if (!skipNone && (s = this.noneClue(k))) return s;
    if ((s = this.singles(k))) return s;
    if ((s = this.clueRules(k, skipNone))) return s;
    if ((s = this.codeCount(k))) return s;
    if (allowContradiction && (s = this.contradictionStep(k))) return s;
    return null;
  };

  LogicSolver.prototype.applyGivens = function (k) {
    for (;;) {
      var step = this.noneClue(k);
      if (!step) return;
      step.facts.forEach(function (f) { k.apply(f); });
    }
  };

  LogicSolver.prototype.noneClue = function (k) {
    for (var ci = 0; ci < this.clues.length; ci++) {
      var clue = this.clues[ci];
      if (clue.total !== 0) continue;
      var facts = [];
      for (var i = 0; i < clue.guess.length; i++) {
        var f = { t: "out", d: clue.guess.charCodeAt(i) - 48 };
        if (k.isNew(f)) facts.push(f);
      }
      if (facts.length) return { rule: "NONE_CLUE", facts: facts, clue: ci };
    }
    return null;
  };

  LogicSolver.prototype.singles = function (k) {
    var p, d;
    for (p = 0; p < this.n; p++) {
      var c = k.candidatesAt(p);
      if (c.length === 1 && k.fixedAt(c[0]) !== p) {
        return { rule: "SLOT_SINGLE", facts: [{ t: "at", d: c[0], p: p }], pos: p, support: c };
      }
    }
    for (d = 0; d < 10; d++) {
      if (k.isIn(d) && k.fixedAt(d) < 0) {
        var mask = k.slotMask(d);
        if (popcount(mask) === 1) {
          p = 31 - Math.clz32(mask);
          return { rule: "DIGIT_SINGLE", facts: [{ t: "at", d: d, p: p }], pos: p, support: [d] };
        }
      }
    }
    for (d = 0; d < 10; d++) {
      if (k.isUnknown(d) && k.slotMask(d) === 0) {
        return { rule: "DIGIT_NO_SLOT", facts: [{ t: "out", d: d }], support: [d] };
      }
    }
    return null;
  };

  LogicSolver.prototype.clueRules = function (k, skipNone) {
    var order = [CAT_IN_PLACE, CAT_ABSENT, CAT_MISPLACED];
    var self = this;
    for (var ci = 0; ci < this.clues.length; ci++) {
      var clue = this.clues[ci];
      if (skipNone && clue.total === 0) continue;
      for (var oi = 0; oi < order.length; oi++) {
        var cat = order[oi];
        var req = required(clue, cat);
        var musts = [], cans = [];
        for (var i = 0; i < clue.guess.length; i++) {
          var o = k.options(clue.guess.charCodeAt(i) - 48, i);
          if (o & cat) {
            cans.push(i);
            if (o === cat) musts.push(i);
          }
        }
        var digitsAt = function (list) { return list.map(function (i) { return clue.guess.charCodeAt(i) - 48; }); };
        if (musts.length === req && cans.length > musts.length) {
          var ex = [];
          cans.forEach(function (i) { if (musts.indexOf(i) < 0) ex = ex.concat(self.exclude(clue, i, cat)); });
          ex = uniqueFacts(ex.filter(function (f) { return k.isNew(f); }));
          if (ex.length) {
            return { rule: "CLUE_ACCOUNTED", facts: ex, clue: ci, cat: cat, required: req, support: digitsAt(musts) };
          }
        }
        if (cans.length === req && req > 0) {
          var fo = [];
          cans.forEach(function (i) { fo = fo.concat(self.force(clue, i, cat)); });
          fo = uniqueFacts(fo.filter(function (f) { return k.isNew(f); }));
          if (fo.length) {
            return { rule: "CLUE_FORCED", facts: fo, clue: ci, cat: cat, required: req, support: digitsAt(cans) };
          }
        }
      }
    }
    return null;
  };

  LogicSolver.prototype.exclude = function (clue, i, cat) {
    var d = clue.guess.charCodeAt(i) - 48;
    if (cat === CAT_IN_PLACE) return [{ t: "notat", d: d, p: i }];
    if (cat === CAT_ABSENT) return [{ t: "in", d: d }];
    var out = [];
    for (var p = 0; p < this.n; p++) if (p !== i) out.push({ t: "notat", d: d, p: p });
    return out;
  };

  LogicSolver.prototype.force = function (clue, i, cat) {
    var d = clue.guess.charCodeAt(i) - 48;
    if (cat === CAT_IN_PLACE) return [{ t: "at", d: d, p: i }];
    if (cat === CAT_ABSENT) return [{ t: "out", d: d }];
    return [{ t: "in", d: d }, { t: "notat", d: d, p: i }];
  };

  LogicSolver.prototype.codeCount = function (k) {
    var known = [], unknown = [];
    for (var d = 0; d < 10; d++) {
      if (k.isIn(d)) known.push(d);
      else if (k.isUnknown(d) && k.slotMask(d) !== 0) unknown.push(d);
    }
    if (known.length === this.n && unknown.length) {
      return { rule: "CODE_FULL", facts: unknown.map(function (d) { return { t: "out", d: d }; }), support: known };
    }
    if (known.length + unknown.length === this.n && unknown.length) {
      return { rule: "CODE_REMAINING", facts: unknown.map(function (d) { return { t: "in", d: d }; }), support: known.concat(unknown) };
    }
    return null;
  };

  LogicSolver.prototype.assumptions = function (k) {
    var list = [], d, p;
    for (d = 0; d < 10; d++) {
      if (k.isUnknown(d) && k.slotMask(d) !== 0) {
        list.push([{ t: "in", d: d }, { t: "out", d: d }]);
        list.push([{ t: "out", d: d }, { t: "in", d: d }]);
      }
    }
    for (d = 0; d < 10; d++) {
      if (k.isOut(d) || k.fixedAt(d) >= 0) continue;
      for (p = 0; p < this.n; p++) {
        if (k.canBeAt(d, p)) list.push([{ t: "at", d: d, p: p }, { t: "notat", d: d, p: p }]);
      }
    }
    return list;
  };

  LogicSolver.prototype.contradictionStep = function (k) {
    var best = null, bestDepth = Infinity;
    var list = this.assumptions(k);
    for (var i = 0; i < list.length; i++) {
      var probe = k.copy();
      if (!probe.apply(list[i][0])) continue;
      var r = this.propagate(probe, bestDepth);
      if (!r) continue;
      if (r.depth < bestDepth) {
        bestDepth = r.depth;
        best = { rule: "CONTRADICTION", facts: [list[i][1]], assumption: list[i][0], reason: r.reason };
        if (r.depth === 0) break;
      }
    }
    return best;
  };

  LogicSolver.prototype.propagate = function (k, limit) {
    var depth = 0, reason;
    while (depth < limit && depth < 60) {
      reason = k.contradiction(this.clues);
      if (reason) return { depth: depth, reason: reason };
      var step = this.next(k, false, false);
      if (!step) return null;
      for (var i = 0; i < step.facts.length; i++) {
        if (!k.apply(step.facts[i])) {
          return { depth: depth, reason: k.contradiction(this.clues) || { type: "clue", clue: step.clue || 0 } };
        }
      }
      depth++;
    }
    reason = k.contradiction(this.clues);
    return reason ? { depth: depth, reason: reason } : null;
  };

  function rate(n, clues) {
    var result = new LogicSolver(n, clues).solve();
    var branches = 0, levelSquares = 0;
    result.steps.forEach(function (s) {
      if (s.rule === "CONTRADICTION") branches++;
      levelSquares += LEVEL[s.rule] * LEVEL[s.rule];
    });
    var score = clues.length * 3 + levelSquares + branches * 12 + (n - 3) * 10;
    return { result: result, branches: branches, score: score, steps: result.steps.length };
  }

  /* ---------- Generator (same tiers as the app) ---------- */

  var SPECS = {
    beginner: { tier: "beginner", length: 3, minClues: 3, maxClues: 5, minBranches: 0, maxBranches: 0, allowMixed: false, requireNone: true, minScore: 0, maxScore: 90 },
    easy: { tier: "easy", length: 3, minClues: 3, maxClues: 6, minBranches: 0, maxBranches: 1, allowMixed: true, requireNone: false, minScore: 0, maxScore: 150 },
    medium: { tier: "medium", length: 4, minClues: 4, maxClues: 7, minBranches: 0, maxBranches: 2, allowMixed: true, requireNone: false, minScore: 80, maxScore: 230 },
    hard: { tier: "hard", length: 4, minClues: 4, maxClues: 8, minBranches: 1, maxBranches: 5, allowMixed: true, requireNone: false, minScore: 150, maxScore: 420 },
    expert: { tier: "expert", length: 5, minClues: 5, maxClues: 9, minBranches: 0, maxBranches: 6, allowMixed: true, requireNone: false, minScore: 120, maxScore: 480 },
  };

  var SAMPLES = 48;

  function generate(seed, spec) {
    var n = spec.length;
    var rng = new Rng(seed);
    var secret = randomCode(n, rng);
    var t = table(n);
    var cands = [];
    for (var i = 0; i < t.codes.length; i++) cands.push(i);
    var clues = [];
    var keep = 180 + rng.int(300);

    while (cands.length > 1 && clues.length < spec.maxClues + 4) {
      var target = Math.max(1, Math.floor((cands.length * keep) / 1000));
      var best = null, bestRem = cands, bestCost = Infinity;
      for (var s = 0; s < SAMPLES; s++) {
        var guess = randomCode(n, rng);
        if (guess === secret || clues.some(function (c) { return c.guess === guess; })) continue;
        var clue = clueOf(secret, guess);
        if (clueProblems(clue, n).length) continue;
        var kd = kind(clue);
        if (!spec.allowMixed && kd === "mixed") continue;
        if (spec.requireNone && clues.length === 0 && kd !== "none") continue;
        var rem = filterIdx(n, cands, clue);
        if (rem.length === cands.length) continue;
        var hi = Math.max(rem.length, target), lo = Math.min(rem.length, target);
        var cost = Math.floor((hi * 1000000) / lo);
        if (clues.length && kind(clues[clues.length - 1]) === kd) cost = Math.floor((cost * 1419) / 1000);
        if (kd === "none" && clues.some(function (c) { return c.total === 0; })) cost = Math.floor((cost * 1822) / 1000);
        cost = Math.floor((cost * (1000 + rng.int(163))) / 1000);
        if (cost < bestCost) {
          bestCost = cost;
          best = clue;
          bestRem = rem;
        }
      }
      if (!best) return null;
      clues.push(best);
      cands = bestRem;
    }
    if (cands.length !== 1 || t.codes[cands[0]] !== secret) return null;

    var order = rng.shuffle(clues.map(function (_, idx) { return idx; }));
    var kept = clues.slice();
    var protectedClue = spec.requireNone ? clues.filter(function (c) { return c.total === 0; })[0] : null;
    var targetClues = spec.minClues + rng.int(spec.maxClues - spec.minClues + 1);
    for (var oi = 0; oi < order.length; oi++) {
      if (kept.length <= targetClues) break;
      var c = clues[order[oi]];
      if (c === protectedClue) continue;
      var without = kept.filter(function (x) { return x !== c; });
      if (solutions(n, without, 2).length === 1) kept = without;
    }
    rng.shuffle(kept);
    if (kept.length < spec.minClues || kept.length > spec.maxClues) return null;
    if (spec.requireNone && !kept.some(function (x) { return x.total === 0; })) return null;
    if (!spec.allowMixed && kept.some(function (x) { return kind(x) === "mixed"; })) return null;

    var r = rate(n, kept);
    if (!r.result.solved || r.result.code !== secret) return null;
    if (r.branches < spec.minBranches || r.branches > spec.maxBranches) return null;
    if (r.score < spec.minScore || r.score > spec.maxScore) return null;
    if (solutions(n, kept, 2).length !== 1) return null;
    return { length: n, tier: spec.tier, code: secret, clues: kept, branches: r.branches, score: r.score, steps: r.steps };
  }

  function attemptSeeds(baseSeed) {
    var rng = new Rng(baseSeed);
    return function () { return rng.next(); };
  }

  /** Deterministic: tries derived seeds in order. Returns the puzzle and the attempt that passed. */
  function generateWithRetries(baseSeed, spec, maxAttempts) {
    var nextSeed = attemptSeeds(baseSeed);
    maxAttempts = maxAttempts || 400;
    for (var a = 0; a < maxAttempts; a++) {
      var p = generate(nextSeed(), spec);
      if (p) {
        p.attempt = a;
        return p;
      }
    }
    return null;
  }

  /** Jumps straight to a known good attempt (from the build's verified table). */
  function generateAt(baseSeed, spec, attempt) {
    var nextSeed = attemptSeeds(baseSeed);
    for (var a = 0; a < attempt; a++) nextSeed();
    var p = generate(nextSeed(), spec);
    if (p) p.attempt = attempt;
    return p;
  }

  var DAILY_TIERS = { 3: "easy", 4: "medium", 5: "expert" };

  function dailySeed(dateIso, n) { return hash32("daily:" + dateIso + ":" + n + ":v1"); }

  function daily(dateIso, n, knownAttempt) {
    var spec = SPECS[DAILY_TIERS[n]];
    var seed = dailySeed(dateIso, n);
    if (knownAttempt !== undefined && knownAttempt !== null) {
      var p = generateAt(seed, spec, knownAttempt);
      if (p) return p;
    }
    return generateWithRetries(seed, spec, 600);
  }

  /* ---------- Plain English ---------- */

  function joinWords(items) {
    if (items.length <= 1) return items.join("");
    return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  }

  function clueText(c) {
    var n = c.total;
    switch (kind(c)) {
      case "none": return "None of these digits is in the code.";
      case "inplace": return n === 1 ? "Exactly 1 digit is correct and in the correct position." : "Exactly " + n + " digits are correct and in the correct positions.";
      case "misplaced": return n === 1 ? "Exactly 1 digit is in the code but in a different position." : "Exactly " + n + " digits are in the code but in different positions.";
      default:
        return (n === 1 ? "Exactly 1 digit is correct in total," : "Exactly " + n + " digits are correct in total,") +
          (c.exact === 1 ? " of which 1 is in the correct position." : " of which " + c.exact + " are in the correct positions.");
    }
  }

  function factsText(facts) {
    var ins = [], outs = [], ats = [], notAt = {};
    facts.forEach(function (f) {
      if (f.t === "in") ins.push(String(f.d));
      else if (f.t === "out") outs.push(String(f.d));
      else if (f.t === "at") ats.push(f.d + " goes in slot " + (f.p + 1));
      else (notAt[f.d] = notAt[f.d] || []).push(f.p + 1);
    });
    var parts = [];
    if (ins.length) parts.push(joinWords(ins) + (ins.length === 1 ? " is in the code" : " are in the code"));
    if (outs.length) parts.push(joinWords(outs) + (outs.length === 1 ? " isn't in the code" : " aren't in the code"));
    parts = parts.concat(ats);
    Object.keys(notAt).forEach(function (d) {
      var slots = notAt[d].sort();
      var list = slots.length === 1 ? String(slots[0]) : slots.slice(0, -1).join(", ") + " or " + slots[slots.length - 1];
      parts.push(d + " isn't in slot" + (slots.length > 1 ? "s " : " ") + list);
    });
    return parts.join("; ");
  }

  function reasonText(r) {
    switch (r.type) {
      case "clue": return "clue " + (r.clue + 1) + " can't be true anymore";
      case "slot": return "slot " + (r.pos + 1) + " would have no digit left";
      case "digit": return r.digit + " would have nowhere to go";
      case "toomany": return "the code would need too many digits";
      default: return "there wouldn't be enough digits left to fill the code";
    }
  }

  function digitsText(ds) { return joinWords(ds.map(String)); }

  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  /** The reason for a step and what follows from it, in plain words. */
  function explainParts(step, n) {
    var so = factsText(step.facts);
    var c = step.clue + 1;
    var req = step.required;
    var sup = step.support || [];
    var already = sup.length === 1 ? sup[0] + " is already that one" : digitsText(sup) + " are already those";
    var why;
    switch (step.rule) {
      case "NONE_CLUE": why = "Clue " + c + " says none of its digits is in the code."; break;
      case "SLOT_SINGLE": why = "Only " + sup[0] + " can still go in slot " + (step.pos + 1) + "."; break;
      case "DIGIT_SINGLE": why = sup[0] + " is in the code, and slot " + (step.pos + 1) + " is the only place left for it."; break;
      case "DIGIT_NO_SLOT": why = sup[0] + " has no slot left where it could go."; break;
      case "CODE_FULL": why = "The code has " + n + " digits, and you already know " + digitsText(sup) + " are in it."; break;
      case "CODE_REMAINING": why = "The code needs " + n + " digits, and only " + digitsText(sup) + " can still be in it."; break;
      case "CONTRADICTION": why = "Suppose " + factsText([step.assumption]) + ". Then " + reasonText(step.reason) + "."; break;
      case "CLUE_ACCOUNTED":
        if (step.cat === CAT_IN_PLACE) why = req === 0 ? "Clue " + c + " has no digit in the right slot." : "Clue " + c + " has " + plural(req, "digit", "digits") + " in the right slot, and " + already + ".";
        else if (step.cat === CAT_MISPLACED) why = req === 0 ? "Clue " + c + " has no correct digit in a different slot." : "Clue " + c + " has " + plural(req, "correct digit", "correct digits") + " in a different slot, and " + already + ".";
        else why = req === 0 ? "Every digit of clue " + c + " is in the code." : "Clue " + c + " has " + plural(req, "digit that isn't", "digits that aren't") + " in the code, and " + already + ".";
        break;
      case "CLUE_FORCED": {
        var only = digitsText(sup);
        if (step.cat === CAT_IN_PLACE) why = "Clue " + c + " needs " + plural(req, "digit", "digits") + " in the right slot, and only " + only + " can still be there.";
        else if (step.cat === CAT_MISPLACED) why = "Clue " + c + " needs " + plural(req, "correct digit", "correct digits") + " in a different slot, and only " + only + " can still be " + (req === 1 ? "that one." : "those.");
        else why = "Clue " + c + " has " + plural(req, "digit that isn't", "digits that aren't") + " in the code, and only " + only + " can still be missing.";
        break;
      }
      default: why = "";
    }
    return { why: why, so: so.charAt(0).toUpperCase() + so.slice(1) + "." };
  }

  function explain(step, n) {
    var p = explainParts(step, n);
    return p.why + " So " + p.so.charAt(0).toLowerCase() + p.so.slice(1);
  }

  var api = {
    hash32: hash32, Rng: Rng, evaluate: evaluate, clueOf: clueOf, kind: kind, clueProblems: clueProblems,
    table: table, solutions: solutions, Knowledge: Knowledge, LogicSolver: LogicSolver, rate: rate,
    SPECS: SPECS, DAILY_TIERS: DAILY_TIERS, generate: generate, generateWithRetries: generateWithRetries,
    generateAt: generateAt, daily: daily, dailySeed: dailySeed, clueText: clueText, explain: explain,
    factsText: factsText, explainParts: explainParts, LEVEL: LEVEL,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CB = api;
})(typeof self !== "undefined" ? self : this);
