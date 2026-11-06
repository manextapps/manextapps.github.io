/* Penny challenge tracker on /tools/penny-challenge/. Day n saves n pennies (or 366 - n in reverse), the same
   increasing amounts the Savings Challenge app's custom grid uses. Money is kept in pennies so totals never drift. */
(function () {
  "use strict";
  var root = document.getElementById("pc");
  if (!root) return;
  var els = {
    currency: root.querySelector("[name=currency]"),
    order: root.querySelector("[name=order]"),
    length: root.querySelector("[name=length]"),
    start: root.querySelector("[name=start]"),
    year: root.querySelector("[name=year]"),
    summary: root.querySelector(".pc-summary"),
    months: root.querySelector(".pc-months"),
    days: root.querySelector(".pc-days"),
    head: root.querySelector(".pc-print-head"),
  };
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var done = {};

  function store(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null");
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      return null;
    }
  }

  function money(p) {
    var cur = els.currency.value;
    if (p < 100 && cur !== "EUR") return p + (cur === "GBP" ? "p" : "¢");
    var sym = { USD: "$", GBP: "£", EUR: "€" }[cur];
    return sym + (p / 100).toLocaleString("en", { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 });
  }

  function utc(y, m, d) { return Date.UTC(y, m, d); }
  function parseDay(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? utc(+m[1], +m[2] - 1, +m[3]) : null; }
  function label(ms) { return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(ms)); }

  function plan() {
    var calendar = els.length.value === "year", start, count;
    if (calendar) {
      var y = Number(els.year.value);
      start = utc(y, 0, 1);
      count = (utc(y + 1, 0, 1) - start) / 86400000;
    } else {
      start = parseDay(els.start.value);
      if (start === null) { var t = new Date(); start = utc(t.getFullYear(), t.getMonth(), t.getDate()); }
      count = 365;
    }
    var down = els.order.value === "down", days = [];
    for (var i = 0; i < count; i++) days.push({ n: i + 1, pennies: down ? count - i : i + 1, date: start + i * 86400000 });
    return { calendar: calendar, start: start, count: count, days: days, down: down };
  }

  function key(p) { return "penny:done:" + p.start + "|" + p.count + "|" + (p.down ? "down" : "up"); }

  function render() {
    var p = plan();
    done = store(key(p)) || {};
    root.querySelectorAll("[data-only]").forEach(function (el) { el.hidden = el.getAttribute("data-only") !== els.length.value; });
    var total = 0, saved = 0, savedDays = 0;
    p.days.forEach(function (d) { total += d.pennies; if (done[d.n]) { saved += d.pennies; savedDays++; } });
    var last = p.days[p.days.length - 1];
    var parts = [["Total", money(total)], ["Deposits", String(p.count)], ["Biggest day", money(p.count)],
      ["Last day", label(last.date)], ["Saved so far", money(saved) + " (" + savedDays + (savedDays === 1 ? " day)" : " days)")]];
    els.summary.innerHTML = parts.map(function (x) { return "<div><dt>" + x[0] + "</dt><dd>" + x[1] + "</dd></div>"; }).join("");
    els.head.textContent = "Penny challenge: " + p.count + " days from " + label(p.start) + (p.down ? ", biggest first" : ", 1 a day more") + ", " + money(total) + " in total";

    var months = [], cur = null;
    p.days.forEach(function (d) {
      var dt = new Date(d.date), k = dt.getUTCFullYear() + "-" + dt.getUTCMonth();
      if (!cur || cur.k !== k) { cur = { k: k, name: MONTHS[dt.getUTCMonth()] + " " + dt.getUTCFullYear(), days: [], sum: 0 }; months.push(cur); }
      cur.days.push(d);
      cur.sum += d.pennies;
    });
    var run = 0;
    els.months.innerHTML = '<div class="table-wrap"><table class="pc-table"><thead><tr><th>Month</th><th class="num">Days</th><th class="num">Saved that month</th><th class="num">Total so far</th></tr></thead><tbody>' +
      months.map(function (m) { run += m.sum; return "<tr><td>" + m.name + '</td><td class="num">' + m.days.length + '</td><td class="num">' + money(m.sum) + '</td><td class="num">' + money(run) + "</td></tr>"; }).join("") +
      "</tbody></table></div>";
    els.days.innerHTML = months.map(function (m) {
      return '<section class="pc-month"><h3>' + m.name + " <span>" + money(m.sum) + "</span></h3><ol>" + m.days.map(function (d) {
        var day = new Date(d.date).getUTCDate();
        return '<li><button type="button" class="pc-day' + (done[d.n] ? " is-done" : "") + '" data-n="' + d.n + '" aria-pressed="' + Boolean(done[d.n]) +
          '" aria-label="' + label(d.date) + ", save " + money(d.pennies) + '"><span>' + day + "</span>" + money(d.pennies) + "</button></li>";
      }).join("") + "</ol></section>";
    }).join("");
    store("penny:settings", { currency: els.currency.value, order: els.order.value, length: els.length.value, start: els.start.value, year: els.year.value });
    root.setAttribute("data-ready", "1");
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-n")) {
      var n = Number(b.getAttribute("data-n")), p = plan();
      if (done[n]) delete done[n]; else done[n] = 1;
      store(key(p), done);
      var focus = n;
      render();
      var again = root.querySelector('.pc-day[data-n="' + focus + '"]');
      if (again) again.focus();
    } else if (b.hasAttribute("data-print")) {
      // Printing shows only the chart: a copy goes into its own container and everything else is hidden.
      printRoot.innerHTML = root.querySelector(".pc-print").innerHTML;
      printRoot.className = b.getAttribute("data-print") === "blank" ? "print-blank" : "";
      window.print();
    } else if (b.hasAttribute("data-clear")) {
      if (!Object.keys(done).length || !window.confirm("Clear every ticked day on this chart? This can't be undone.")) return;
      store(key(plan()), {});
      render();
    }
  });
  root.addEventListener("change", render);
  var printRoot = document.createElement("div");
  printRoot.id = "pc-print-root";
  document.body.appendChild(printRoot);
  window.addEventListener("afterprint", function () { printRoot.innerHTML = ""; });

  var now = new Date(), saved = store("penny:settings");
  els.start.value = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  var years = "";
  for (var y = now.getFullYear(); y <= now.getFullYear() + 2; y++) years += '<option value="' + y + '">' + y + "</option>";
  els.year.innerHTML = years;
  els.year.value = String(now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear());
  els.currency.value = /^en-GB/i.test(navigator.language || "") ? "GBP" : "USD";
  if (saved) {
    ["currency", "order", "length", "year"].forEach(function (k) {
      if (saved[k] && els[k].querySelector('option[value="' + saved[k] + '"]')) els[k].value = saved[k];
    });
    if (saved.start) els.start.value = saved.start;
  }
  render();
})();
