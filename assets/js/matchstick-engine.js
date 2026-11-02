/* Matchstick equation engine, ported from the Matchstick Puzzle Android app (engine/EquationBoard, Puzzle).
   A board is a row of cells: digits have 7 segment slots (a top, b upper right, c lower right, d bottom,
   e lower left, f upper left, g middle), operators have 3 slots (0 and 1 horizontal, 2 vertical).
   One horizontal is minus, horizontal plus vertical is plus, two horizontals are equals.
   Solving is checked against the rules, never against a stored answer, so every correct figure counts. */
(function (root) {
  "use strict";

  var DIGIT_MASKS = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];
  var LEFT_ONE = 0x30;
  var DIGIT_OF = {};
  DIGIT_MASKS.forEach(function (m, d) { DIGIT_OF[m] = d; });
  DIGIT_OF[LEFT_ONE] = 1;
  var OP_OF = { 1: "-", 5: "+", 3: "=" };

  function parse(text) {
    var cells = [], bits = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch >= "0" && ch <= "9") { cells.push("d"); bits.push(DIGIT_MASKS[+ch]); }
      else if (ch === "+") { cells.push("o"); bits.push(5); }
      else if (ch === "-" || ch === "−") { cells.push("o"); bits.push(1); }
      else if (ch === "=") { cells.push("o"); bits.push(3); }
      else if (ch !== " ") throw new Error("bad character " + ch);
    }
    var board = new Board(cells), state = [];
    cells.forEach(function (c, k) {
      var n = c === "d" ? 7 : 3;
      for (var j = 0; j < n; j++) state.push(!!(bits[k] & (1 << j)));
    });
    return { board: board, state: state };
  }

  function Board(cells) {
    this.cells = cells;
    this.offsets = [];
    var at = 0;
    for (var i = 0; i < cells.length; i++) { this.offsets.push(at); at += cells[i] === "d" ? 7 : 3; }
    this.slotCount = at;
  }
  Board.prototype.cellOf = function (slot) {
    for (var i = this.offsets.length - 1; i >= 0; i--) if (this.offsets[i] <= slot) return i;
    return 0;
  };
  Board.prototype.cellBits = function (state, i) {
    var n = this.cells[i] === "d" ? 7 : 3, b = 0;
    for (var j = 0; j < n; j++) if (state[this.offsets[i] + j]) b |= 1 << j;
    return b;
  };
  /* Operator cells arrange their matches by count: a lone horizontal always sits in slot 0. */
  Board.prototype.canonical = function (state) {
    var out = state.slice();
    for (var i = 0; i < this.cells.length; i++) {
      if (this.cells[i] !== "o") continue;
      var o = this.offsets[i];
      if (!out[o] && out[o + 1]) { out[o] = true; out[o + 1] = false; }
    }
    return out;
  };
  Board.prototype.landings = function (state) {
    var out = [];
    for (var s = 0; s < this.slotCount; s++) {
      if (state[s]) continue;
      var c = this.cellOf(s);
      if (this.cells[c] === "o" && s - this.offsets[c] === 1 && !state[s - 1]) continue;
      out.push(s);
    }
    return out;
  };
  Board.prototype.text = function (state) {
    var t = "";
    for (var i = 0; i < this.cells.length; i++) {
      var b = this.cellBits(state, i);
      if (this.cells[i] === "d") {
        if (b === 0) continue;
        if (!(b in DIGIT_OF)) return null;
        t += DIGIT_OF[b];
      } else {
        if (!(b in OP_OF)) return null;
        t += OP_OF[b];
      }
    }
    return t;
  };
  /* 1 true, 0 false, -1 not a valid equation */
  Board.prototype.evaluate = function (state) {
    var left = 0, right = 0, onRight = false, sign = 1, equals = 0, number = 0, digits = 0, gap = false;
    for (var i = 0; i < this.cells.length; i++) {
      var b = this.cellBits(state, i);
      if (this.cells[i] === "d") {
        if (b === 0) { if (digits > 0) gap = true; continue; }
        if (!(b in DIGIT_OF)) return -1;
        if (gap) return -1;
        if (digits === 1 && number === 0) return -1;
        number = number * 10 + DIGIT_OF[b];
        digits++;
      } else {
        if (digits === 0) return -1;
        if (onRight) right += sign * number; else left += sign * number;
        number = 0; digits = 0; gap = false;
        var op = OP_OF[b];
        if (op === "=") { if (++equals > 1) return -1; onRight = true; sign = 1; }
        else if (op === "+") sign = 1;
        else if (op === "-") sign = -1;
        else return -1;
      }
    }
    if (digits === 0 || equals !== 1) return -1;
    if (onRight) right += sign * number; else left += sign * number;
    return left === right ? 1 : 0;
  };
  Board.prototype.isPlain = function (state) {
    for (var i = 0; i < this.cells.length; i++) {
      if (this.cells[i] !== "d") continue;
      var b = this.cellBits(state, i);
      if (b !== 0 && DIGIT_MASKS.indexOf(b) < 0) return false;
    }
    return true;
  };

  function key(state) { return state.map(function (x) { return x ? 1 : 0; }).join(""); }

  /* Every figure reachable by moving exactly one match that makes a true equation. */
  function solutions(board, start) {
    var found = {}, out = [];
    for (var a = 0; a < board.slotCount; a++) {
      if (!start[a]) continue;
      for (var b = 0; b < board.slotCount; b++) {
        if (start[b] || b === a) continue;
        var s = start.slice();
        s[a] = false; s[b] = true;
        s = board.canonical(s);
        if (key(s) === key(start)) continue;
        if (board.evaluate(s) !== 1) continue;
        var k = key(s);
        if (!found[k]) { found[k] = true; out.push({ state: s, from: a, to: b, text: board.text(s) }); }
      }
    }
    return out;
  }

  function used(start, state) {
    var n = 0;
    for (var i = 0; i < start.length; i++) if (start[i] && !state[i]) n++;
    return n;
  }

  function isSolved(board, start, state) {
    var n = used(start, state);
    return n === 1 && board.evaluate(board.canonical(state)) === 1;
  }

  var api = { parse: parse, Board: Board, solutions: solutions, isSolved: isSolved, used: used, DIGIT_MASKS: DIGIT_MASKS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MatchEngine = api;
})(this);
