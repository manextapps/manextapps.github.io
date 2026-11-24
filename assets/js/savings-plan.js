/* Savings goal planner on /tools/savings-goal-calculator/: the same deposit every time between two dates.
   Deposits are counted on the real calendar from the first date (weekly, every two weeks, the 1st and 15th, monthly on
   the same day, clamped to short months, or daily), and the amount is what's left divided by that count, rounded up to
   a cent so the plan never ends short. All money is in whole cents. */
(function () {
  "use strict";
  var root = document.getElementById("sgc");
  if (!root) return;
  var out = root.querySelector(".st-out"), msg = root.querySelector(".st-msg"), cmp = root.querySelector(".sg-compare"), list = root.querySelector(".sg-list");
  var DAY = 86400000;
  var OFTEN = [["week", "Every week"], ["2weeks", "Every two weeks"], ["semi", "1st and 15th"], ["month", "Every month"], ["day", "Every day"]];

  function field(n) { return root.querySelector("[name=" + n + "]"); }
  function cents(t) {
    var s = String(t).replace(/[^\d.,]/g, "").replace(/,(?=\d{3}(\D|$))/g, "").replace(",", ".");
    if (!s) return 0;
    var v = Math.round(parseFloat(s) * 100);
    return isFinite(v) ? v : NaN;
  }
  function money(c) {
    var sym = field("cur").value;
    return sym + (c / 100).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function parseDate(t) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t || "");
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  }
  function iso(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function nice(ms) { return new Date(ms).toLocaleDateString("en", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }); }
  function addMonths(start, k) {
    var d = new Date(start), y = d.getUTCFullYear(), m = d.getUTCMonth() + k, day = d.getUTCDate();
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return Date.UTC(y, m, Math.min(day, last));
  }

  function dates(start, end, often) {
    var out = [], t, k;
    if (often === "week" || often === "2weeks" || often === "day") {
      var step = often === "day" ? DAY : often === "week" ? 7 * DAY : 14 * DAY;
      for (t = start; t <= end && out.length < 4000; t += step) out.push(t);
    } else if (often === "month") {
      for (k = 0; (t = addMonths(start, k)) <= end && out.length < 1200; k++) out.push(t);
    } else {
      var d = new Date(start), y = d.getUTCFullYear(), m = d.getUTCMonth();
      for (k = 0; out.length < 2400; k++) {
        var a = Date.UTC(y, m + k, 1), b = Date.UTC(y, m + k, 15);
        if (a > end) break;
        if (a >= start) out.push(a);
        if (b >= start && b <= end) out.push(b);
      }
    }
    return out;
  }

  function plan(left, start, end, often) {
    var d = dates(start, end, often);
    if (!d.length) return null;
    var each = Math.ceil(left / d.length);
    return { dates: d, each: each, total: each * d.length };
  }

  function render() {
    var goal = cents(field("goal").value), saved = cents(field("saved").value), start = parseDate(field("start").value), end = parseDate(field("end").value), often = field("often").value;
    try { localStorage.setItem("savingsPlan:last", JSON.stringify({ goal: field("goal").value, saved: field("saved").value, often: often, cur: field("cur").value })); } catch (e) {}
    function stop(t) { msg.textContent = t; out.innerHTML = ""; cmp.innerHTML = ""; list.innerHTML = ""; }
    if (!(goal > 0)) return stop("Type the amount you want to reach, like 10000.");
    if (isNaN(saved) || saved < 0) return stop("Check the amount you already have.");
    if (isNaN(start) || isNaN(end)) return stop("Pick a first deposit date and a goal date.");
    if (end < start) return stop("The goal date is before the first deposit.");
    if (end - start > 50 * 366 * DAY) return stop("Pick a goal date within 50 years.");
    var left = goal - saved;
    if (left <= 0) return stop("You already have the full amount.");
    msg.textContent = "";
    var p = plan(left, start, end, often), name = OFTEN.filter(function (o) { return o[0] === often; })[0][1].toLowerCase();
    var rows = [
      ["Save each time", money(p.each), name + ", " + p.dates.length + " deposits"],
      ["First deposit", nice(p.dates[0]), "Last on " + nice(p.dates[p.dates.length - 1])],
      ["You'll end with", money(p.total + saved), p.total > left ? money(p.total - left) + " over, from rounding up to the cent" : "Exactly the goal"],
      ["Per month, on average", money(Math.round(p.total / Math.max(1, (end - start + DAY) / DAY) * 30.4375)), "Spread over " + Math.round((end - start + DAY) / DAY) + " days"],
    ];
    out.innerHTML = '<dl class="st-res">' + rows.map(function (x) { return "<div><dt>" + x[0] + "</dt><dd>" + x[1] + "<span>" + x[2] + "</span></dd></div>"; }).join("") + "</dl>";
    cmp.innerHTML = '<div class="table-wrap"><table><caption>The same goal and dates, saved at other intervals</caption><thead><tr><th>How often</th><th class="num">Deposits</th><th class="num">Each</th><th class="num">You end with</th></tr></thead><tbody>' +
      OFTEN.map(function (o) {
        var q = plan(left, start, end, o[0]);
        return "<tr" + (o[0] === often ? ' class="is-pick"' : "") + "><td>" + o[1] + '</td><td class="num">' + (q ? q.dates.length : 0) + '</td><td class="num">' + (q ? money(q.each) : "") +
          '</td><td class="num">' + (q ? money(q.total + saved) : "") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    var run = saved, body = p.dates.map(function (t, i) {
      run += p.each;
      return "<tr><td class=\"num\">" + (i + 1) + "</td><td>" + nice(t) + '</td><td class="num">' + money(p.each) + '</td><td class="num">' + money(run) + "</td></tr>";
    }).join("");
    list.innerHTML = "<details><summary>Every deposit with its date and running total (" + p.dates.length + ")</summary>" +
      '<div class="table-wrap"><table><thead><tr><th class="num">#</th><th>Date</th><th class="num">Deposit</th><th class="num">Saved so far</th></tr></thead><tbody>' + body + "</tbody></table></div></details>";
  }

  function defaults() {
    var now = new Date(), t = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    field("start").value = iso(t);
    field("end").value = iso(t + 363 * DAY);
  }
  defaults();
  try {
    var last = JSON.parse(localStorage.getItem("savingsPlan:last") || "null");
    if (last) ["goal", "saved", "often", "cur"].forEach(function (n) { if (typeof last[n] === "string") field(n).value = last[n]; });
  } catch (e) {}
  root.addEventListener("input", render);
  root.addEventListener("change", render);
  root.addEventListener("submit", function (e) { e.preventDefault(); });
  root.querySelectorAll("[data-goal]").forEach(function (b) {
    b.addEventListener("click", function () { field("goal").value = b.getAttribute("data-goal"); field("saved").value = "0"; defaults(); render(); });
  });
  root.querySelector("[data-year]").addEventListener("click", function () {
    var y = Number(root.querySelector("[data-year]").getAttribute("data-year"));
    field("start").value = y + "-01-01"; field("end").value = y + "-12-31"; render();
  });
  render();
  root.setAttribute("data-ready", "1");
})();
