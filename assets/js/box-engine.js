/* Box pushing engine, ported from the Box Push Android app (engine/Level, Game, Paths, DeadSquares, StuckCheck).
   Text notation: # wall, space floor, . goal, $ crate, * crate on goal, @ worker, + worker on goal.
   Works in browsers and in node. */
(function (root) {
  "use strict";
  var DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }, OPP = { u: "d", d: "u", l: "r", r: "l" };

  function Level(rows) {
    var h = rows.length, w = 0, y, x;
    rows.forEach(function (r) { w = Math.max(w, r.length); });
    this.w = w; this.h = h;
    this.wall = []; this.goal = []; this.floor = []; this.crates = []; this.player = -1;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var ch = rows[y].charAt(x) || " ", c = y * w + x;
      this.wall[c] = ch === "#";
      this.goal[c] = ".*+".indexOf(ch) >= 0;
      this.floor[c] = false;
      if (ch === "$" || ch === "*") this.crates.push(c);
      if (ch === "@" || ch === "+") this.player = c;
    }
    // Floor is what the worker can reach; anything outside the outer wall is background.
    var q = [this.player];
    this.floor[this.player] = true;
    while (q.length) {
      var cell = q.shift();
      for (var d in DIRS) {
        var n = this.step(cell, d);
        if (n >= 0 && !this.wall[n] && !this.floor[n]) { this.floor[n] = true; q.push(n); }
      }
    }
    for (var k = 0; k < w * h; k++) if (!this.floor[k]) this.goal[k] = false;
    this.goals = [];
    for (k = 0; k < w * h; k++) if (this.goal[k]) this.goals.push(k);
  }
  Level.prototype.step = function (c, d) {
    var x = c % this.w + DIRS[d][0], y = Math.floor(c / this.w) + DIRS[d][1];
    return x >= 0 && x < this.w && y >= 0 && y < this.h ? y * this.w + x : -1;
  };
  Level.prototype.floorAt = function (c) { return c >= 0 && this.floor[c]; };

  /* Squares from which a lone crate can never be pushed onto any goal: pull crates back from every goal. */
  function deadSquares(level) {
    var live = [], q = level.goals.slice(), c;
    level.goals.forEach(function (g) { live[g] = true; });
    while (q.length) {
      var t = q.shift();
      for (var d in DIRS) {
        var p = level.step(t, OPP[d]), s = p < 0 ? -1 : level.step(p, OPP[d]);
        if (p >= 0 && !live[p] && level.floor[p] && level.floorAt(s)) { live[p] = true; q.push(p); }
      }
    }
    var dead = [];
    for (c = 0; c < level.w * level.h; c++) dead[c] = level.floor[c] && !live[c];
    return dead;
  }

  function Game(level) {
    this.level = level;
    this.dead = deadSquares(level);
    this.reset();
  }
  Game.prototype.reset = function () {
    this.crateAt = {};
    this.positions = this.level.crates.slice();
    var self = this;
    this.positions.forEach(function (c, id) { self.crateAt[c] = id; });
    this.player = this.level.player;
    this.history = []; this.moves = 0; this.pushes = 0;
  };
  Game.prototype.hasCrate = function (c) { return this.crateAt[c] != null; };
  Game.prototype.isFree = function (c) { return this.level.floorAt(c) && !this.hasCrate(c); };
  Game.prototype.solved = function () { var l = this.level; return this.positions.every(function (c) { return l.goal[c]; }); };
  Game.prototype.onGoals = function () { var l = this.level; return this.positions.filter(function (c) { return l.goal[c]; }).length; };

  /* One step; returns null when blocked, else { pushed, from, to }. */
  Game.prototype.move = function (d) {
    var next = this.level.step(this.player, d);
    if (!this.level.floorAt(next)) return null;
    var id = this.crateAt[next];
    if (id == null) {
      this.player = next; this.moves++; this.history.push({ d: d, crate: -1 });
      return { pushed: false };
    }
    var behind = this.level.step(next, d);
    if (!this.isFree(behind)) return null;
    delete this.crateAt[next];
    this.crateAt[behind] = id;
    this.positions[id] = behind;
    this.player = next; this.moves++; this.pushes++;
    this.history.push({ d: d, crate: id });
    return { pushed: true, from: next, to: behind };
  };
  Game.prototype.undo = function () {
    var s = this.history.pop();
    if (!s) return null;
    var back = OPP[s.d];
    if (s.crate >= 0) {
      var from = this.positions[s.crate], to = this.level.step(from, back);
      delete this.crateAt[from];
      this.crateAt[to] = s.crate;
      this.positions[s.crate] = to;
      this.pushes--;
    }
    this.player = this.level.step(this.player, back);
    this.moves--;
    return s;
  };
  /* Plays a LURD string, upper case letters are pushes; false at the first illegal step. */
  Game.prototype.play = function (lurd) {
    for (var i = 0; i < lurd.length; i++) {
      var ch = lurd.charAt(i), r = this.move(ch.toLowerCase());
      if (!r || (ch !== ch.toLowerCase()) !== r.pushed) return false;
    }
    return true;
  };

  /* The app's deadlock note: the crate on [cell] sits on a dead square, or in a frozen 2 by 2 block with a
     crate that isn't on a goal. */
  Game.prototype.isStuck = function (cell) {
    if (this.dead[cell]) return true;
    var l = this.level, x = cell % l.w, y = Math.floor(cell / l.w);
    for (var ox = -1; ox <= 0; ox++) for (var oy = -1; oy <= 0; oy++) {
      var blocked = true, loose = false;
      for (var dx = 0; dx <= 1; dx++) for (var dy = 0; dy <= 1; dy++) {
        var cx = x + ox + dx, cy = y + oy + dy, c = cx >= 0 && cx < l.w && cy >= 0 && cy < l.h ? cy * l.w + cx : -1;
        if (c < 0 || !l.floor[c]) continue;
        if (this.hasCrate(c)) { if (!l.goal[c]) loose = true; } else blocked = false;
      }
      if (blocked && loose) return true;
    }
    return false;
  };

  /* Shortest walk to [to] around the crates, as direction letters, or null. */
  Game.prototype.walk = function (to) {
    var l = this.level, from = this.player;
    if (from === to) return [];
    if (!this.isFree(to)) return null;
    var came = {}, q = [from];
    came[from] = -1;
    while (q.length) {
      var c = q.shift();
      for (var d in DIRS) {
        var n = l.step(c, d);
        if (n < 0 || came[n] != null || !this.isFree(n)) continue;
        came[n] = c;
        if (n === to) {
          var path = [], at = to;
          while (at !== from) {
            var p = came[at];
            for (var dd in DIRS) if (l.step(p, dd) === at) { path.unshift(dd); break; }
            at = p;
          }
          return path;
        }
        q.push(n);
      }
    }
    return null;
  };

  var api = { Level: Level, Game: Game, deadSquares: deadSquares, DIRS: DIRS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BoxEngine = api;
})(this);
