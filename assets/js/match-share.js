/* The shared puzzle on /play/matchstick/, drawn with matchstick-engine.js (window.MatchEngine) in the same layout as
   the puzzle pages. Move one and move two puzzles can be played here; add and remove puzzles are drawn and play in
   the app. share-landing.js calls window.MatchShare(equation, kind) once it has read the link. */
(function () {
  "use strict";
  var root = document.getElementById("ms");
  var M = window.MatchEngine;
  if (!root || !M) return;
  var svgWrap = root.querySelector(".ms-board"), msg = root.querySelector(".ms-msg"), tools = root.querySelector(".ms-tools");
  var SEG = [[142, 20, 22, 20], [156, 34, 156, 154], [156, 186, 156, 306], [142, 320, 22, 320], [8, 186, 8, 306], [8, 34, 8, 154], [142, 170, 22, 170]];
  var OP = { mid: [120, 170, 0, 170], up: [120, 140, 0, 140], low: [120, 200, 0, 200], vert: [60, 110, 60, 230] };
  var NS = "http://www.w3.org/2000/svg";
  var board, start, cur, lifted = null, history = [], moves = 1, playable = false, solved = false;

  function el(name, attrs) { var e = document.createElementNS(NS, name); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function shift(s, x) { return [s[0] + x, s[1] + 36, s[2] + x, s[3] + 36]; }
  function geometry(state) {
    var x = 22, out = [], slot = 0;
    for (var i = 0; i < board.cells.length; i++) {
      var kind = board.cells[i];
      if (i) { var prev = board.cells[i - 1]; x += prev === "d" && kind === "d" ? 194 : prev === "d" ? 208 : 172; }
      if (kind === "d") { for (var j = 0; j < 7; j++) out.push({ slot: slot + j, s: shift(SEG[j], x) }); slot += 7; }
      else {
        var two = state[slot] && state[slot + 1];
        [two ? OP.up : OP.mid, OP.low, OP.vert].forEach(function (s, k) { out.push({ slot: slot + k, s: shift(s, x) }); });
        slot += 3;
      }
    }
    return { sticks: out, width: x + (board.cells[board.cells.length - 1] === "d" ? 164 : 120) + 22 };
  }

  function draw() {
    var g = geometry(cur), svg = el("svg", { viewBox: "0 0 " + g.width + " 402", class: "ms-svg", role: "group", "aria-label": "Matches" });
    var without = cur.slice();
    if (lifted != null) without[lifted] = false;
    var landings = lifted != null ? board.landings(without) : [];
    g.sticks.forEach(function (t) {
      var s = t.s, on = cur[t.slot];
      if (!on && landings.indexOf(t.slot) < 0) return;
      var attrs = { class: on ? "ms-stick" + (t.slot === lifted ? " is-lifted" : "") : "ms-spot", "data-slot": t.slot };
      if (playable && !solved) { attrs.tabindex = "0"; attrs.role = "button"; attrs["aria-label"] = on ? "Match " + (t.slot + 1) : "Empty spot " + (t.slot + 1); }
      var grp = el("g", attrs);
      grp.appendChild(el("line", { class: "ms-hit", x1: s[0], y1: s[1], x2: s[2], y2: s[3] }));
      grp.appendChild(el("line", { x1: s[0], y1: s[1], x2: s[2], y2: s[3] }));
      if (on) grp.appendChild(el("circle", { cx: s[0], cy: s[1], r: 13 }));
      svg.appendChild(grp);
    });
    // Long equations scroll sideways on narrow phones instead of shrinking the matches below a tappable size.
    svg.style.minWidth = Math.round(g.width * 0.16) + "px";
    svgWrap.innerHTML = "";
    svgWrap.appendChild(svg);
  }

  function say(text, cls) { msg.textContent = text; msg.className = "ms-msg" + (cls ? " " + cls : ""); }
  function pretty(t) { return t.replace(/-/g, " − ").replace(/\+/g, " + ").replace(/=/g, " = "); }

  function judge() {
    var used = M.used(start, cur);
    if (used === 0) { say("Pick up a match, then tap an empty spot to put it down."); return; }
    if (used > moves) { say((moves === 1 ? "That's more than one match moved." : "That's more than two matches moved.") + " Tap Undo or Reset.", "is-bad"); return; }
    if (used < moves) { say("That's one match moved. This puzzle needs two, so move one more."); return; }
    var c = board.canonical(cur);
    if (board.evaluate(c) === 1) {
      solved = true;
      root.classList.add("is-solved");
      say("Solved: " + pretty(board.text(c)) + " is true. Send it back to your friend from the app, or try the puzzles on this site.", "is-ok");
      draw();
      return;
    }
    var t = board.text(c);
    say(t ? "Not true yet: " + pretty(t) + " doesn't add up. Move that match again or tap Undo." : "Those matches don't spell a number or a sign. Move that match again or tap Undo.", "is-bad");
  }

  function tap(slot) {
    if (!playable || solved) return;
    if (cur[slot]) {
      lifted = lifted === slot ? null : slot;
      if (lifted != null) say("Now tap a dashed spot to put the match there, or tap it again to put it back.");
      draw();
      return;
    }
    if (lifted == null) return;
    history.push(cur.slice());
    cur[lifted] = false; cur[slot] = true;
    cur = board.canonical(cur);
    lifted = null;
    draw();
    judge();
  }

  window.MatchShare = function (equation, kind) {
    try { var parsed = M.parse(equation); } catch (e) { return; }
    board = parsed.board; start = parsed.state; cur = start.slice();
    moves = kind === "M2" ? 2 : 1;
    playable = kind === "M1" || kind === "M2";
    root.hidden = false;
    tools.hidden = !playable;
    say(playable ? (moves === 2 ? "Move exactly two matches to make the equation true." : "Move exactly one match to make the equation true.")
      : (kind === "A1" ? "Add one match to make it true." : "Take away one match to make it true.") + " This kind of puzzle plays in the app.");
    draw();
  };

  svgWrap.addEventListener("click", function (e) { var g = e.target.closest("[data-slot]"); if (g) tap(+g.getAttribute("data-slot")); });
  svgWrap.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var g = e.target.closest("[data-slot]");
    if (g) { e.preventDefault(); tap(+g.getAttribute("data-slot")); }
  });
  root.querySelector("[data-undo]").addEventListener("click", function () {
    if (!history.length) return;
    cur = history.pop(); lifted = null; solved = false; root.classList.remove("is-solved"); draw(); judge();
  });
  root.querySelector("[data-reset]").addEventListener("click", function () {
    cur = start.slice(); history = []; lifted = null; solved = false; root.classList.remove("is-solved");
    say(moves === 2 ? "Move exactly two matches to make the equation true." : "Move exactly one match to make the equation true.");
    draw();
  });
})();
