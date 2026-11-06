var BOX_LEVELS=[{"id":"warehouse-1","name":"Warehouse 1","map":[" #####"," #@$.##","###$  #","#.    #","#   ###","#####"],"best":4},{"id":"warehouse-3","name":"Warehouse 3","map":["  ####","  #  #","###  ###","#. . $@#","#  $ ###","#  # #","##   #"," #####"],"best":5},{"id":"warehouse-6","name":"Warehouse 6","map":["#####","#   ###","###.@ ##","#  .   #","# $  $ #","###  ###","  ####"],"best":6},{"id":"docks-1","name":"Docks 1","map":["  #####","###   #","# .   ###","#  #   @#","## . .$ #"," ## $$# #","  #     #","  #######"],"best":9},{"id":"docks-4","name":"Docks 4","map":["  #######","  #  .$ #","###  $$@#","#      ##","#  ..#  #","#  #    #","#       #","#########"],"best":11},{"id":"factory-1","name":"Factory 1","map":["#### #####","# .###.  #","##$#  $  #"," #   #  ##","###  #  #","#  $$ ###","#     @#","#  .#. #","########"],"best":13},{"id":"factory-4","name":"Factory 4","map":["   ######"," ###.$  #"," #   .  ##"," #.  #   #","## $$#   #","# *  ### #","#  ### ###","#@ #","####"],"best":14}];
/* Box pushing board on /puzzles/box-pushing-puzzles/. BOX_LEVELS comes from build.py, which replays each
   level's solution and proves its fewest pushes. Needs box-engine.js (window.BoxEngine). Move with the arrow
   keys, WASD, the pad, or tap a square to walk there; walk into a crate to push it. */
(function () {
  "use strict";
  var root = document.getElementById("bx");
  var E = window.BoxEngine, LEVELS = window.BOX_LEVELS;
  if (!root || !E || !LEVELS || !LEVELS.length) return;
  var gridEl = root.querySelector(".bx-grid"), statusEl = root.querySelector(".bx-status"), noteEl = root.querySelector(".bx-note");
  var picker = root.querySelector("[name=level]"), idx = 0, game, level, solvedSet = load(), timer = null;
  var KEYS = { ArrowUp: "u", ArrowDown: "d", ArrowLeft: "l", ArrowRight: "r", w: "u", s: "d", a: "l", d: "r", W: "u", S: "d", A: "l", D: "r" };

  function load() { try { return JSON.parse(localStorage.getItem("box-solved") || "{}"); } catch (e) { return {}; } }
  function store() { try { localStorage.setItem("box-solved", JSON.stringify(solvedSet)); } catch (e) {} }

  function draw() {
    var html = "", n = level.w * level.h;
    for (var c = 0; c < n; c++) {
      var cls = level.wall[c] ? "bx-wall" : !level.floor[c] ? "bx-void" : "bx-floor" + (level.goal[c] ? " bx-goal" : "");
      var inner = game.hasCrate(c) ? '<span class="bx-crate' + (level.goal[c] ? " on" : "") + '"></span>' : c === game.player ? '<span class="bx-worker"></span>' : "";
      html += '<span class="bx-cell ' + cls + '" data-c="' + c + '">' + inner + "</span>";
    }
    gridEl.style.setProperty("--w", level.w);
    gridEl.innerHTML = html;
    var lv = LEVELS[idx];
    statusEl.textContent = game.solved() ? "Solved in " + game.pushes + " pushes" + (game.pushes <= lv.best ? ", the fewest possible." : ". The fewest possible is " + lv.best + ".")
      : game.onGoals() + " of " + level.goals.length + " crates on goals · " + game.moves + " moves · " + game.pushes + " pushes";
    gridEl.setAttribute("aria-label", lv.name + ". " + statusEl.textContent);
  }

  function after(r) {
    noteEl.textContent = "";
    if (r && r.pushed && !game.solved() && game.isStuck(r.to)) noteEl.textContent = "This crate can't move to a goal anymore. Undo?";
    if (game.solved()) {
      root.classList.add("is-solved");
      if (!solvedSet[LEVELS[idx].id]) { solvedSet[LEVELS[idx].id] = 1; store(); fillPicker(); }
      noteEl.textContent = idx < LEVELS.length - 1 ? "Nice. Try the next one." : "That's every level here. The app has 240 more.";
    }
    draw();
  }

  function move(d) {
    if (game.solved()) return;
    stopWalk();
    var r = game.move(d);
    if (r) after(r);
  }

  function stopWalk() { if (timer) { clearInterval(timer); timer = null; } }

  function tapCell(c) {
    if (game.solved()) return;
    stopWalk();
    // A crate right next to the worker gets one push; anywhere else, walk there around the crates.
    for (var d in E.DIRS) if (level.step(game.player, d) === c && game.hasCrate(c)) { move(d); return; }
    var path = game.walk(c);
    if (!path || !path.length) return;
    timer = setInterval(function () {
      var d = path.shift();
      var r = d ? game.move(d) : null;
      if (r) after(r);
      if (!path.length || !r) stopWalk();
    }, 70);
  }

  function fillPicker() {
    picker.innerHTML = LEVELS.map(function (l, i) {
      return '<option value="' + i + '">' + l.name + (solvedSet[l.id] ? " ✓" : "") + "</option>";
    }).join("");
    picker.value = String(idx);
  }

  function start(i) {
    stopWalk();
    idx = i;
    level = new E.Level(LEVELS[i].map);
    game = new E.Game(level);
    root.classList.remove("is-solved");
    noteEl.textContent = "";
    root.querySelector(".bx-best").textContent = "Fewest pushes: " + LEVELS[i].best;
    picker.value = String(i);
    draw();
  }

  document.addEventListener("keydown", function (e) {
    // Only while the board has focus, so arrow keys still scroll the page everywhere else.
    if (!root.contains(document.activeElement)) return;
    if (e.target.tagName === "SELECT") return;
    var d = KEYS[e.key];
    if (d) { e.preventDefault(); move(d); return; }
    if (e.key === "z" || e.key === "u" || e.key === "Backspace") { e.preventDefault(); root.querySelector("[data-undo]").click(); }
  });
  gridEl.addEventListener("click", function (e) { gridEl.focus(); var el = e.target.closest("[data-c]"); if (el) tapCell(+el.getAttribute("data-c")); });
  root.querySelectorAll("[data-dir]").forEach(function (b) { b.addEventListener("click", function () { move(b.getAttribute("data-dir")); }); });
  root.querySelector("[data-undo]").addEventListener("click", function () {
    stopWalk();
    if (game.undo()) { root.classList.remove("is-solved"); noteEl.textContent = ""; draw(); }
  });
  root.querySelector("[data-restart]").addEventListener("click", function () { start(idx); });
  root.querySelector("[data-next]").addEventListener("click", function () { start((idx + 1) % LEVELS.length); });
  picker.addEventListener("change", function () { start(+picker.value); gridEl.focus(); });
  fillPicker();
  start(0);
  root.setAttribute("data-ready", "1");
})();
