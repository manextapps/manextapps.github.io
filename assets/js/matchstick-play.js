var MS_HARD=[{"id":"L1","tier":"three numbers","equation":"95=19+5+10"},{"id":"L2","tier":"three numbers","equation":"19+13+5=96"},{"id":"L3","tier":"three numbers","equation":"18=8+18-15"},{"id":"L4","tier":"three numbers","equation":"18+16-8=19"},{"id":"L5","tier":"three numbers","equation":"18=9-9-19"},{"id":"L6","tier":"three numbers","equation":"16-18-15=79"},{"id":"L7","tier":"three numbers","equation":"19-19+12=58"},{"id":"L8","tier":"three numbers","equation":"59=16+18-19"},{"id":"S1","tier":"sign swaps","equation":"17-15+10=8"},{"id":"S2","tier":"sign swaps","equation":"23-19+18=14"},{"id":"S3","tier":"sign swaps","equation":"17-19+8=10"},{"id":"S4","tier":"sign swaps","equation":"6-16+9=19"},{"id":"B1","tier":"big numbers","equation":"1961=969+593"},{"id":"B2","tier":"big numbers","equation":"1893=997-696"},{"id":"B3","tier":"big numbers","equation":"1851=598+859"},{"id":"B4","tier":"big numbers","equation":"999+989=1548"},{"id":"B5","tier":"big numbers","equation":"1995=998+391"},{"id":"B6","tier":"big numbers","equation":"1993=995-958"}];
var MS_SET=[{"id":"E1","tier":"easy","equation":"5+7=5"},{"id":"E2","tier":"easy","equation":"6-7=2"},{"id":"E3","tier":"easy","equation":"0+8=3"},{"id":"E4","tier":"easy","equation":"2-2=9"},{"id":"E5","tier":"easy","equation":"8-0=3"},{"id":"E6","tier":"easy","equation":"0-4=5"},{"id":"E7","tier":"easy","equation":"1+6=5"},{"id":"E8","tier":"easy","equation":"3+9=3"},{"id":"E9","tier":"easy","equation":"6+4=5"},{"id":"E10","tier":"easy","equation":"4-4=6"},{"id":"M1","tier":"medium","equation":"3-2=6"},{"id":"M2","tier":"medium","equation":"9+7=1"},{"id":"M3","tier":"medium","equation":"2-8=6"},{"id":"M4","tier":"medium","equation":"0-8=0"},{"id":"M5","tier":"medium","equation":"7+0=1"},{"id":"M6","tier":"medium","equation":"4-5=8"},{"id":"M7","tier":"medium","equation":"0+2=6"},{"id":"M8","tier":"medium","equation":"7-5=6"},{"id":"M9","tier":"medium","equation":"8+6=0"},{"id":"M10","tier":"medium","equation":"5-4=8"},{"id":"H1","tier":"hard","equation":"3+18=15"},{"id":"H2","tier":"hard","equation":"18-19=29"},{"id":"H3","tier":"hard","equation":"11+6=3"},{"id":"H4","tier":"hard","equation":"3-13=10"},{"id":"H5","tier":"hard","equation":"3+12=17"},{"id":"H6","tier":"hard","equation":"6+13=29"},{"id":"H7","tier":"hard","equation":"3-12=19"},{"id":"H8","tier":"hard","equation":"16+0=8"},{"id":"H9","tier":"hard","equation":"2+15=15"},{"id":"H10","tier":"hard","equation":"2+18=19"}];
/* Matchstick board on /puzzles/matchstick-puzzles/ (MS_SET) and /puzzles/hardest-matchstick-puzzles/ (MS_HARD,
   picked with data-set="hard" on #ms). Needs matchstick-engine.js (window.MatchEngine).
   Tap a match to pick it up, then tap an empty spot to put it down. Any true equation counts, not only ours. */
