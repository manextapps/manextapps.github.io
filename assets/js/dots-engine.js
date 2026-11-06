/* Dots and boxes engine and computer players, ported from the Dots and Boxes Android app (engine/Geometry.kt,
   Game.kt, ComputerPlayer.kt). An n x n box board numbers its horizontal lines first, row by row, then the
   vertical ones. A position is a BigInt with one bit per drawn line, like the app's Long. */
(function (root) {
  "use strict";

  var ONE = BigInt(1), ZERO = BigInt(0);
  function bit(e) { return ONE << BigInt(e); }
  function popcount(x) {
    var n = 0;
    while (x) { x &= x - ONE; n++; }
    return n;
  }

  var cache = {};
  function Geometry(n) {
    if (cache[n]) return cache[n];
    var g = this;
    g.n = n; g.boxCount = n * n; g.horizontalCount = (n + 1) * n; g.edgeCount = 2 * n * (n + 1);
    g.allEdges = (ONE << BigInt(g.edgeCount)) - ONE;
    g.h = function (r, c) { return r * n + c; };
    g.v = function (r, c) { return g.horizontalCount + r * (n + 1) + c; };
    g.isHorizontal = function (e) { return e < g.horizontalCount; };
    g.edgeStart = function (e) {
      if (e < g.horizontalCount) return [Math.floor(e / n), e % n];
      var i = e - g.horizontalCount;
      return [Math.floor(i / (n + 1)), i % (n + 1)];
    };
    g.boxEdges = [];
    for (var b = 0; b < g.boxCount; b++) {
      var r = Math.floor(b / n), c = b % n;
      g.boxEdges.push([g.h(r, c), g.h(r + 1, c), g.v(r, c), g.v(r, c + 1)]);
    }
    g.edgeBoxes = [];
    for (var e = 0; e < g.edgeCount; e++) {
      var s = g.edgeStart(e), out = [];
      if (g.isHorizontal(e)) { if (s[0] > 0) out.push((s[0] - 1) * n + s[1]); if (s[0] < n) out.push(s[0] * n + s[1]); }
      else { if (s[1] > 0) out.push(s[0] * n + s[1] - 1); if (s[1] < n) out.push(s[0] * n + s[1]); }
      g.edgeBoxes.push(out);
    }
    g.boxMask = g.boxEdges.map(function (es) { return es.reduce(function (m, x) { return m | bit(x); }, ZERO); });
    g.sides = function (lines, box) { return popcount(lines & g.boxMask[box]); };
    g.isDrawn = function (lines, e) { return (lines & bit(e)) !== ZERO; };
    g.closes = function (lines, e) { return g.edgeBoxes[e].filter(function (b) { return g.sides(lines, b) === 3; }); };
    cache[n] = g;
  }
  function geometry(n) { return cache[n] || new Geometry(n); }

  function freeEdges(g, lines) { var o = []; for (var e = 0; e < g.edgeCount; e++) if (!g.isDrawn(lines, e)) o.push(e); return o; }
  function captureEdges(g, lines) {
    return freeEdges(g, lines).filter(function (e) { return g.edgeBoxes[e].some(function (b) { return g.sides(lines, b) === 3; }); });
  }
  function safeEdges(g, lines) {
    return freeEdges(g, lines).filter(function (e) { return g.edgeBoxes[e].every(function (b) { return g.sides(lines, b) < 2; }); });
  }
  /* Takes every box that can be taken, again and again, as one long run of captures. */
  function closure(g, lines) {
    var cur = lines, count = 0;
    for (;;) {
      var box = -1;
      for (var b = 0; b < g.boxCount; b++) if (g.sides(cur, b) === 3) { box = b; break; }
      if (box < 0) break;
      var edge = g.boxEdges[box].filter(function (e) { return !g.isDrawn(cur, e); })[0];
      count += g.closes(cur, edge).length;
      cur = cur | bit(edge);
    }
    return { lines: cur, count: count };
  }

  /* ---- a game: closing a box keeps the turn, any other line passes it ---- */
  function Game(n, first) {
    var g = geometry(n);
    this.g = g; this.lines = ZERO; this.turn = first; this.scores = [0, 0];
    this.boxOwner = new Array(g.boxCount).fill(-1); this.edgeOwner = new Array(g.edgeCount).fill(-1); this.moves = []; this.movers = [];
  }
  Game.prototype.finished = function () { return this.lines === this.g.allEdges; };
  Game.prototype.play = function (e) {
    var g = this.g, next = Object.create(Game.prototype);
    var closed = g.closes(this.lines, e), turn = this.turn;
    next.g = g; next.lines = this.lines | bit(e);
    next.scores = this.scores.slice(); next.boxOwner = this.boxOwner.slice(); next.edgeOwner = this.edgeOwner.slice();
    next.edgeOwner[e] = turn;
    closed.forEach(function (b) { next.boxOwner[b] = turn; next.scores[turn]++; });
    next.moves = this.moves.concat(e); next.movers = this.movers.concat(turn);
    next.turn = closed.length ? turn : 1 - turn;
    next.lastClosed = closed;
    return next;
  };

  /* ---- computer players (ComputerPlayer.kt) ---- */
  var SEARCH_SAFE_LIMIT = 20, MEMO_LIMIT = 100000;

  function Computer(rnd, timeBudgetMs, nodeBudget) {
    this.rnd = rnd || Math.random;
    this.timeBudgetMs = timeBudgetMs || 450;
    this.nodeBudget = nodeBudget || 250000;
    this.memos = {};
    this.openMemo = {};
  }
  Computer.prototype.pick = function (list) { return list[Math.floor(this.rnd() * list.length)]; };
  Computer.prototype.pickBest = function (options, score) {
    var best = -Infinity, top = [];
    options.forEach(function (o) { var s = score(o); if (s > best) { best = s; top = []; } if (s === best) top.push(o); });
    return this.pick(top);
  };
  Computer.prototype.easy = function (g, lines, free) {
    var cap = captureEdges(g, lines);
    if (cap.length && this.rnd() < 0.5) return this.pick(cap);
    var safe = safeEdges(g, lines);
    if (safe.length && this.rnd() < 0.75) return this.pick(safe);
    return this.pick(free);
  };
  Computer.prototype.medium = function (g, lines, free) {
    var cap = captureEdges(g, lines);
    if (cap.length) return this.pick(cap);
    var safe = safeEdges(g, lines);
    if (safe.length) return this.pick(safe);
    return this.pickBest(free, function (e) { return -closure(g, lines | bit(e)).count; });
  };
  Computer.prototype.choose = function (g, lines, level) {
    var free = freeEdges(g, lines);
    var e = level === "easy" ? this.easy(g, lines, free) : level === "medium" ? this.medium(g, lines, free) : new Search(this, g).hard(lines, free);
    return free.indexOf(e) >= 0 ? e : this.pick(free);
  };
  /* Chain and loop lengths of a quiet position, or null when it branches. */
  Computer.prototype.components = function (g, lines) { return new Search(this, g).components(lines); };
  Computer.prototype.openingValue = function (chains, loops) { return new Search(this, geometry(3)).open(chains.slice().sort(num), loops.slice().sort(num)); };
  function num(a, b) { return a - b; }

  function Abort() {}

  function Search(cp, g) {
    this.cp = cp; this.g = g;
    var m = cp.memos[g.n];
    if (!m || m.size >= MEMO_LIMIT) { m = new Map(); cp.memos[g.n] = m; }
    this.memo = m;
  }
  Search.prototype.tick = function () {
    var cp = this.cp;
    cp.nodes++;
    if (cp.nodes > cp.nodeBudget || ((cp.nodes & 255) === 0 && Date.now() > cp.deadline)) throw new Abort();
  };
  Search.prototype.hard = function (lines, free) {
    var cp = this.cp, g = this.g, self = this;
    cp.deadline = Date.now() + cp.timeBudgetMs;
    cp.nodes = 0;
    var captures = captureEdges(g, lines);
    if (captures.length) return this.capture(lines, captures);
    var safe = safeEdges(g, lines);
    try {
      if (safe.length) {
        if (safe.length > SEARCH_SAFE_LIMIT) return cp.pick(safe);
        var sacrifices = free.filter(function (e) { return safe.indexOf(e) < 0; }), best = -Infinity, top = [];
        safe.forEach(function (e) {
          var v = -self.evalQuiet(lines | bit(e));
          if (v > best) { best = v; top = []; }
          if (v === best) top.push(e);
        });
        // A sacrifice can win back control when every safe line loses it; try them only with time left.
        try {
          sacrifices.forEach(function (e) {
            var v = -self.evalCapture(lines | bit(e));
            if (v > best) { best = v; top = [e]; }
          });
        } catch (x) { if (!(x instanceof Abort)) throw x; }
        return cp.pick(top);
      }
      return cp.pickBest(free, function (e) { return -self.evalCapture(lines | bit(e)); });
    } catch (x) {
      if (!(x instanceof Abort)) throw x;
      return cp.medium(g, lines, free);
    }
  };
  /* Boxes are on offer: take them, or stop two (chain) or four (loop) short to keep control. */
  Search.prototype.capture = function (lines, captures) {
    var g = this.g, cp = this.cp, after = closure(g, lines), rest;
    if (after.lines === g.allEdges || safeEdges(g, after.lines).length) return cp.pick(captures);
    try { rest = this.evalQuiet(after.lines); } catch (x) { if (x instanceof Abort) return cp.pick(captures); throw x; }
    var deal = null;
    this.loosePieces(lines, after.lines).forEach(function (p) { if (p.dealSize > 0 && (!deal || p.dealSize < deal.dealSize)) deal = p; });
    if (!deal || after.count - 2 * deal.dealSize - rest <= after.count + rest) return cp.pick(captures);
    var elsewhere = captures.filter(function (e) { return g.edgeBoxes[e].every(function (b) { return deal.boxes.indexOf(b) < 0; }); });
    if (elsewhere.length) return cp.pick(elsewhere);
    if (deal.boxes.length > deal.dealSize) return this.missingEdge(lines, deal.boxes[0]);
    return deal.dealMove;
  };
  /* Net boxes for the player to move from a position where nothing can be taken right now. */
  Search.prototype.evalQuiet = function (lines) {
    var g = this.g;
    if (lines === g.allEdges) return 0;
    var hit = this.memo.get(lines);
    if (hit !== undefined) return hit;
    this.tick();
    var safe = safeEdges(g, lines), value;
    if (safe.length) {
      value = -Infinity;
      for (var i = 0; i < safe.length; i++) value = Math.max(value, -this.evalQuiet(lines | bit(safe[i])));
    } else value = this.loony(lines);
    this.memo.set(lines, value);
    return value;
  };
  /* Net boxes for the player to move when some boxes can be taken. */
  Search.prototype.evalCapture = function (lines) {
    this.tick();
    var g = this.g, after = closure(g, lines);
    if (after.lines === g.allEdges) return after.count;
    var rest = this.evalQuiet(after.lines), takeAll = after.count + rest;
    if (safeEdges(g, after.lines).length) return takeAll;
    var deal = Infinity;
    this.loosePieces(lines, after.lines).forEach(function (p) { if (p.dealSize > 0) deal = Math.min(deal, p.dealSize); });
    if (deal === Infinity) return takeAll;
    return Math.max(takeAll, after.count - 2 * deal - rest);
  };
  Search.prototype.loony = function (lines) {
    var parts = this.components(lines);
    if (parts) return this.open(parts[0], parts[1]);
    var best = -Infinity, free = freeEdges(this.g, lines);
    for (var i = 0; i < free.length; i++) best = Math.max(best, -this.evalCapture(lines | bit(free[i])));
    return best;
  };
  /* The value for the player who has to open one of these chains and loops (the app's exact formula). */
  Search.prototype.open = function (chains, loops) {
    if (!chains.length && !loops.length) return 0;
    var key = chains.join(",") + "|" + loops.join(","), memo = this.cp.openMemo;
    if (memo[key] !== undefined) return memo[key];
    var best = -Infinity, i, c, rest, other;
    for (i = 0; i < chains.length; i++) {
      if (i > 0 && chains[i] === chains[i - 1]) continue;
      c = chains[i];
      rest = this.open(chains.filter(function (_, j) { return j !== i; }), loops);
      other = c <= 2 ? c + rest : Math.max(c + rest, c - 4 - rest);
      best = Math.max(best, -other);
    }
    for (i = 0; i < loops.length; i++) {
      if (i > 0 && loops[i] === loops[i - 1]) continue;
      c = loops[i];
      rest = this.open(chains, loops.filter(function (_, j) { return j !== i; }));
      best = Math.max(best, -Math.max(c + rest, c - 8 - rest));
    }
    if (Object.keys(memo).length > MEMO_LIMIT) this.cp.openMemo = memo = {};
    memo[key] = best;
    return best;
  };
  /* Sorted chain and loop lengths, or null when some box joins three or more strings. */
  Search.prototype.components = function (lines) {
    var g = this.g, parent = [], ground = [], b, e;
    for (b = 0; b < g.boxCount; b++) { parent.push(b); ground.push(0); }
    function find(x) { while (parent[x] !== x) x = parent[x]; return x; }
    for (b = 0; b < g.boxCount; b++) {
      var sides = g.sides(lines, b);
      if (sides === 4) continue;
      if (sides !== 2) return null;
      for (var k = 0; k < 4; k++) {
        e = g.boxEdges[b][k];
        if (g.isDrawn(lines, e)) continue;
        var boxes = g.edgeBoxes[e];
        if (boxes.length === 1) ground[b]++;
        else parent[find(b)] = find(boxes[0] === b ? boxes[1] : boxes[0]);
      }
    }
    var size = {}, grounds = {};
    for (b = 0; b < g.boxCount; b++) {
      if (g.sides(lines, b) === 4) continue;
      var r = find(b);
      size[r] = (size[r] || 0) + 1;
      grounds[r] = (grounds[r] || 0) + ground[b];
    }
    var chains = [], loops = [];
    Object.keys(size).forEach(function (rt) { (grounds[rt] === 0 ? loops : chains).push(size[rt]); });
    return [chains.sort(num), loops.sort(num)];
  };
  Search.prototype.innerNeighbours = function (lines, box, within) {
    var g = this.g, out = [];
    g.boxEdges[box].forEach(function (e) {
      if (g.isDrawn(lines, e)) return;
      var o = g.edgeBoxes[e].filter(function (x) { return x !== box && within.has(x); })[0];
      if (o !== undefined) out.push(o);
    });
    return out;
  };
  Search.prototype.loosePieces = function (lines, closed) {
    var g = this.g, loose = new Set(), seen = new Set(), pieces = [], self = this;
    for (var b = 0; b < g.boxCount; b++) if (g.sides(lines, b) < 4 && g.sides(closed, b) === 4) loose.add(b);
    loose.forEach(function (start) {
      if (seen.has(start)) return;
      seen.add(start);
      var group = [start];
      for (var i = 0; i < group.length; i++) {
        self.innerNeighbours(lines, group[i], loose).forEach(function (nx) { if (!seen.has(nx)) { seen.add(nx); group.push(nx); } });
      }
      pieces.push(self.piece(lines, new Set(group), loose));
    });
    return pieces;
  };
  Search.prototype.piece = function (lines, boxes, loose) {
    var g = this.g, self = this, list = Array.from(boxes), none = { boxes: list, dealSize: 0, dealMove: -1 };
    if (boxes.size < 2) return none;
    var degree = {};
    list.forEach(function (b) { degree[b] = self.innerNeighbours(lines, b, boxes).length; });
    var ends = list.filter(function (b) { return degree[b] === 1; });
    if (ends.length !== 2 || list.some(function (b) { return degree[b] > 2; }) || list.some(function (b) { return g.sides(lines, b) < 2; })) return none;
    var takeable = ends.filter(function (b) { return g.sides(lines, b) === 3; });
    if (!takeable.length) return none;
    var path = [takeable[0]];
    while (path.length < boxes.size) {
      path.push(self.innerNeighbours(lines, path[path.length - 1], boxes).filter(function (x) { return path.indexOf(x) < 0; })[0]);
    }
    if (path.slice(1, -1).some(function (b) { return g.sides(lines, b) !== 2; })) return none;
    if (takeable.length === 1 && g.sides(lines, path[path.length - 1]) === 2) {
      var last = path[path.length - 1], shared = this.sharedEdge(path[path.length - 2], last);
      var far = g.boxEdges[last].filter(function (e) { return !g.isDrawn(lines, e) && e !== shared; })[0];
      // The far line must not close anything outside this piece by itself.
      if (g.edgeBoxes[far].some(function (x) { return x !== last && !loose.has(x) && g.sides(lines, x) === 3; })) return none;
      return { boxes: path, dealSize: 2, dealMove: far };
    }
    if (takeable.length === 2 && path.length >= 4) {
      return { boxes: path, dealSize: 4, dealMove: this.sharedEdge(path[Math.floor(path.length / 2) - 1], path[Math.floor(path.length / 2)]) };
    }
    return none;
  };
  Search.prototype.sharedEdge = function (a, b) { var eb = this.g.boxEdges[b]; return this.g.boxEdges[a].filter(function (e) { return eb.indexOf(e) >= 0; })[0]; };
  Search.prototype.missingEdge = function (lines, box) { var g = this.g; return g.boxEdges[box].filter(function (e) { return !g.isDrawn(lines, e); })[0]; };

  var api = { geometry: geometry, bit: bit, Game: Game, Computer: Computer, freeEdges: freeEdges, captureEdges: captureEdges,
    safeEdges: safeEdges, closure: closure };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DotsEngine = api;
})(this);
