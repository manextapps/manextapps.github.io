/* 100 envelope challenge tracker on /tools/100-envelope-challenge/. Same amounts as the Savings Challenge
 * app (domain/Plan.kt, Envelopes100): envelope n holds n times the first amount. A draw never offers the
 * envelope already on show while another one is open, like Challenge.draw(). Money is kept in cents. */
(function () {
  "use strict";
  var root = document.getElementById("ev");
  if (!root) return;

  var CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "NZD", "INR", "ZAR", "PHP", "NGN"];
  var els = {
    step: root.querySelector("[name=step]"),
    currency: root.querySelector("[name=currency]"),
    finish: root.querySelector("[name=finish]"),
    stats: root.querySelector(".ev-stats"),
    bar: root.querySelector(".ev-bar span"),
    grid: root.querySelector(".ev-grid"),
    drawOut: root.querySelector(".ev-draw-out"),
    fill: root.querySelector("[data-fill]"),
    pace: root.querySelector(".ev-pace-out"),
    head: root.querySelector(".ev-print-head"),
  };
  var state = { count: 100, done: {}, drawn: null, focus: 1 };

  function store(key, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(key) || "null");
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      return null;
    }
  }

  function guessCurrency() {
    var lang = (navigator.language || "en-US").toUpperCase();
    var region = lang.split("-")[1] || "";
    var byRegion = { GB: "GBP", CA: "CAD", AU: "AUD", NZ: "NZD", IN: "INR", ZA: "ZAR", PH: "PHP", NG: "NGN", IE: "EUR" };
    if (byRegion[region]) return byRegion[region];
    if (/^(DE|FR|ES|IT|NL|PT|FI|AT|BE|EL|SK|SI|LT|LV|ET)/.test(lang)) return "EUR";
    return "USD";
  }

  function money(cents, currency) {
    var whole = cents % 100 === 0;
    try {
      return new Intl.NumberFormat("en", {
        style: "currency", currency: currency || els.currency.value, currencyDisplay: "narrowSymbol",
        minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2,
      }).format(cents / 100);
    } catch (e) {
      return (cents / 100).toFixed(whole ? 0 : 2);
    }
  }

  function stepCents() {
    var v = Math.round(parseFloat(String(els.step.value).replace(",", ".")) * 100);
    return isFinite(v) && v > 0 ? Math.min(v, 100000000) : 100;
  }

  function key() { return "envelopes:done:" + state.count + "|" + stepCents(); }

  function amount(n) { return n * stepCents(); }

  function open() {
    var out = [];
    for (var n = 1; n <= state.count; n++) if (!state.done[n]) out.push(n);
    return out;
  }

  function dayLabel(d) {
    return new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" }).format(d);
  }

  function totals() {
    var total = 0, saved = 0, filled = 0;
    for (var n = 1; n <= state.count; n++) {
      total += amount(n);
      if (state.done[n]) { saved += amount(n); filled++; }
    }
    return { total: total, saved: saved, filled: filled };
  }

  function renderStats() {
    var t = totals();
    var parts = [
      ["Saved so far", money(t.saved)],
      ["Still to save", money(t.total - t.saved)],
      ["Envelopes filled", t.filled + " of " + state.count],
      ["Total at the end", money(t.total)],
    ];
    els.stats.innerHTML = parts.map(function (p) { return "<div><dt>" + p[0] + "</dt><dd>" + p[1] + "</dd></div>"; }).join("");
    els.bar.style.width = (t.total ? (t.saved / t.total) * 100 : 0).toFixed(1) + "%";
    root.classList.toggle("is-done", t.filled === state.count);
    els.head.textContent = state.count + " envelope challenge: " + money(amount(1)) + " to " + money(amount(state.count)) +
      ", " + money(t.total) + " in total. Cross off each envelope when the money is put away.";
    renderPace(t);
  }

  function renderPace(t) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(els.finish.value || "");
    var left = state.count - t.filled;
    if (!left) { els.pace.textContent = "Every envelope is filled. That's the whole challenge."; return; }
    if (!m) { els.pace.textContent = "Pick a date to see your pace."; return; }
    var now = new Date();
    var today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    var days = Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - today) / 86400000);
    if (days < 1) { els.pace.textContent = "Pick a date after today."; return; }
    var weeks = days / 7;
    var perWeek = left / weeks;
    var cash = (t.total - t.saved) / weeks;
    var rate = perWeek >= 7 ? (left / days).toFixed(1) + " envelopes a day" :
      perWeek < 1 ? "one envelope every " + Math.max(1, Math.round(7 / perWeek)) + " days" :
      perWeek.toFixed(1).replace(/\.0$/, "") + " envelopes a week";
    els.pace.textContent = "From today to " + dayLabel(new Date(+m[1], +m[2] - 1, +m[3])) + " is " + days + " days. To fill the " +
      left + " envelopes left, that's about " + rate + ", or " + money(Math.round(cash / 100) * 100) + " a week on average.";
  }

  function cellHtml(n) {
    var on = Boolean(state.done[n]);
    return '<li><button type="button" class="ev-env' + (on ? " is-done" : "") + (state.drawn === n ? " is-drawn" : "") +
      '" data-n="' + n + '" aria-pressed="' + on + '" tabindex="' + (n === state.focus ? 0 : -1) +
      '" aria-label="Envelope ' + n + ", " + money(amount(n)) + '"><span>' + n + "</span>" + money(amount(n)) + "</button></li>";
  }

  function render() {
    root.querySelectorAll("[data-count]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(Number(b.getAttribute("data-count")) === state.count));
    });
    if (state.focus > state.count) state.focus = 1;
    var cells = "";
    for (var n = 1; n <= state.count; n++) cells += cellHtml(n);
    els.grid.innerHTML = cells;
    els.grid.setAttribute("aria-label", "Envelopes 1 to " + state.count);
    renderStats();
    store("envelopes:settings", { count: state.count, step: els.step.value, currency: els.currency.value, finish: els.finish.value });
  }

  function load() {
    state.done = store(key()) || {};
    state.drawn = null;
    els.drawOut.textContent = "";
    els.fill.hidden = true;
    render();
  }

  function setDone(n, on) {
    if (on) state.done[n] = 1;
    else delete state.done[n];
    store(key(), state.done);
    var b = els.grid.querySelector('[data-n="' + n + '"]');
    b.classList.toggle("is-done", on);
    b.setAttribute("aria-pressed", String(on));
    if (state.drawn === n && on) {
      state.drawn = null;
      b.classList.remove("is-drawn");
      els.fill.hidden = true;
      els.drawOut.textContent = "Envelope " + n + " is filled. " + money(amount(n)) + " put away.";
    }
    renderStats();
  }

  function draw() {
    var choices = open();
    if (!choices.length) { els.drawOut.textContent = "Every envelope is filled. That's the whole challenge."; return; }
    if (choices.length > 1 && state.drawn !== null) choices = choices.filter(function (n) { return n !== state.drawn; });
    var prev = els.grid.querySelector(".is-drawn");
    if (prev) prev.classList.remove("is-drawn");
    state.drawn = choices[Math.floor(Math.random() * choices.length)];
    var b = els.grid.querySelector('[data-n="' + state.drawn + '"]');
    b.classList.add("is-drawn");
    els.drawOut.textContent = "Envelope " + state.drawn + ": put " + money(amount(state.drawn)) + " aside.";
    els.fill.hidden = false;
    b.scrollIntoView({ block: "nearest" });
  }

  function columns() {
    return getComputedStyle(els.grid).gridTemplateColumns.split(" ").length || 10;
  }

  function moveFocus(n) {
    n = Math.max(1, Math.min(state.count, n));
    var from = els.grid.querySelector('[tabindex="0"]');
    if (from) from.tabIndex = -1;
    var to = els.grid.querySelector('[data-n="' + n + '"]');
    to.tabIndex = 0;
    to.focus();
    state.focus = n;
  }

  els.grid.addEventListener("keydown", function (e) {
    var b = e.target.closest("[data-n]");
    if (!b) return;
    var n = Number(b.getAttribute("data-n")), cols = columns();
    var to = { ArrowRight: n + 1, ArrowLeft: n - 1, ArrowDown: n + cols, ArrowUp: n - cols, Home: 1, End: state.count }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    moveFocus(to);
  });

  root.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-n")) {
      var n = Number(b.getAttribute("data-n"));
      state.focus = n;
      els.grid.querySelectorAll('[tabindex="0"]').forEach(function (x) { if (x !== b) x.tabIndex = -1; });
      b.tabIndex = 0;
      setDone(n, !state.done[n]);
    } else if (b.hasAttribute("data-count")) {
      state.count = Number(b.getAttribute("data-count"));
      load();
    } else if (b.hasAttribute("data-draw")) {
      draw();
    } else if (b.hasAttribute("data-fill")) {
      if (state.drawn !== null) setDone(state.drawn, true);
    } else if (b.hasAttribute("data-print")) {
      printChart(b.getAttribute("data-print") === "mine");
    } else if (b.hasAttribute("data-reset")) {
      if (!totals().filled) { els.drawOut.textContent = "Nothing to clear yet."; return; }
      if (!window.confirm("Clear every filled envelope on this chart? This can't be undone.")) return;
      store(key(), null);
      load();
      els.drawOut.textContent = "The chart is clear.";
    }
  });

  els.step.addEventListener("input", function () { load(); });
  els.currency.addEventListener("change", function () { render(); });
  els.finish.addEventListener("change", function () { renderStats(); store("envelopes:settings", { count: state.count, step: els.step.value, currency: els.currency.value, finish: els.finish.value }); });

  // Printing shows only the chart: a copy goes into its own container and everything else is hidden.
  var printRoot = document.createElement("div");
  printRoot.id = "ev-print-root";
  document.body.appendChild(printRoot);

  function printChart(mine) {
    var cells = "";
    for (var n = 1; n <= state.count; n++) {
      cells += '<li class="' + (mine && state.done[n] ? "is-done" : "") + '"><span>' + n + "</span>" + money(amount(n)) + "</li>";
    }
    printRoot.innerHTML = '<p class="ev-print-title">' + els.head.textContent + "</p>" +
      '<ol class="ev-print-grid">' + cells + "</ol>" +
      '<p class="ev-print-foot">www.manextapps.com/tools/100-envelope-challenge/</p>';
    window.print();
  }
  window.addEventListener("afterprint", function () { printRoot.innerHTML = ""; });

  CURRENCIES.forEach(function (c) {
    var o = document.createElement("option");
    o.value = c;
    o.textContent = c + " " + money(100, c).replace(/[\d.,\s]/g, "");
    els.currency.appendChild(o);
  });

  var saved = store("envelopes:settings");
  var later = new Date(Date.now() + 182 * 86400000);
  els.finish.value = later.getFullYear() + "-" + String(later.getMonth() + 1).padStart(2, "0") + "-" + String(later.getDate()).padStart(2, "0");
  els.currency.value = guessCurrency();
  if (saved) {
    if (saved.count === 50 || saved.count === 100) state.count = saved.count;
    if (saved.step) els.step.value = saved.step;
    if (CURRENCIES.indexOf(saved.currency) >= 0) els.currency.value = saved.currency;
    if (saved.finish) els.finish.value = saved.finish;
  }
  root.setAttribute("data-ready", "1");
  load();
})();
