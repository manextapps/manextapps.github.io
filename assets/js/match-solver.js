/* Matchstick equation solver on /puzzles/matchstick-equation-solver/. Needs matchstick-engine.js (window.MatchEngine)
   and match-explain.js (window.MatchExplain). Every match is tried in every empty spot, and every true equation
   counts, so the list is complete for the app's rules. */
(function () {
  "use strict";
  var root = document.getElementById("mz");
  var M = window.MatchEngine, X = window.MatchExplain;
  if (!root || !M || !X) return;
  var input = root.querySelector("[name=eq]"), out = root.querySelector(".mz-out"), movesIn = root.querySelector("[name=moves]");
  var SEG = [[142, 20, 22, 20], [156, 34, 156, 154], [156, 186, 156, 306], [142, 320, 22, 320], [8, 186, 8, 306], [8, 34, 8, 154], [142, 170, 22, 170]];
  var OP = { mid: [120, 170, 0, 170], up: [120, 140, 0, 140], low: [120, 200, 0, 200], vert: [60, 110, 60, 230] };
  var MAX_CELLS = 13, SHOW = 60;
  var WORD = { "+": " plus ", "-": " minus ", "=": " equals " };

  function spoken(t) { return t.replace(/[+=-]/g, function (c) { return WORD[c]; }).replace(/\s+/g, " ").trim(); }
  function pretty(t) { return t.replace(/[+=-]/g, function (c) { return " " + (c === "-" ? "−" : c) + " "; }).replace(/\s+/g, " ").trim(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // The same layout as the play board and the app: digit cells 194 apart, signs 172 and 208.
  function svg(board, state, label, moved, gone) {
    var x = 22, slot = 0, lines = "";
    for (var i = 0; i < board.cells.length; i++) {
      var kind = board.cells[i];
      if (i) { var prev = board.cells[i - 1]; x += prev === "d" && kind === "d" ? 194 : prev === "d" ? 208 : 172; }
      var spots = kind === "d" ? SEG : [state[slot] && state[slot + 1] ? OP.up : OP.mid, OP.low, OP.vert];
      for (var j = 0; j < spots.length; j++) {
        var s = spots[j], x1 = s[0] + x, y1 = s[1] + 36, x2 = s[2] + x, y2 = s[3] + 36, at = slot + j;
        if (gone && gone.indexOf(at) >= 0) lines += '<line class="ms-gone" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
        if (!state[at]) continue;
        lines += '<g class="ms-stick' + (moved && moved.indexOf(at) >= 0 ? " ms-moved" : "") + '"><line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
          '"/><circle cx="' + x1 + '" cy="' + y1 + '" r="13"/></g>';
      }
      slot += spots.length;
    }
    var width = x + (board.cells[board.cells.length - 1] === "d" ? 164 : 120) + 22;
    return '<svg class="ms-svg" viewBox="0 0 ' + width + ' 402" role="img" aria-label="' + esc(label) + '">' + lines + "</svg>";
  }

  function render() {
    var text = input.value.replace(/[x×*÷/]/gi, "?").replace(/\s+/g, "").replace(/−/g, "-");
    var moves = movesIn.value === "2" ? 2 : 1;
    input.removeAttribute("aria-invalid");
    if (!text) { out.innerHTML = "<p>Type an equation like 5+7=2.</p>"; return; }
    if (/[^0-9+=-]/.test(text)) {
      input.setAttribute("aria-invalid", "true");
      out.innerHTML = '<p role="alert">Use only digits and the signs +, − and =. Matchstick sums here don\'t use times or divide.</p>';
      return;
    }
    if (text.length > MAX_CELLS) {
      input.setAttribute("aria-invalid", "true");
      out.innerHTML = '<p role="alert">Keep it to ' + MAX_CELLS + " digits and signs or fewer.</p>";
      return;
    }
    var p = M.parse(text), board = p.board, start = p.state;
    // Sliding a 1 to the other side of its space changes the figure but not the equation, so that's no answer.
    var sols = (moves === 2 ? M.solutions2(board, start) : M.solutions(board, start)).filter(function (s) { return s.text !== board.text(start); });
    var already = board.evaluate(start) === 1, word = moves === 1 ? "one match" : "two matches";
    var html = '<figure class="mz-start">' + svg(board, start, spoken(text) + ", made of matches") + "<figcaption>" + esc(pretty(text)) +
      (already ? ", which is already true" : "") + "</figcaption></figure>";
    if (!sols.length) {
      html += '<p class="mz-count">No true equation is ' + word + " away." + (moves === 1 ? " Try moving two matches." : "") + "</p>";
    } else {
      html += '<p class="mz-count">' + (sols.length === 1 ? "One answer" : sols.length + " answers") + " moving exactly " + word + (already ? ", besides the equation as it is" : "") + ".</p>";
      html += '<ol class="mz-list">' + sols.slice(0, SHOW).map(function (s) {
        var why = moves === 2 ? X.explain2(text, s) : X.explain(text, s);
        return "<li>" + svg(board, s.state, "Answer: " + spoken(s.text), [].concat(s.to), [].concat(s.from)) + "<p><strong>" + esc(pretty(s.text)) + "</strong>. " + esc(why) + "</p></li>";
      }).join("") + "</ol>";
      if (sols.length > SHOW) html += "<p>Showing the first " + SHOW + " of " + sols.length + ".</p>";
    }
    out.innerHTML = html;
    try { localStorage.setItem("solver:last", JSON.stringify({ eq: input.value, moves: movesIn.value })); } catch (e) {}
  }

  try {
    var last = JSON.parse(localStorage.getItem("solver:last") || "null");
    if (last && typeof last.eq === "string") { input.value = last.eq; movesIn.value = last.moves === "2" ? "2" : "1"; }
  } catch (e) {}
  var timer = null;
  // Two match searches on long equations take a moment, so say so before the page is busy.
  function soon() {
    clearTimeout(timer);
    if (movesIn.value === "2") out.setAttribute("aria-busy", "true");
    timer = setTimeout(function () { render(); out.removeAttribute("aria-busy"); }, 120);
  }
  input.addEventListener("input", soon);
  movesIn.addEventListener("change", soon);
  root.addEventListener("submit", function (e) { e.preventDefault(); render(); });
  root.querySelectorAll("[data-eq]").forEach(function (b) {
    b.addEventListener("click", function () { input.value = b.getAttribute("data-eq"); movesIn.value = b.getAttribute("data-moves") || "1"; soon(); });
  });
  render();
  root.setAttribute("data-ready", "1");
})();
