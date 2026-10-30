/* Reaction time test. Follows the Reaction Time app (docs/TIMING.md) as far as a browser allows:
 * random 2 to 5 s wait; the colour switches inside one requestAnimationFrame callback; the clock
 * starts at the next frame's timestamp, the earliest the green can be on screen; the tap is timed
 * with the input event's own timeStamp (same clock as rAF). Under 100 ms or before green is too
 * early, over 2 s is too slow; neither counts and the try is repeated. Five tries per run. */
(function () {
  "use strict";
  var root = document.getElementById("reaction-tool");
  if (!root) return;
  var pad = root.querySelector(".rt-pad");
  var big = root.querySelector(".rt-big");
  var small = root.querySelector(".rt-small");
  var pills = root.querySelector(".rt-pills");
  var result = root.querySelector(".rt-result");
  var TRIES = 5, WAIT_MIN = 2000, WAIT_MAX = 5000, TOO_FAST = 100, TOO_SLOW = 2000;
  var RATINGS = [[190, "Lightning"], [230, "Very fast"], [270, "Fast"], [320, "Good"], [400, "Steady"], [1e9, "Warming up"]];

  var phase = "idle", times = [], early = 0, timer = 0, stimulus = 0, drawnAt = 0, slowTimer = 0;

  function set(p, title, sub) {
    phase = p;
    pad.className = "rt-pad is-" + p;
    big.textContent = title;
    small.textContent = sub || "";
  }

  function rating(ms) {
    for (var i = 0; i < RATINGS.length; i++) if (ms <= RATINGS[i][0]) return RATINGS[i][1];
  }

  // Log normal model from the app (domain/Stats.kt): median 273 ms, sigma 0.18.
  function fasterThan(ms) {
    var z = (Math.log(ms) - Math.log(273)) / 0.18;
    var t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    var erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2);
    var cdf = 0.5 * (1 + (z >= 0 ? erf : -erf));
    return Math.min(99, Math.max(1, Math.round((1 - cdf) * 100)));
  }

  function drawPills() {
    var html = "";
    for (var i = 0; i < TRIES; i++) html += '<li class="' + (i < times.length ? "is-done" : "") + '">' + (i < times.length ? times[i] + " ms" : "") + "</li>";
    pills.innerHTML = html;
  }

  function startWait() {
    clearTimeout(timer);
    clearTimeout(slowTimer);
    set("wait", "Wait for green", "Try " + (times.length + 1) + " of " + TRIES);
    var wait = WAIT_MIN + Math.floor(Math.random() * (WAIT_MAX - WAIT_MIN + 1));
    timer = setTimeout(function () {
      requestAnimationFrame(function (frameTime) {
        if (phase !== "wait") return;
        drawnAt = frameTime;
        stimulus = 0;
        set("go", "Tap!", "");
        requestAnimationFrame(function (next) {
          stimulus = next;
        });
        slowTimer = setTimeout(function () {
          if (phase === "go") set("slow", "Too slow", "No tap within 2 seconds. Tap to try again.");
        }, TOO_SLOW + 200);
      });
    }, wait);
  }

  function finish() {
    var sum = times.reduce(function (a, b) { return a + b; }, 0);
    var avg = Math.round(sum / times.length);
    var best = Math.min.apply(null, times);
    var mean = sum / times.length;
    var spread = Math.round(Math.sqrt(times.reduce(function (a, t) { return a + (t - mean) * (t - mean); }, 0) / times.length));
    set("done", avg + " ms", rating(avg) + ". Tap to go again.");
    result.innerHTML =
      "<dl><div><dt>Average</dt><dd>" + avg + " ms</dd></div><div><dt>Best try</dt><dd>" + best + " ms</dd></div>" +
      "<div><dt>Consistency</dt><dd>± " + spread + " ms</dd></div><div><dt>Too early</dt><dd>" + early + "</dd></div></dl>" +
      "<p>Faster than about " + fasterThan(avg) + "% of players, going by the rough model my app uses (a typical result is around 273 ms). Treat it as a rough guide: your screen, browser and mouse or touchscreen all add a little time.</p>";
    var bestRun = 0;
    try {
      bestRun = Number(localStorage.getItem("rt:best")) || 0;
      if (!bestRun || avg < bestRun) localStorage.setItem("rt:best", String(avg));
    } catch (e) {}
    if (bestRun && avg < bestRun) result.innerHTML += "<p><strong>That's a new best average in this browser.</strong> Your old one was " + bestRun + " ms.</p>";
    else if (bestRun) result.innerHTML += "<p>Your best average in this browser is " + bestRun + " ms.</p>";
  }

  function press(eventTime) {
    if (phase === "idle" || phase === "done" || phase === "early" || phase === "slow") {
      if (phase === "done" || phase === "idle") {
        times = [];
        early = 0;
        result.innerHTML = "";
        drawPills();
      }
      startWait();
      return;
    }
    if (phase === "wait") {
      clearTimeout(timer);
      early++;
      set("early", "Too early", "That one doesn't count. Tap to try again.");
      return;
    }
    if (phase === "go") {
      if (!stimulus || eventTime < stimulus) {
        clearTimeout(slowTimer);
        early++;
        set("early", "Too early", "You tapped before the green reached the screen. Tap to try again.");
        return;
      }
      var ms = Math.round(eventTime - stimulus);
      clearTimeout(slowTimer);
      if (ms < TOO_FAST) {
        early++;
        set("early", "Too early", ms + " ms is faster than anyone reacts, so it was a guess. Tap to try again.");
        return;
      }
      if (ms > TOO_SLOW) {
        set("slow", "Too slow", "No tap within 2 seconds. Tap to try again.");
        return;
      }
      times.push(ms);
      drawPills();
      if (times.length === TRIES) {
        finish();
        return;
      }
      set("result", ms + " ms", rating(ms) + ". Tap for the next try.");
    } else if (phase === "result") {
      startWait();
    }
  }

  pad.addEventListener("pointerdown", function (e) {
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    press(e.timeStamp);
  });
  document.addEventListener("keydown", function (e) {
    if (e.repeat || (e.key !== " " && e.key !== "Enter")) return;
    var a = document.activeElement;
    if (a !== pad && a !== document.body && a !== null) return;
    e.preventDefault();
    press(e.timeStamp);
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && (phase === "wait" || phase === "go")) {
      clearTimeout(timer);
      clearTimeout(slowTimer);
      set("idle", "Paused", "You left the page, so that try was dropped. Tap to start again.");
      times = [];
      drawPills();
    }
  });
  drawPills();
  root.setAttribute("data-ready", "1");
})();