(function () {
  "use strict";
  var root = document.getElementById("ms");
  var hard = root && root.getAttribute("data-set") === "hard";
  var SET = hard ? window.MS_HARD : window.MS_SET;
  if (!root || !window.MatchEngine || !SET) return;
  var M = window.MatchEngine, STORE = hard ? "ms-hard-solved" : "ms-solved";
  var svgWrap = root.querySelector(".ms-board");
  var msg = root.querySelector(".ms-msg");
  var title = root.querySelector(".ms-title");
  var picker = root.querySelector(".ms-pick");
  var SEG = [[142, 20, 22, 20], [156, 34, 156, 154], [156, 186, 156, 306], [142, 320, 22, 320], [8, 186, 8, 306], [8, 34, 8, 154], [142, 170, 22, 170]];
  var OP = { mid: [120, 170, 0, 170], up: [120, 140, 0, 140], low: [120, 200, 0, 200], vert: [60, 110, 60, 230] };
  var NS = "http://www.w3.org/2000/svg";
  var idx = 0, board, start, cur, lifted = null, history = [], hintLevel = 0, solvedSet = load();

  function load() { try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch (e) { return {}; } }
  function store() { try { localStorage.setItem(STORE, JSON.stringify(solvedSet)); } catch (e) {} }

  function geometry(state) {
    var x = 22, out = [], slot = 0;
    for (var i = 0; i < board.cells.length; i++) {
      var kind = board.cells[i];
      if (i) { var prev = board.cells[i - 1]; x += prev === "d" && kind === "d" ? 194 : prev === "d" ? 208 : 172; }
      if (kind === "d") {
        for (var j = 0; j < 7; j++) out.push({ slot: slot + j, s: shift(SEG[j], x) });
        slot += 7;
      } else {
        var two = state[slot] && state[slot + 1];
        [two ? OP.up : OP.mid, OP.low, OP.vert].forEach(function (s, k) { out.push({ slot: slot + k, s: shift(s, x) }); });
        slot += 3;
      }
    }
    var last = board.cells[board.cells.length - 1];
    return { sticks: out, width: x + (last === "d" ? 164 : 120) + 22 };
  }
  function shift(s, x) { return [s[0] + x, s[1] + 36, s[2] + x, s[3] + 36]; }

  function el(name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function draw() {
    var g = geometry(cur), svg = el("svg", { viewBox: "0 0 " + g.width + " 402", class: "ms-svg", role: "group", "aria-label": "Matches" });
    var without = cur.slice();
    if (lifted != null) without[lifted] = false;
    var landings = lifted != null ? board.landings(without) : [];
    var hintFrom = hintLevel >= 2 ? hintTarget().from : null, hintTo = hintLevel >= 3 ? hintTarget().to : null;
    g.sticks.forEach(function (t) {
      var s = t.s, on = cur[t.slot];
      if (!on && landings.indexOf(t.slot) < 0 && t.slot !== hintTo) return;
      var grp = el("g", { class: on ? "ms-stick" + (t.slot === lifted ? " is-lifted" : "") + (t.slot === hintFrom ? " is-hint" : "") : "ms-spot" + (t.slot === hintTo ? " is-hint" : ""),
        tabindex: "0", role: "button", "data-slot": t.slot, "aria-label": on ? "Match " + (t.slot + 1) : "Empty spot " + (t.slot + 1) });
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

  function hintTarget() {
    var sols = M.solutions(board, start);
    var best = sols[0];
    return best ? { from: best.from, to: best.to, text: best.text } : { from: null, to: null, text: "" };
  }

  function say(text, cls) { msg.textContent = text; msg.className = "ms-msg" + (cls ? " " + cls : ""); }

  function judge() {
    var used = M.used(start, cur), p = SET[idx];
    if (used === 0) { say("Pick up a match, then tap an empty spot to put it down."); return; }
    if (used > 1) { say("That's more than one match moved. Tap Undo or Reset.", "is-bad"); return; }
    var c = board.canonical(cur);
    if (board.evaluate(c) === 1) {
      root.classList.add("is-solved");
      solvedSet[p.id] = 1; store(); fillPicker();
      say("Solved: " + board.text(c).replace(/-/g, " − ").replace(/\+/g, " + ").replace(/=/g, " = ") + " is true. Tap Next for another one.", "is-ok");
      if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "match-solved-" + p.id, event: true });
      return;
    }
    var t = board.text(c);
    say(t ? "Not true yet: " + t.replace(/-/g, " − ") + " doesn't add up. Move that match again or tap Undo." : "Those matches don't spell a number or a sign. Move that match again or tap Undo.", "is-bad");
  }

  function tap(slot) {
    if (root.classList.contains("is-solved")) return;
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

  function setPuzzle(i) {
    idx = (i + SET.length) % SET.length;
    var p = SET[idx], parsed = M.parse(p.equation);
    board = parsed.board; start = parsed.state; cur = start.slice();
    lifted = null; history = []; hintLevel = 0;
    root.classList.remove("is-solved");
    title.textContent = "Puzzle " + p.id + " (" + p.tier + ")";
    picker.value = p.id;
    say("Move exactly one match to make the equation true.");
    draw();
  }

  function fillPicker() {
    var html = "", tiers = [];
    SET.forEach(function (p) { if (tiers.indexOf(p.tier) < 0) tiers.push(p.tier); });
    tiers.forEach(function (t) {
      html += '<optgroup label="' + t.charAt(0).toUpperCase() + t.slice(1) + '">';
      SET.forEach(function (p) { if (p.tier === t) html += '<option value="' + p.id + '">' + p.id + (solvedSet[p.id] ? " (solved)" : "") + "</option>"; });
      html += "</optgroup>";
    });
    var v = picker.value;
    picker.innerHTML = html;
    if (v) picker.value = v;
  }

  svgWrap.addEventListener("click", function (e) {
    var g = e.target.closest("[data-slot]");
    if (g) tap(+g.getAttribute("data-slot"));
  });
  svgWrap.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var g = e.target.closest("[data-slot]");
    if (g) { e.preventDefault(); tap(+g.getAttribute("data-slot")); }
  });
  root.querySelector("[data-undo]").addEventListener("click", function () {
    if (!history.length) return;
    cur = history.pop(); lifted = null; root.classList.remove("is-solved"); draw(); judge();
  });
  root.querySelector("[data-reset]").addEventListener("click", function () { setPuzzle(idx); });
  root.querySelector("[data-next]").addEventListener("click", function () { setPuzzle(idx + 1); });
  root.querySelector("[data-prev]").addEventListener("click", function () { setPuzzle(idx - 1); });
  root.querySelector("[data-hint]").addEventListener("click", function () {
    if (root.classList.contains("is-solved")) return;
    if (M.used(start, cur) > 0) { history.push(cur.slice()); cur = start.slice(); lifted = null; }
    hintLevel = Math.min(3, hintLevel + 1);
    var h = hintTarget(), cell = board.cellOf(h.from), toCell = board.cellOf(h.to);
    var ch = SET[idx].equation.replace(/\s/g, "")[cell];
    var name = function (c) { return c === "+" ? "the plus" : c === "-" ? "the minus" : c === "=" ? "the equals sign" : "the " + c; };
    if (hintLevel === 1) say("Hint 1: the match to move comes from " + name(ch) + ".");
    else if (hintLevel === 2) say("Hint 2: it's the highlighted match. Where could it make " + name(SET[idx].equation[toCell]) + " into something else?");
    else say("Hint 3: put it on the highlighted spot. The answer is " + h.text.replace(/-/g, " \u2212 ").replace(/\+/g, " + ").replace(/=/g, " = ") + ".");
    if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "match-hint-" + hintLevel, event: true });
    draw();
  });
  picker.addEventListener("change", function () {
    for (var i = 0; i < SET.length; i++) if (SET[i].id === picker.value) setPuzzle(i);
  });
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-ms-open]");
    if (!b) return;
    for (var i = 0; i < SET.length; i++) if (SET[i].id === b.getAttribute("data-ms-open")) setPuzzle(i);
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  fillPicker();
  var firstOpen = 0;
  for (var k = 0; k < SET.length; k++) if (!solvedSet[SET[k].id]) { firstOpen = k; break; }
  setPuzzle(firstOpen);
  root.setAttribute("data-ready", "1");
})();
