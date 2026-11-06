/* Tape measure trainer on /tools/how-to-read-a-tape-measure/. Draws two inches of tape (one on phones) in sixteenths and
   reads any mark you pick; Read and Find modes quiz you down to the precision chosen. All readings are counted
   in whole sixteenths, so every answer is exact. */
(function () {
  "use strict";
  var root = document.getElementById("tp");
  if (!root) return;
  var tape = root.querySelector(".tp-tape"), panel = root.querySelector(".tp-panel"), precIn = root.querySelector("[name=prec]");
  var tabs = root.querySelectorAll("[data-mode]"), score = root.querySelector(".tp-score");
  // Phones get one inch of tape instead of two, so a sixteenth stays wide enough to tap.
  var W = 640, H = 190, PAD = 26, SPAN = root.clientWidth < 520 ? 16 : 32, TOP = 34;
  var LEVEL = [{ den: 1, h: 120, name: "inch" }, { den: 2, h: 92, name: "half inch" }, { den: 4, h: 72, name: "quarter inch" },
    { den: 8, h: 54, name: "eighth" }, { den: 16, h: 38, name: "sixteenth" }];
  var mode = "explore", start = 2, pos = 7, target = null, picked = null, right = 0, asked = 0, answered = false, options = [];

  function x(k) { return PAD + k * (W - 2 * PAD) / SPAN; }
  function level(k) { for (var i = 0; i < LEVEL.length; i++) if (k % (16 / LEVEL[i].den) === 0) return i; return 4; }
  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }
  function reading(sixteenths) {
    var whole = Math.floor(sixteenths / 16), rest = sixteenths % 16;
    if (!rest) return whole + "″";
    var g = gcd(rest, 16);
    return (whole ? whole + " " : "") + rest / g + "/" + 16 / g + "″";
  }
  function absolute(k) { return start * 16 + k; }
  function precision() { return Number(precIn.value) || 16; }

  function draw() {
    var o = '<svg viewBox="0 0 ' + W + " " + H + '" class="tp-svg" aria-hidden="true"><rect class="tp-blade" x="4" y="' + (TOP - 8) + '" width="' + (W - 8) + '" height="' + (H - TOP) + '" rx="6"/>';
    for (var k = 0; k <= SPAN; k++) {
      var lv = LEVEL[level(k)];
      o += '<line class="tp-tick tp-l' + level(k) + '" x1="' + x(k) + '" y1="' + TOP + '" x2="' + x(k) + '" y2="' + (TOP + lv.h) + '"/>';
      if (k % 16 === 0) o += '<text class="tp-num" x="' + (k === SPAN ? x(k) - 6 : x(k) + 6) + '" y="' + (TOP + 150) + '"' + (k === SPAN ? ' text-anchor="end"' : "") + ">" + (start + k / 16) + "</text>";
    }
    if (target != null && mode === "read") o += marker(target, "tp-target");
    if (pos != null && mode !== "read") o += marker(pos, mode === "find" && answered ? (picked === target ? "tp-good" : "tp-bad") : "tp-pointer");
    if (mode === "find" && answered && picked !== target) o += marker(target, "tp-good");
    tape.innerHTML = o + "</svg>";
    tape.setAttribute("aria-valuenow", String(absolute(pos == null ? 0 : pos)));
    tape.setAttribute("aria-valuetext", pos == null ? "no mark picked" : reading(absolute(pos)));
  }
  function marker(k, cls) {
    return '<g class="' + cls + '"><line x1="' + x(k) + '" y1="' + (TOP - 6) + '" x2="' + x(k) + '" y2="' + (H - 6) + '"/><path d="M' + (x(k) - 9) + " 6 L" + (x(k) + 9) +
      " 6 L" + x(k) + ' 24 Z"/></g>';
  }

  function explain(k) {
    var abs = absolute(k), whole = Math.floor(abs / 16), rest = abs % 16, lv = LEVEL[level(k)];
    if (!rest) return "A long inch line, so it's exactly " + whole + " inches.";
    var g = gcd(rest, 16), steps = "That's " + rest + " sixteenth" + (rest === 1 ? "" : "s") + " past the " + whole + (g > 1 ? ", which reduces to " + rest / g + "/" + 16 / g : "") + ".";
    return "The line is " + (lv.name === "eighth" ? "an " : "a ") + lv.name + " mark. " + steps;
  }

  function show() {
    root.querySelectorAll("[data-mode]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-mode") === mode ? "true" : "false"); });
    var html = "";
    if (mode === "explore") {
      var abs = absolute(pos);
      html = '<p class="tp-big">' + reading(abs) + '</p><p class="tp-why">' + explain(pos) + '</p><p class="tp-sub">' +
        (abs / 16).toFixed(4).replace(/0+$/, "").replace(/\.$/, "") + " in decimal, " + (abs / 16 * 25.4).toFixed(1) + " mm</p>";
    } else if (mode === "read") {
      html = '<p class="tp-ask">What does the red arrow read?</p><div class="tp-options">' + options.map(function (v) {
        var cls = answered ? (v === target + start * 16 ? " is-good" : v === picked ? " is-bad" : "") : "";
        return '<button type="button" class="button tp-opt' + cls + '" data-v="' + v + '"' + (answered ? " disabled" : "") + ">" + reading(v) + "</button>";
      }).join("") + "</div>";
      if (answered) html += '<p class="tp-why">' + (picked === target + start * 16 ? "Right. " : "Not quite. ") + explain(target) + "</p>";
    } else {
      html = '<p class="tp-ask">Tap the tape at <strong>' + reading(absolute(target)) + "</strong>" + (answered ? "" : ", or use the arrow keys and press Enter") + ".</p>";
      if (answered) html += '<p class="tp-why">' + (picked === target ? "Right on it. " : "You picked " + reading(absolute(picked)) + ". The green arrow shows " + reading(absolute(target)) + ". ") + explain(target) + "</p>";
    }
    if (mode !== "explore" && answered) html += '<p><button type="button" class="button button-play tp-next" data-next>Next mark</button></p>';
    panel.innerHTML = html;
    score.textContent = mode === "explore" ? "" : right + " of " + asked + " right";
    draw();
  }

  function newQuestion() {
    var step = 16 / precision();
    start = Math.floor(Math.random() * 11);
    answered = false; picked = null;
    var k;
    do { k = Math.floor(Math.random() * (SPAN / step + 1)) * step; } while (k === 0 || k === SPAN);
    target = k;
    pos = mode === "find" ? SPAN / 2 : null;
    if (mode === "read") {
      var abs = absolute(k), whole = Math.floor(abs / 16) * 16, rest = abs % 16, g = gcd(rest, 16), n = rest / g, d = 16 / g;
      var cand = [abs - step, abs + step, abs - 2 * step, abs + 2 * step, abs - 16, abs + 16];
      // Classic mix ups: the right top number over the wrong bottom number, like 3/16 for 3/8.
      if (d <= 8) cand.push(whole + n * 8 / d);
      if (d >= 4 && n < d / 2) cand.push(whole + n * 32 / d);
      var out = [abs];
      cand.filter(function (v) { return v > 0 && v !== abs; }).sort(function () { return Math.random() - 0.5; })
        .forEach(function (v) { if (out.length < 4 && out.indexOf(v) < 0) out.push(v); });
      options = out.sort(function (a, b) { return a - b; });
    }
    show();
  }

  function setMode(m) {
    mode = m;
    if (m === "explore") { target = null; pos = 7; start = 2; answered = false; show(); }
    else newQuestion();
  }

  function kFromEvent(e) {
    var r = tape.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W;
    return Math.max(0, Math.min(SPAN, Math.round((px - PAD) / ((W - 2 * PAD) / SPAN))));
  }
  function choose(k) {
    if (mode === "read") return;
    if (mode === "find") {
      if (answered) return;
      pos = k; picked = k; answered = true; asked++; if (k === target) right++;
    } else pos = k;
    show();
  }

  tape.addEventListener("click", function (e) { choose(kFromEvent(e)); });
  tape.addEventListener("keydown", function (e) {
    if (mode === "read") return;
    var k = pos == null ? SPAN / 2 : pos, step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 4, PageDown: -4 }[e.key];
    if (e.key === "Home") k = 0; else if (e.key === "End") k = SPAN; else if (step) k = Math.max(0, Math.min(SPAN, k + step));
    else if (e.key === "Enter" || e.key === " ") { if (mode === "find" && !answered) choose(k); e.preventDefault(); return; }
    else return;
    e.preventDefault();
    if (mode === "find" && answered) return;
    pos = k;
    show();
  });
  root.addEventListener("click", function (e) {
    var t = e.target;
    if (t.closest("[data-mode]")) setMode(t.closest("[data-mode]").getAttribute("data-mode"));
    else if (t.closest(".tp-opt") && !answered) {
      picked = Number(t.closest(".tp-opt").getAttribute("data-v"));
      answered = true; asked++;
      if (picked === absolute(target)) right++;
      show();
      var next = root.querySelector("[data-next]");
      if (next) next.focus();
    } else if (t.closest("[data-next]")) {
      newQuestion();
      var first = root.querySelector(".tp-opt");
      (first || tape).focus();
    }
  });
  precIn.addEventListener("change", function () { if (mode !== "explore") newQuestion(); });
  setMode("explore");
  root.setAttribute("data-ready", "1");
})();
