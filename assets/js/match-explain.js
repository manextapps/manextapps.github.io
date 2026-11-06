/* Plain English explanation of a one or two match move, for the matchstick solver and the build scripts
   (tools/match_explain.js). Needs matchstick-engine.js. */
(function (root) {
  "use strict";
  var M = typeof module !== "undefined" && module.exports ? require("./matchstick-engine.js") : root.MatchEngine;
  var SEG = ["top", "upper right", "lower right", "bottom", "lower left", "upper left", "middle"];
  var OPN = { "+": "plus", "-": "minus", "=": "equals sign" };
  var ORD = ["first", "second", "third", "fourth", "fifth", "sixth"];

  function ordinal(k) {
    if (ORD[k]) return ORD[k];
    var n = k + 1, t = n % 100;
    return n + (t > 10 && t < 14 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
  }
  function cellChars(board, state) {
    var out = [];
    for (var i = 0; i < board.cells.length; i++) {
      var b = board.cellBits(state, i);
      if (board.cells[i] === "d") out.push(b === 0 ? "" : String(M.DIGIT_MASKS.indexOf(b) >= 0 ? M.DIGIT_MASKS.indexOf(b) : (b === 0x30 ? 1 : "?")));
      else out.push(b === 5 ? "+" : b === 1 ? "-" : b === 3 ? "=" : "?");
    }
    return out;
  }
  // "first +" reads "the first plus", "7" reads "the 7".
  function nameOf(ch) {
    var m = /^(\w+ )?(.)$/.exec(ch), ord = m[1] || "", c = m[2];
    return "the " + ord + (OPN[c] || c);
  }
  function bare(ch) { return ch.replace(/^\w+ /, ""); }
  function becomes(ch) { return OPN[ch] ? (ch === "=" ? "an equals sign" : "a " + OPN[ch]) : (ch === "8" ? "an 8" : "a " + ch); }
  function onto(seg, ch) {
    if (seg === "middle") return "in the middle of " + nameOf(ch);
    if (seg === "top") return "on top of " + nameOf(ch);
    if (seg === "bottom") return "along the bottom of " + nameOf(ch);
    return "on the " + seg + " side of " + nameOf(ch);
  }
  function named(raw) {
    return raw.map(function (ch, i) {
      var same = [];
      raw.forEach(function (c, j) { if (c === ch) same.push(j); });
      return same.length > 1 ? ordinal(same.indexOf(i)) + " " + ch : ch;
    });
  }
  function cap(s) { return s.replace(/^t/, "T"); }

  function explain(e, sol) {
    var p = M.parse(e), board = p.board, after = cellChars(board, sol.state), before = named(cellChars(board, p.state));
    var fc = board.cellOf(sol.from), tc = board.cellOf(sol.to);
    var fseg = board.cells[fc] === "d" ? SEG[sol.from - board.offsets[fc]] : null;
    var tseg = board.cells[tc] === "d" ? SEG[sol.to - board.offsets[tc]] : null;
    if (fc === tc) {
      if (!fseg) return "Move one match of " + nameOf(before[fc]) + ", and the " + OPN[bare(before[fc])] + " becomes " + becomes(after[fc]) + ".";
      var where = tseg === "middle" ? "the middle" : tseg === "top" || tseg === "bottom" ? "the " + tseg : "its " + tseg + " side";
      return "Move the " + fseg + " match of " + nameOf(before[fc]) + " to " + where + ", and the " + bare(before[fc]) + " becomes " + becomes(after[fc]) + ".";
    }
    var from = board.cells[fc] === "d" ? "the " + fseg + " match from " + nameOf(before[fc]) : "one match from " + nameOf(before[fc]);
    var to = board.cells[tc] === "d" ? onto(tseg, before[tc]) : "on " + nameOf(before[tc]);
    return "Take " + from + " and put it " + to + ". " + cap(nameOf(before[fc])) + " becomes " + becomes(after[fc]) + " and " + nameOf(before[tc]) + " becomes " + becomes(after[tc]) + ".";
  }

  // Two match moves, each described on the starting figure, then the equation they make.
  function explain2(e, sol) {
    var p = M.parse(e), board = p.board, before = named(cellChars(board, p.state));
    function part(from, to) {
      var fc = board.cellOf(from), tc = board.cellOf(to);
      var what = board.cells[fc] === "d" ? "the " + SEG[from - board.offsets[fc]] + " match from " + nameOf(before[fc]) : "one match from " + nameOf(before[fc]);
      var where = board.cells[tc] === "d" ? onto(SEG[to - board.offsets[tc]], before[tc]) : "on " + nameOf(before[tc]);
      return what + ", and put it " + where;
    }
    var shown = sol.text.replace(/-/g, " minus ").replace(/\+/g, " plus ").replace(/=/g, " equals ");
    return "Take " + part(sol.from[0], sol.to[0]) + ". Then take " + part(sol.from[1], sol.to[1]) + ". Now it reads " + shown + ".";
  }

  var api = { explain: explain, explain2: explain2, cellChars: cellChars };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MatchExplain = api;
})(this);
