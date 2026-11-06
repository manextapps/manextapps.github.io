/* Kalah engine and computer players, ported from the Mancala Kalah Android app (engine/Kalah.kt, Ai.kt).
   Board indexes run counterclockwise as seen by the bottom player: 0 to 5 are the bottom pits from left to
   right, 6 is the bottom store, 7 to 12 are the top pits from right to left, 13 is the top store.
   Sides: 0 bottom, 1 top. */
(function (root) {
  "use strict";

  var PITS = 6, CELLS = 14, BOTTOM_STORE = 6, TOP_STORE = 13, WIN = 1000000;

  function store(side) { return side === 0 ? BOTTOM_STORE : TOP_STORE; }
  function pitIndex(side, pit) { return side === 0 ? pit : 7 + pit; }
  function owns(side, i) { return side === 0 ? i >= 0 && i <= 6 : i >= 7 && i <= 13; }
  function opposite(i) { return 12 - i; }

  function Position(cells, toMove) { this.cells = cells; this.toMove = toMove; }
  Position.start = function (first) {
    var c = [];
    for (var i = 0; i < CELLS; i++) c.push(i === BOTTOM_STORE || i === TOP_STORE ? 0 : 4);
    return new Position(c, first || 0);
  };
  Position.prototype.sideSeeds = function (side) {
    var s = 0, f = pitIndex(side, 0);
    for (var i = f; i < f + PITS; i++) s += this.cells[i];
    return s;
  };
  Position.prototype.isOver = function () { return this.sideSeeds(0) === 0 || this.sideSeeds(1) === 0; };
  Position.prototype.legal = function () {
    if (this.isOver()) return [];
    var out = [];
    for (var p = 0; p < PITS; p++) if (this.cells[pitIndex(this.toMove, p)] > 0) out.push(p);
    return out;
  };
  Position.prototype.winner = function () {
    var a = this.cells[BOTTOM_STORE], b = this.cells[TOP_STORE];
    return a > b ? 0 : b > a ? 1 : -1;
  };

  /* Sow from pit (0 to 5 on the mover's side). Returns what happened, like the app's MoveResult. */
  Position.prototype.move = function (pit) {
    var mover = this.toMove, next = this.cells.slice(), start = pitIndex(mover, pit), seeds = next[start];
    if (this.isOver() || !seeds) throw new Error("illegal move");
    next[start] = 0;
    var skip = store(1 - mover), path = [], i = start;
    while (seeds > 0) {
      i = (i + 1) % CELLS;
      if (i === skip) continue;
      next[i]++;
      path.push(i);
      seeds--;
    }
    var captured = 0, capturedFrom = -1, freeTurn = i === store(mover);
    if (!freeTurn && owns(mover, i) && next[i] === 1 && next[opposite(i)] > 0) {
      capturedFrom = opposite(i);
      captured = next[capturedFrom] + 1;
      next[store(mover)] += captured;
      next[i] = 0;
      next[capturedFrom] = 0;
    }
    var probe = new Position(next, mover), sweptBottom = 0, sweptTop = 0;
    if (probe.isOver()) {
      sweptBottom = probe.sideSeeds(0);
      sweptTop = probe.sideSeeds(1);
      for (var k = 0; k < PITS; k++) { next[pitIndex(0, k)] = 0; next[pitIndex(1, k)] = 0; }
      next[BOTTOM_STORE] += sweptBottom;
      next[TOP_STORE] += sweptTop;
    }
    return { mover: mover, pit: pit, path: path, freeTurn: freeTurn, captured: captured, capturedFrom: capturedFrom,
      landing: i, sweptBottom: sweptBottom, sweptTop: sweptTop, after: new Position(next, freeTurn ? mover : 1 - mover) };
  };

  function evaluate(pos, me) {
    if (pos.isOver()) {
      var d = pos.cells[store(me)] - pos.cells[store(1 - me)];
      return d === 0 ? 0 : WIN * Math.sign(d) + d;
    }
    return (pos.cells[store(me)] - pos.cells[store(1 - me)]) * 4 + pos.sideSeeds(me) - pos.sideSeeds(1 - me);
  }

  /* Free turns first, then captures, then the rest from the store side. */
  function ordered(pos, legal) {
    if (legal.length <= 1) return legal;
    var side = pos.toMove;
    function key(pit) {
      var seeds = pos.cells[pitIndex(side, pit)], dist = PITS - pit;
      if (seeds === dist) return 100 + pit;
      if (seeds < dist && pos.cells[pitIndex(side, pit + seeds)] === 0) return 50 + pit;
      return pit;
    }
    return legal.slice().sort(function (a, b) { return key(b) - key(a); });
  }

  function OutOfTime() {}

  function search(pos, me, depth, alpha, beta, deadline) {
    if (deadline && (++deadline.nodes & 1023) === 0 && Date.now() > deadline.at) throw new OutOfTime();
    if (depth <= 0 || pos.isOver()) return evaluate(pos, me);
    var moves = ordered(pos, pos.legal()), best, i, r, v;
    if (pos.toMove === me) {
      best = -Infinity;
      for (i = 0; i < moves.length; i++) {
        r = pos.move(moves[i]);
        // A free turn costs no depth, so chains of extra moves are followed to the end.
        v = search(r.after, me, r.freeTurn ? depth : depth - 1, alpha, beta, deadline);
        if (v > best) best = v;
        if (best > alpha) alpha = best;
        if (alpha >= beta) break;
      }
    } else {
      best = Infinity;
      for (i = 0; i < moves.length; i++) {
        r = pos.move(moves[i]);
        v = search(r.after, me, r.freeTurn ? depth : depth - 1, alpha, beta, deadline);
        if (v < best) best = v;
        if (best < beta) beta = best;
        if (alpha >= beta) break;
      }
    }
    return best;
  }

  function easy(pos, rnd) {
    var legal = pos.legal(), free = legal.filter(function (p) { return pos.move(p).freeTurn; });
    if (free.length && rnd() * 100 < 45) return free[Math.floor(rnd() * free.length)];
    return legal[Math.floor(rnd() * legal.length)];
  }

  function medium(pos, rnd) {
    var me = pos.toMove, best = -Infinity, bestMoves = [];
    pos.legal().forEach(function (pit) {
      var v = search(pos.move(pit).after, me, 1, -Infinity, Infinity, null);
      if (v > best) { best = v; bestMoves = []; }
      if (v === best) bestMoves.push(pit);
    });
    return bestMoves[Math.floor(rnd() * bestMoves.length)];
  }

  /* Alpha beta with iterative deepening inside the time budget, like the app's Hard level. */
  function hard(pos, budgetMs, maxDepth) {
    var me = pos.toMove, legal = pos.legal();
    if (legal.length === 1) return { pit: legal[0], depth: 0, score: 0 };
    var deadline = budgetMs ? { at: Date.now() + budgetMs, nodes: 0 } : null;
    var order = ordered(pos, legal), result = { pit: order[0], depth: 0, score: 0 };
    for (var depth = 1; depth <= (maxDepth || 40); depth++) {
      var alpha = -Infinity, bestPit = -1, scores = {};
      try {
        for (var i = 0; i < order.length; i++) {
          var v = search(pos.move(order[i]).after, me, depth - 1, alpha, Infinity, deadline);
          scores[order[i]] = v;
          if (v > alpha) { alpha = v; bestPit = order[i]; }
        }
      } catch (e) {
        if (e instanceof OutOfTime) break;
        throw e;
      }
      result = { pit: bestPit, depth: depth, score: alpha };
      if (alpha >= WIN / 2 || alpha <= -WIN / 2) break;
      order = order.slice().sort(function (a, b) { return scores[b] - scores[a]; });
    }
    return result;
  }

  function choose(pos, level, rnd) {
    rnd = rnd || Math.random;
    if (level === "easy") return easy(pos, rnd);
    if (level === "medium") return medium(pos, rnd);
    return hard(pos, 600).pit;
  }

  var api = { PITS: PITS, BOTTOM_STORE: BOTTOM_STORE, TOP_STORE: TOP_STORE, Position: Position, pitIndex: pitIndex, store: store,
    opposite: opposite, evaluate: evaluate, hard: hard, choose: choose };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MancalaEngine = api;
})(this);
