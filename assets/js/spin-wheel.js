/* Spin the wheel tool. The winner is picked first with crypto.getRandomValues (every option has the
 * same chance), then the wheel is turned to land inside that slice. */
(function () {
  "use strict";
  var root = document.getElementById("wheel-tool");
  if (!root) return;

  var PRESETS = {
    eat: ["Pizza", "Burger", "Sushi", "Ice cream", "Pasta", "Salad", "Tacos", "Wraps"],
    yesno: ["Yes", "No"],
    first: ["Player 1", "Player 2", "Player 3", "Player 4"],
    chore: ["Dishes", "Laundry", "Cleaning", "Trash", "Cooking", "Groceries"],
    watch: ["Movie", "Comedy", "Action", "Drama", "Documentary", "Animation", "Romance", "Series"],
    date: ["Restaurant", "Movie", "Beach", "Café", "Park", "Concert", "Hike", "Night in"],
    tonight: ["Movie", "Games", "Eat out", "Reading", "Music", "Night in", "Walk", "Café"],
    kids: ["Park", "Movie", "Games", "Beach", "Crafts", "Story time", "Day trip", "Play at home"],
    go: ["Beach", "Mountains", "Park", "Camping", "Lake", "City", "Forest", "Museum"],
    gift: ["Book", "Personal gift", "Movie tickets", "Café voucher", "Gift card", "Concert"],
  };
  var COLORS = ["#ff8787", "#ffa94d", "#ffd43b", "#8ce99a", "#74c0fc", "#b197fc", "#f783ac", "#63e6be"];
  var MAX = 20;

  var canvas = root.querySelector("canvas");
  var list = root.querySelector("textarea");
  var spinBtn = root.querySelector("[data-spin]");
  var result = root.querySelector(".wt-result");
  var history = root.querySelector(".wt-history");
  var options = [];
  var rotation = 0;
  var spinning = false;

  function randomInt(bound) {
    var buf = new Uint32Array(1);
    var limit = 4294967296 - (4294967296 % bound);
    for (;;) {
      if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(buf);
      else buf[0] = Math.floor(Math.random() * 4294967296);
      if (buf[0] < limit) return buf[0] % bound;
    }
  }

  function readOptions() {
    options = list.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean).slice(0, MAX);
    root.querySelector(".wt-count").textContent = options.length + " of " + MAX + " options";
    spinBtn.disabled = options.length < 2 || spinning;
    draw();
    try { localStorage.setItem("wheel:options", JSON.stringify(options)); } catch (e) {}
  }

  function setOptions(items) {
    list.value = items.join("\n");
    result.textContent = "";
    readOptions();
  }

  function draw() {
    var dpr = window.devicePixelRatio || 1;
    var size = canvas.clientWidth || 360;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var r = size / 2;
    ctx.clearRect(0, 0, size, size);
    var n = Math.max(options.length, 1);
    var slice = (Math.PI * 2) / n;
    for (var i = 0; i < n; i++) {
      var a0 = -Math.PI / 2 + i * slice;
      ctx.beginPath();
      ctx.moveTo(r, r);
      ctx.arc(r, r, r - 2, a0, a0 + slice);
      ctx.closePath();
      ctx.fillStyle = options.length ? COLORS[(i + (n % COLORS.length === 1 && i === n - 1 ? 1 : 0)) % COLORS.length] : "#dfe2ef";
      ctx.fill();
      ctx.strokeStyle = "rgba(23,26,61,0.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (!options[i]) continue;
      ctx.save();
      ctx.translate(r, r);
      ctx.rotate(a0 + slice / 2);
      ctx.fillStyle = "#171a3d";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      var fs = Math.max(11, Math.min(20, (r * slice) / 2.2, 260 / n));
      ctx.font = "700 " + fs + "px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      var label = options[i];
      var maxW = r * 0.68;
      while (ctx.measureText(label).width > maxW && label.length > 3) label = label.slice(0, -2) + "…";
      ctx.fillText(label, r - 16, 0);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(r, r, r * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = "#171a3d";
    ctx.fill();
  }

  function spin() {
    if (spinning || options.length < 2) return;
    spinning = true;
    spinBtn.disabled = true;
    result.textContent = "";
    var n = options.length;
    var winner = randomInt(n);
    var slice = 360 / n;
    var offset = slice * (0.12 + (randomInt(1000) / 1000) * 0.76);
    var target = winner * slice + offset;
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var turns = reduce ? 1 : 5 + randomInt(3);
    var current = ((rotation % 360) + 360) % 360;
    var delta = turns * 360 + ((360 - target - current) % 360 + 360) % 360;
    rotation += delta;
    canvas.style.transitionDuration = reduce ? "0.4s" : "4.2s";
    canvas.style.transform = "rotate(" + rotation + "deg)";
    var picked = options[winner];
    setTimeout(function () {
      spinning = false;
      spinBtn.disabled = options.length < 2;
      result.innerHTML = "";
      var strong = document.createElement("strong");
      strong.textContent = picked;
      result.appendChild(document.createTextNode("The wheel says: "));
      result.appendChild(strong);
      var li = document.createElement("li");
      li.textContent = picked;
      history.insertBefore(li, history.firstChild);
      while (history.children.length > 10) history.removeChild(history.lastChild);
      root.querySelector(".wt-history-wrap").hidden = false;
      root.querySelector("[data-remove]").hidden = n <= 2;
      root.querySelector("[data-remove]").setAttribute("data-value", picked);
    }, reduce ? 450 : 4300);
  }

  root.addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    if (t.hasAttribute("data-preset")) {
      setOptions(PRESETS[t.getAttribute("data-preset")]);
      root.querySelectorAll("[data-preset]").forEach(function (b) { b.setAttribute("aria-pressed", String(b === t)); });
    } else if (t.hasAttribute("data-spin")) spin();
    else if (t.hasAttribute("data-remove")) {
      var v = t.getAttribute("data-value");
      var idx = options.indexOf(v);
      if (idx >= 0) {
        options.splice(idx, 1);
        setOptions(options);
        t.hidden = true;
      }
    } else if (t.hasAttribute("data-shuffle")) {
      for (var i = options.length - 1; i > 0; i--) {
        var j = randomInt(i + 1);
        var tmp = options[i];
        options[i] = options[j];
        options[j] = tmp;
      }
      setOptions(options);
    }
  });

  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-load-preset]");
    if (!a) return;
    e.preventDefault();
    var key = a.getAttribute("data-load-preset");
    var btn = root.querySelector('[data-preset="' + key + '"]');
    if (btn) btn.click();
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  list.addEventListener("input", function () {
    root.querySelectorAll("[data-preset]").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
    readOptions();
  });
  window.addEventListener("resize", draw);

  var saved = null;
  try { saved = JSON.parse(localStorage.getItem("wheel:options") || "null"); } catch (e) {}
  if (saved && saved.length >= 2) setOptions(saved);
  else setOptions(PRESETS.eat);
})();
