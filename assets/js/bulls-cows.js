/* Bulls and cows solver. Enter each guess with its bulls (right digit, right place) and cows (right digit,
   wrong place); the page lists every code that still fits. Runs in the browser and in node (for the build). */
(function (root) {
  "use strict";

  function score(secret, guess) {
    var bulls = 0, cows = 0, sCount = new Array(10).fill(0), gCount = new Array(10).fill(0);
    for (var i = 0; i < secret.length; i++) {
      if (secret[i] === guess[i]) bulls++;
      else { sCount[+secret[i]]++; gCount[+guess[i]]++; }
    }
    for (var d = 0; d < 10; d++) cows += Math.min(sCount[d], gCount[d]);
    return [bulls, cows];
  }

  function allCodes(len, repeats, leadingZero) {
    var out = [], max = Math.pow(10, len);
    for (var n = 0; n < max; n++) {
      var s = String(n);
      while (s.length < len) s = "0" + s;
      if (!leadingZero && s[0] === "0") continue;
      if (!repeats && new Set(s).size !== len) continue;
      out.push(s);
    }
    return out;
  }

  function filter(codes, clue) {
    return codes.filter(function (c) {
      var r = score(c, clue.guess);
      return r[0] === clue.bulls && r[1] === clue.cows;
    });
  }

  /* Candidates after every clue, plus the first clue that leaves nothing (a contradiction) if any. */
  function solve(settings, clues) {
    var codes = allCodes(settings.length, settings.repeats, settings.leadingZero);
    var counts = [], conflict = -1;
    for (var i = 0; i < clues.length; i++) {
      codes = filter(codes, clues[i]);
      counts.push(codes.length);
      if (!codes.length && conflict < 0) conflict = i;
    }
    return { codes: codes, counts: counts, conflict: conflict };
  }

  /* A guess from the remaining codes whose worst answer leaves the fewest codes. Only tried on small lists. */
  function suggest(codes, limit) {
    if (codes.length < 2 || codes.length > (limit || 1500)) return null;
    var best = null, bestWorst = Infinity;
    for (var i = 0; i < codes.length; i++) {
      var buckets = {}, worst = 0;
      for (var j = 0; j < codes.length; j++) {
        var r = score(codes[j], codes[i]), k = r[0] * 10 + r[1];
        buckets[k] = (buckets[k] || 0) + 1;
        if (buckets[k] > worst) worst = buckets[k];
        if (worst >= bestWorst) break;
      }
      if (worst < bestWorst) { bestWorst = worst; best = codes[i]; }
    }
    return { guess: best, worst: bestWorst };
  }

  var api = { score: score, allCodes: allCodes, solve: solve, suggest: suggest };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BullsCows = api;
})(this);
