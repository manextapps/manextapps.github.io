/* No spend challenge calendar on /tools/no-spend-challenge/. Like the Savings Challenge app's No Spend Days:
   you mark the days you spent nothing, only days up to today, and an optional amount set aside per marked day.
   Marks are kept per calendar month in this browser. */
(function () {
  "use strict";
  var root = document.getElementById("ns");
  if (!root) return;
  var els = {
    month: root.querySelector("[name=month]"),
    start: root.querySelector("[name=weekstart]"),
    amount: root.querySelector("[name=amount]"),
    grid: root.querySelector(".ns-grid"),
    stats: root.querySelector(".ns-stats"),
    title: root.querySelector(".ns-title"),
  };
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var marks = {};

  function store(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null");
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      return null;
    }
  }

  function today() { var t = new Date(); return [t.getFullYear(), t.getMonth(), t.getDate()]; }
  function ym() { var p = els.month.value.split("-"); return [Number(p[0]), Number(p[1]) - 1]; }
  function key() { return "nospend:" + els.month.value; }
  function daysIn(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function isFuture(y, m, d) { var t = today(); return y > t[0] || (y === t[0] && (m > t[1] || (m === t[1] && d > t[2]))); }

  function money(n) {
    if (!n) return "0";
    return n.toLocaleString("en", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }

  function streaks(y, m, count) {
    var best = 0, run = 0, current = 0, t = today(), last = count;
    if (y === t[0] && m === t[1]) last = t[2];
    for (var d = 1; d <= count; d++) {
      run = marks[d] ? run + 1 : 0;
      best = Math.max(best, run);
      if (d === last) current = run;
    }
    // Today isn't over, so an unmarked today doesn't break the streak that runs up to yesterday.
    if (y === t[0] && m === t[1] && !marks[last] && last > 1) {
      current = 0;
      for (var k = last - 1; k >= 1 && marks[k]; k--) current++;
    }
    return { best: best, current: current };
  }

  function render() {
    var p = ym(), y = p[0], m = p[1], count = daysIn(y, m), first = new Date(y, m, 1).getDay(), offset = (first - Number(els.start.value) + 7) % 7;
    marks = store(key()) || {};
    var name = new Date(y, m, 1).toLocaleDateString("en", { month: "long", year: "numeric" });
    els.title.textContent = "No spend challenge, " + name;
    var head = "";
    for (var i = 0; i < 7; i++) head += '<span class="ns-dow">' + DAYS[(Number(els.start.value) + i) % 7] + "</span>";
    var cells = "";
    for (var b = 0; b < offset; b++) cells += '<span class="ns-blank"></span>';
    for (var d = 1; d <= count; d++) {
      var future = isFuture(y, m, d), on = !!marks[d];
      var label = new Date(y, m, d).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" });
      cells += '<button type="button" class="ns-day' + (on ? " is-done" : "") + '" data-d="' + d + '" aria-pressed="' + on + '"' +
        (future ? ' disabled aria-label="' + label + ', not yet"' : ' aria-label="' + label + (on ? ", no spend day" : "") + '"') + "><span>" + d + "</span></button>";
    }
    els.grid.innerHTML = head + cells;
    var marked = Object.keys(marks).filter(function (k) { return marks[k] && Number(k) <= count; }).length;
    var s = streaks(y, m, count), amt = parseFloat(String(els.amount.value).replace(",", "."));
    var parts = [["No spend days", marked + " of " + count], ["Current streak", s.current + (s.current === 1 ? " day" : " days")], ["Best streak", s.best + (s.best === 1 ? " day" : " days")]];
    if (amt > 0) parts.push(["Set aside", money(Math.round(amt * marked * 100) / 100)]);
    els.stats.innerHTML = parts.map(function (x) { return "<div><dt>" + x[0] + "</dt><dd>" + x[1] + "</dd></div>"; }).join("");
    store("nospend:settings", { start: els.start.value, amount: els.amount.value });
    root.setAttribute("data-ready", "1");
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-d")) {
      var d = Number(b.getAttribute("data-d"));
      if (marks[d]) delete marks[d]; else marks[d] = 1;
      store(key(), marks);
      render();
      var again = els.grid.querySelector('[data-d="' + d + '"]');
      if (again) again.focus();
    } else if (b.hasAttribute("data-print")) {
      printRoot.className = b.getAttribute("data-print") === "blank" ? "print-blank" : "";
      printRoot.innerHTML = '<p class="ns-print-title">' + els.title.textContent + '</p><div class="ns-grid">' + els.grid.innerHTML + "</div>" +
        '<div class="ns-print-notes"><p>My essentials, which don\'t count as spending:</p><p class="ns-line"></p><p class="ns-line"></p>' +
        '<p>What I\'ll do with the money I keep:</p><p class="ns-line"></p></div><p class="ns-print-foot">www.manextapps.com/tools/no-spend-challenge/</p>';
      window.print();
    } else if (b.hasAttribute("data-clear")) {
      if (!Object.keys(marks).length || !window.confirm("Clear every marked day this month? This can't be undone.")) return;
      store(key(), {});
      render();
    }
  });
  els.month.addEventListener("change", render);
  els.start.addEventListener("change", render);
  els.amount.addEventListener("input", render);

  // Printing shows only the calendar: a copy goes into its own container and everything else is hidden.
  var printRoot = document.createElement("div");
  printRoot.id = "ns-print-root";
  document.body.appendChild(printRoot);
  window.addEventListener("afterprint", function () { printRoot.innerHTML = ""; });

  var t = new Date(), opts = "";
  for (var k = -2; k <= 12; k++) {
    var dt = new Date(t.getFullYear(), t.getMonth() + k, 1);
    var v = dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0");
    opts += '<option value="' + v + '">' + dt.toLocaleDateString("en", { month: "long", year: "numeric" }) + "</option>";
  }
  els.month.innerHTML = opts;
  els.month.value = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0");
  els.start.value = /^en-US/i.test(navigator.language || "en-US") ? "0" : "1";
  var saved = store("nospend:settings");
  if (saved) {
    if (saved.start === "0" || saved.start === "1") els.start.value = saved.start;
    if (saved.amount) els.amount.value = saved.amount;
  }
  render();
})();
