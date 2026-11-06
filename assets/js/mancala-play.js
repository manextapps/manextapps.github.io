/* Kalah against the computer on /puzzles/how-to-play-mancala/, plus the capture practice under it.
   Needs mancala-engine.js (window.MancalaEngine). Like the app: you sit at the bottom, Undo goes back to your
   last decision, and the computer's levels are the app's Easy, Medium and Hard. */
(function () {
  "use strict";
  var K = window.MancalaEngine;
  if (!K) return;

  // The practice boards come after this script in the page, so their taps are caught at the document.
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".mc-q [data-pit]");
    if (!b) return;
    var q = b.closest(".mc-q"), answer = Number(q.getAttribute("data-answer")), out = q.querySelector(".mc-q-out");
    (function () {
      var pit = Number(b.getAttribute("data-pit"));
      q.querySelectorAll("[data-pit]").forEach(function (x) { x.classList.remove("picked", "right", "wrong"); });
      if (pit === answer) {
        b.classList.add("right");
        out.textContent = "Right, pit " + (pit + 1) + ". Open the answer to see why.";
        q.classList.add("is-done");
      } else {
        b.classList.add("wrong");
        out.textContent = "Not pit " + (pit + 1) + ". Try another one.";
      }
    })();
  });

  var root = document.getElementById("mc");
  if (!root) return;
  var boardEl = root.querySelector(".mc-live");
  var msgEl = root.querySelector(".mc-msg");
  var statusEl = root.querySelector(".mc-status");
  var level = "medium", first = 0, pos, undo, busy = false, last = null, timer = null;

  function store(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null");
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      return null;
    }
  }

  function render() {
    var c = pos.cells, marks = {};
    if (last) {
      last.path.forEach(function (i) { (marks[i] = marks[i] || []).push("path"); });
      (marks[last.landing] = marks[last.landing] || []).push("last");
      if (last.captured) (marks[last.capturedFrom] = marks[last.capturedFrom] || []).push("taken");
    }
    function cls(i, base) { return base + (marks[i] ? " " + marks[i].join(" ") : ""); }
    var mine = pos.toMove === 0 && !pos.isOver() && !busy, html = '<span class="' + cls(13, "mc-store top") + '">' + c[13] + "</span><div class=\"mc-row top\">";
    for (var t = 12; t >= 7; t--) html += '<span class="' + cls(t, "mc-pit") + '">' + c[t] + "</span>";
    html += '</div><div class="mc-row bottom">';
    for (var b = 0; b < 6; b++) {
      html += '<button type="button" class="' + cls(b, "mc-pit") + '" data-pit="' + b + '"' + (mine && c[b] ? "" : " disabled") +
        ' aria-label="Your pit ' + (b + 1) + ", " + c[b] + ' seeds">' + c[b] + "</button>";
    }
    html += '</div><span class="' + cls(6, "mc-store bottom") + '">' + c[6] + "</span>";
    var focused = document.activeElement && document.activeElement.getAttribute("data-pit");
    boardEl.innerHTML = html;
    if (focused !== null && focused !== undefined) {
      var again = boardEl.querySelector('[data-pit="' + focused + '"]:not([disabled])') || boardEl.querySelector("[data-pit]:not([disabled])");
      if (again) again.focus();
    }
    statusEl.textContent = "You " + c[6] + ", computer " + c[13] + ".";
    root.querySelector("[data-undo]").disabled = !undo.length || busy;
  }

  function say(t) { msgEl.textContent = t; }

  function describe(r, who) {
    var you = who === 0, n = r.path.length, s = n === 1 ? " seed" : " seeds";
    var text = (you ? "You sowed " + n + s + " from pit " + (r.pit + 1) + "." : "The computer sowed " + n + s + " from its pit " + (r.pit + 1) + ".");
    if (r.captured) text += you ? " Your last seed landed in an empty pit, so you captured " + r.captured + "." : " It captured " + r.captured + " seeds, " + (r.captured - 1) + " of them yours.";
    else if (r.freeTurn) text += you ? " The last one landed in your store, so you go again." : " Its last seed landed in its store, so it goes again.";
    return text;
  }

  function finish(text) {
    var a = pos.cells[6], b = pos.cells[13];
    say(text + " Game over: " + a + " to " + b + ". " + (a > b ? "You win." : b > a ? "The computer wins." : "It's a draw."));
    if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "mancala-finished-" + level + (a > b ? "-won" : ""), event: true });
  }

  function play(pit) {
    if (busy || pos.toMove !== 0 || pos.isOver() || !pos.cells[pit]) return;
    undo.push(pos);
    var r = pos.move(pit);
    pos = r.after;
    last = r;
    var text = describe(r, 0);
    if (pos.isOver()) { render(); finish(text); return; }
    render();
    say(text);
    if (pos.toMove === 1) computer([]);
  }

  // A computer turn can be several moves when it earns free turns; they're all described together.
  function computer(said) {
    busy = true;
    render();
    timer = setTimeout(function () {
      var r = pos.move(K.choose(pos, level));
      pos = r.after;
      last = r;
      busy = false;
      said = said.concat(describe(r, 1).replace(/^The computer sowed/, said.length ? "Then it sowed" : "The computer sowed"));
      var text = said.join(" ");
      render();
      if (pos.isOver()) { finish(text); return; }
      say(text + (pos.toMove === 0 ? " Your move." : ""));
      if (pos.toMove === 1) computer(said);
    }, level === "hard" ? 50 : 500);
  }

  function newGame() {
    clearTimeout(timer);
    busy = false;
    pos = K.Position.start(first);
    undo = [];
    last = null;
    render();
    say(first === 0 ? "Your move. Tap one of your pits on the bottom row." : "The computer starts.");
    if (first === 1) computer([]);
    root.setAttribute("data-ready", "1");
  }

  function opts() {
    root.querySelectorAll("[data-level]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-level") === level)); });
    root.querySelectorAll("[data-first]").forEach(function (b) { b.setAttribute("aria-pressed", String(Number(b.getAttribute("data-first")) === first)); });
    store("mancala:settings", { level: level, first: first });
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-pit")) play(Number(b.getAttribute("data-pit")));
    else if (b.hasAttribute("data-level")) { level = b.getAttribute("data-level"); opts(); newGame(); }
    else if (b.hasAttribute("data-first")) { first = Number(b.getAttribute("data-first")); opts(); newGame(); }
    else if (b.hasAttribute("data-new")) newGame();
    else if (b.hasAttribute("data-undo")) {
      if (!undo.length || busy) return;
      pos = undo.pop();
      last = null;
      render();
      say("Back to your move.");
    }
  });
  root.addEventListener("keydown", function (e) {
    var n = Number(e.key);
    if (n >= 1 && n <= 6 && !e.target.matches("input, select")) { e.preventDefault(); play(n - 1); }
  });

  var saved = store("mancala:settings");
  if (saved) {
    if (["easy", "medium", "hard"].indexOf(saved.level) >= 0) level = saved.level;
    if (saved.first === 0 || saved.first === 1) first = saved.first;
  }
  opts();
  newGame();
})();
