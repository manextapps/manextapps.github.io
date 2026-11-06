/* Flood It engine, ported from the Flood It Android app (engine/Flood.kt, Solver.kt).
   The board is compressed to single colour areas ("components") with bitset adjacency. The solver is the
   app's beam search: each layer keeps the most promising regions, ranked by a lower bound on the moves
   still needed (the larger of the colours left and the region's eccentricity), then by flooded cells. */
(function (root) {
  "use strict";

  function bits(n) { return new Uint32Array((n + 31) >>> 5); }
  function setBit(b, i) { b[i >>> 5] |= 1 << (i & 31); }
  function hasBit(b, i) { return (b[i >>> 5] >>> (i & 31)) & 1; }
  function isEmpty(b) { for (var w = 0; w < b.length; w++) if (b[w]) return false; return true; }
  function each(b, fn) {
    for (var w = 0; w < b.length; w++) {
      var x = b[w];
      while (x) {
        var t = x & -x;
        fn((w << 5) + (31 - Math.clz32(t)));
        x ^= t;
      }
    }
  }

  function neighbors(cell, size, fn) {
    var r = (cell / size) | 0, c = cell - r * size;
    if (r > 0) fn(cell - size);
    if (c > 0) fn(cell - 1);
    if (c < size - 1) fn(cell + 1);
    if (r < size - 1) fn(cell + size);
  }

  /* Cells of the region joined to the top left corner, in flood order. */
  function region(cells, size) {
    var seen = new Uint8Array(cells.length), queue = [0], color = cells[0];
    seen[0] = 1;
    for (var h = 0; h < queue.length; h++) {
      neighbors(queue[h], size, function (n) {
        if (!seen[n] && cells[n] === color) { seen[n] = 1; queue.push(n); }
      });
    }
    return queue;
  }

  /* Recolours the corner region and returns the new cells with each flooded cell's distance from the corner. */
  function fill(cells, size, color) {
    var next = cells.slice(), before = region(cells, size);
    before.forEach(function (c) { next[c] = color; });
    var dist = new Int16Array(next.length).fill(-1), queue = [0];
    dist[0] = 0;
    for (var h = 0; h < queue.length; h++) {
      var d = dist[queue[h]] + 1;
      neighbors(queue[h], size, function (n) {
        if (dist[n] < 0 && next[n] === color) { dist[n] = d; queue.push(n); }
      });
    }
    return { cells: next, distance: dist, regionSize: queue.length, absorbed: queue.length - before.length };
  }

  function Graph(cells, size, colors) {
    var comp = new Int32Array(cells.length).fill(-1), color = [], cellsIn = [];
    for (var s = 0; s < cells.length; s++) {
      if (comp[s] >= 0) continue;
      var id = color.length, c = cells[s], queue = [s];
      comp[s] = id;
      for (var h = 0; h < queue.length; h++) {
        neighbors(queue[h], size, function (n) {
          if (comp[n] < 0 && cells[n] === c) { comp[n] = id; queue.push(n); }
        });
      }
      color.push(c);
      cellsIn.push(queue.length);
    }
    this.count = color.length;
    this.color = color;
    this.cellsIn = cellsIn;
    this.comp = comp;
    var nb = [];
    for (var i = 0; i < this.count; i++) nb.push(bits(this.count));
    for (var k = 0; k < cells.length; k++) {
      neighbors(k, size, function (n) { if (comp[k] !== comp[n]) setBit(nb[comp[k]], comp[n]); });
    }
    this.neighbors = nb;
    this.colorMask = [];
    for (var q = 0; q < colors; q++) this.colorMask.push(bits(this.count));
    for (var j = 0; j < this.count; j++) setBit(this.colorMask[color[j]], j);
    this.colors = colors;
  }

  /* max(colours outside the region, rings of components still to reach): each move takes at most one of each. */
  function bound(g, flooded, frontier) {
    var left = 0;
    for (var c = 0; c < g.colors; c++) {
      var m = g.colorMask[c];
      for (var w = 0; w < m.length; w++) if (m[w] & ~flooded[w]) { left++; break; }
    }
    var visited = flooded.slice(), ring = frontier.slice(), rings = 0;
    while (!isEmpty(ring)) {
      rings++;
      for (var v = 0; v < ring.length; v++) visited[v] |= ring[v];
      var next = bits(g.count);
      each(ring, function (i) { var n = g.neighbors[i]; for (var u = 0; u < n.length; u++) next[u] |= n[u]; });
      for (var x = 0; x < next.length; x++) next[x] &= ~visited[x];
      ring = next;
    }
    return Math.max(left, rings);
  }

  function start(g) {
    var flooded = bits(g.count);
    setBit(flooded, 0);
    return { flooded: flooded, frontier: g.neighbors[0].slice(), cells: g.cellsIn[0], color: g.color[0], parent: null, depth: 0, move: -1 };
  }

  function child(g, node, c) {
    var mask = g.colorMask[c], flooded = node.flooded.slice(), frontier = node.frontier.slice(), gained = 0, any = false;
    for (var w = 0; w < mask.length; w++) {
      var hit = node.frontier[w] & mask[w];
      if (hit) any = true;
      flooded[w] |= hit;
    }
    if (!any) return null;
    each(node.frontier, function (i) {
      if (!hasBit(mask, i)) return;
      gained += g.cellsIn[i];
      var n = g.neighbors[i];
      for (var u = 0; u < n.length; u++) frontier[u] |= n[u];
    });
    for (var x = 0; x < frontier.length; x++) frontier[x] &= ~flooded[x];
    return { flooded: flooded, frontier: frontier, cells: node.cells + gained, color: c, parent: node, depth: node.depth + 1, move: c };
  }

  function path(node) {
    var out = [];
    for (; node && node.depth > 0; node = node.parent) out.unshift(node.move);
    return out;
  }

  /* A short sequence of colours that floods the board. Same board and width, same answer. */
  function solve(cells, size, colors, beamWidth) {
    var g = new Graph(cells, size, colors);
    if (g.count === 1) return [];
    var layer = [start(g)];
    for (;;) {
      var seen = {}, children = [];
      for (var i = 0; i < layer.length; i++) {
        for (var c = 0; c < colors; c++) {
          if (c === layer[i].color) continue;
          var k = child(g, layer[i], c);
          if (!k) continue;
          if (isEmpty(k.frontier)) return path(k);
          var key = Array.prototype.join.call(k.flooded, ",");
          if (seen[key]) continue;
          seen[key] = 1;
          children.push(k);
        }
      }
      children.forEach(function (k) { k.bound = bound(g, k.flooded, k.frontier); });
      children.sort(function (a, b) { return a.bound - b.bound || b.cells - a.cells; });
      layer = children.length > beamWidth ? children.slice(0, beamWidth) : children;
    }
  }

  function lowerBound(cells, size, colors) {
    var g = new Graph(cells, size, colors), s = start(g);
    return g.count === 1 ? 0 : bound(g, s.flooded, s.frontier);
  }

  function beamWidthFor(size) { return size <= 12 ? 400 : size <= 16 ? 300 : 220; }

  function random(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* A random board and its par, like the app's PuzzleGenerator. */
  function generate(size, colors, seed) {
    var r = random(seed), cells = [];
    for (var i = 0; i < size * size; i++) cells.push(Math.floor(r() * colors));
    return { size: size, colors: colors, cells: cells, solution: solve(cells, size, colors, beamWidthFor(size)) };
  }

  var api = { fill: fill, region: region, solve: solve, lowerBound: lowerBound, generate: generate, beamWidthFor: beamWidthFor, Graph: Graph };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FloodEngine = api;
})(this);
