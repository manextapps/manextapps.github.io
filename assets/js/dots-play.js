/* Dots and boxes against the computer on /puzzles/dots-and-boxes-strategy/, plus the endgame practice.
   Needs dots-engine.js (window.DotsEngine). Like the app: closing a box gives you another line, Undo goes
   back to just before your last line, and the computer's levels are the app's Easy, Medium and Hard. */
(function () {
  "use strict";
  var D = window.DotsEngine;
  if (!D) return;

  // The practice questions come after this script in the page, so their taps are caught at the document.
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".dt-q [data-choice]");
    if (!b) return;
    var q = b.closest(".dt-q"), out = q.querySelector(".dt-q-out"), right = b.getAttribute("data-choice") === q.getAttribute("data-answer");
    q.querySelectorAll("[data-choice]").forEach(function (x) { x.classList.remove("right", "wrong"); });
    b.classList.add(right ? "right" : "wrong");
    out.textContent = right ? "Right. Open the answer for the count." : "Not this time. Open the answer to see the count.";
  });

  var root = document.getElementById("dt");
  if (!root) return;
  var svgWrap = root.querySelector(".dt-live");
  var msgEl = root.querySelector(".dt-msg");
  var statusEl = root.querySelector(".dt-status");
  var cp = new D.Computer();
  var size = 4, level = "medium", first = 0, game, busy = false, timer = null, S = 60, P = 16;

  function store(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null");
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      return null;
    }
  }

  function ends(e) {
    var g = game.g, s = g.edgeStart(e);
    return g.isHorizontal(e) ? [s[1], s[0], s[1] + 1, s[0]] : [s[1], s[0], s[1], s[0] + 1];
  }

  function label(e) {
    var s = game.g.edgeStart(e);
    return (game.g.isHorizontal(e) ? "Line across from dot " : "Line down from dot ") + "row " + (s[0] + 1) + ", column " + (s[1] + 1);
  }

  function render() {
    var g = game.g, n = g.n, w = n * S + 2 * P, last = game.moves[game.moves.length - 1], html = "";
    html += '<svg class="dt-svg" viewBox="0 0 ' + w + " " + w + '" role="group" aria-label="Dots and boxes board">';
    for (var b = 0; b < g.boxCount; b++) {
      var o = game.boxOwner[b];
      if (o < 0) continue;
      var r = Math.floor(b / n), c = b % n;
      html += '<rect class="dt-box p' + o + '" x="' + (P + c * S + 4) + '" y="' + (P + r * S + 4) + '" width="' + (S - 8) + '" height="' + (S - 8) + '" rx="6"/>' +
        '<text class="dt-t" x="' + (P + c * S + S / 2) + '" y="' + (P + r * S + S / 2 + 7) + '">' + (o === 0 ? "You" : "CPU") + "</text>";
    }
    var mine = game.turn === 0 && !busy && !game.finished();
    for (var e = 0; e < g.edgeCount; e++) {
      var p = ends(e), on = g.isDrawn(game.lines, e);
      var x1 = P + p[0] * S, y1 = P + p[1] * S, x2 = P + p[2] * S, y2 = P + p[3] * S;
      var cls = on ? "dt-l on p" + game.edgeOwner[e] + (e === last ? " last" : "") : "dt-l";
      html += on ? '<line class="' + cls + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>' :
        '<g class="dt-free" data-edge="' + e + '"' + (mine ? ' tabindex="0" role="button" aria-label="' + label(e) + '"' : "") + ">" +
        '<line class="dt-hit" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/><line class="' + cls + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/></g>';
    }
    for (var rr = 0; rr <= n; rr++) for (var cc = 0; cc <= n; cc++) html += '<circle class="dt-dot" cx="' + (P + cc * S) + '" cy="' + (P + rr * S) + '" r="5"/>';
    svgWrap.innerHTML = html + "</svg>";
    statusEl.textContent = "You " + game.scores[0] + ", computer " + game.scores[1] + ".";
    root.querySelector("[data-undo]").disabled = busy || game.movers.indexOf(0) < 0;
  }

  function say(t) { msgEl.textContent = t; }

  function finish() {
    var a = game.scores[0], b = game.scores[1];
    say("Game over: " + a + " to " + b + ". " + (a > b ? "You win." : b > a ? "The computer wins." : "It's a draw."));
    if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "dots-finished-" + size + "-" + level + (a > b ? "-won" : ""), event: true });
  }

  function play(e) {
    if (busy || game.turn !== 0 || game.finished() || game.g.isDrawn(game.lines, e)) return;
    game = game.play(e);
    var took = game.lastClosed.length;
    render();
    if (game.finished()) { finish(); return; }
    if (took) { say("You closed " + (took === 1 ? "a box" : "two boxes") + ". Draw another line."); focusFree(); return; }
    computer(0);
  }

  function focusFree() {
    var f = svgWrap.querySelector(".dt-free[tabindex]");
    if (f && document.activeElement && document.activeElement.closest && document.activeElement.closest(".dt-live")) f.focus();
  }

  // The computer keeps drawing while it closes boxes; its whole turn is described at once.
  function computer(taken) {
    busy = true;
    render();
    timer = setTimeout(function () {
      game = game.play(cp.choose(game.g, game.lines, level));
      taken += game.lastClosed.length;
      busy = false;
      if (game.finished()) { render(); finish(); return; }
      if (game.turn === 1) { computer(taken); return; }
      render();
      say(taken ? "The computer took " + (taken === 1 ? "1 box" : taken + " boxes") + ". Your line." : "Your line.");
      focusFree();
    }, level === "hard" ? 60 : 350);
  }

  function newGame() {
    clearTimeout(timer);
    busy = false;
    game = new D.Game(size, first);
    render();
    say(first === 0 ? "Your line. Tap between two dots that sit next to each other." : "The computer starts.");
    if (first === 1) computer(0);
    root.setAttribute("data-ready", "1");
  }

  function opts() {
    root.querySelectorAll("[data-size]").forEach(function (b) { b.setAttribute("aria-pressed", String(Number(b.getAttribute("data-size")) === size)); });
    root.querySelectorAll("[data-level]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-level") === level)); });
    root.querySelectorAll("[data-first]").forEach(function (b) { b.setAttribute("aria-pressed", String(Number(b.getAttribute("data-first")) === first)); });
    store("dots:settings", { size: size, level: level, first: first });
  }

  svgWrap.addEventListener("click", function (e) {
    var g = e.target.closest("[data-edge]");
    if (g) play(Number(g.getAttribute("data-edge")));
  });
  svgWrap.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var g = e.target.closest("[data-edge]");
    if (g) { e.preventDefault(); play(Number(g.getAttribute("data-edge"))); }
  });
  root.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-size")) { size = Number(b.getAttribute("data-size")); opts(); newGame(); }
    else if (b.hasAttribute("data-level")) { level = b.getAttribute("data-level"); opts(); newGame(); }
    else if (b.hasAttribute("data-first")) { first = Number(b.getAttribute("data-first")); opts(); newGame(); }
    else if (b.hasAttribute("data-new")) newGame();
    else if (b.hasAttribute("data-undo")) {
      if (busy) return;
      // Back to just before your last line, taking the computer's reply with it.
      var at = game.movers.lastIndexOf(0);
      if (at < 0) return;
      var back = new D.Game(size, first);
      game.moves.slice(0, at).forEach(function (m) { back = back.play(m); });
      game = back;
      render();
      say("Back to your line.");
    }
  });

  var saved = store("dots:settings");
  if (saved) {
    if ([3, 4, 5].indexOf(saved.size) >= 0) size = saved.size;
    if (["easy", "medium", "hard"].indexOf(saved.level) >= 0) level = saved.level;
    if (saved.first === 0 || saved.first === 1) first = saved.first;
  }
  opts();
  newGame();
})();
