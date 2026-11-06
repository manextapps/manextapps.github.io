/* Debt snowball and avalanche calculator on /tools/debt-snowball-calculator/. The math is debt-engine.js
   (window.DebtEngine), the Debt Payoff Planner app's engine; the wording of the warnings follows the app. */
(function () {
  "use strict";
  var root = document.getElementById("dd");
  var E = window.DebtEngine;
  if (!root || !E) return;
  var list = root.querySelector(".dd-debts"), out = root.querySelector(".dd-out");
  var extraIn = root.querySelector("[name=extra]"), startIn = root.querySelector("[name=start]");
  var MAX_BALANCE = 1e10, MAX_PAYMENT = 1e9, MAX_APR = 100000, MAX_ROWS = 20;
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var EXAMPLE = [["Store card", "1240", "24.9", "40"], ["Student loan", "3450", "4.5", "60"], ["Visa", "4860", "21.5", "120"], ["Car loan", "8900", "6.9", "260"]];

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function money(c) { return "$" + Math.floor((c + 50) / 100).toLocaleString("en-US"); }

  // Amounts.parseDecimal() from the app, with a dot as the decimal separator: "1,240.50", "1240,5" and "$1240" all read.
  function parse(text, decimals) {
    var t = String(text).trim().replace(/[$%\s]/g, "");
    if (!t || /-/.test(t)) return null;
    var cleaned = t.replace(/[^0-9.,]/g, "");
    if (cleaned !== t || !/[0-9]/.test(cleaned)) return null;
    var dot = cleaned.lastIndexOf("."), comma = cleaned.lastIndexOf(","), sep = null;
    if (dot >= 0 && comma >= 0) sep = dot > comma ? "." : ",";
    else if (dot >= 0 || comma >= 0) {
      var mark = dot >= 0 ? "." : ",", count = cleaned.split(mark).length - 1, after = cleaned.length - cleaned.lastIndexOf(mark) - 1;
      sep = count > 1 || (after === 3 && mark !== ".") ? null : mark;
    }
    var whole, frac = "";
    if (sep === null) whole = cleaned.replace(/[.,]/g, "");
    else {
      if (cleaned.split(sep).length - 1 > 1) return null;
      var cut = cleaned.lastIndexOf(sep);
      whole = cleaned.slice(0, cut).replace(/[.,]/g, "") || "0";
      frac = cleaned.slice(cut + 1);
      if (!/^[0-9]*$/.test(frac) || frac.length > decimals) return null;
    }
    while (frac.length < decimals) frac += "0";
    var n = Number(whole + frac);
    return isFinite(n) && n <= Number.MAX_SAFE_INTEGER ? n : null;
  }

  function addRow(values) {
    var v = values || ["", "", "", ""], row = document.createElement("fieldset");
    row.className = "dd-row";
    row.innerHTML = '<legend class="visually-hidden">Debt</legend>' +
      '<label class="dd-name">Name<input name="name" autocomplete="off" maxlength="40" placeholder="Credit card" value="' + esc(v[0]) + '"></label>' +
      '<label>Balance $<input name="balance" inputmode="decimal" autocomplete="off" value="' + esc(v[1]) + '"></label>' +
      '<label>APR %<input name="apr" inputmode="decimal" autocomplete="off" value="' + esc(v[2]) + '"></label>' +
      '<label>Minimum $<input name="minimum" inputmode="decimal" autocomplete="off" value="' + esc(v[3]) + '"></label>' +
      '<button type="button" class="dd-remove" aria-label="Remove this debt">Remove</button>';
    list.appendChild(row);
  }

  function rows() { return Array.prototype.slice.call(list.querySelectorAll(".dd-row")); }

  function read() {
    var debts = [], problems = [];
    rows().forEach(function (row, i) {
      var f = function (n) { return row.querySelector("[name=" + n + "]"); };
      var raw = ["name", "balance", "apr", "minimum"].map(function (n) { return f(n).value.trim(); });
      row.querySelectorAll("input").forEach(function (el) { el.removeAttribute("aria-invalid"); });
      if (!raw.join("")) return;
      var name = raw[0] || "Debt " + (i + 1);
      var balance = parse(raw[1], 2), apr = parse(raw[2] || "0", 3), minimum = parse(raw[3], 2), bad = [];
      if (balance === null || balance > MAX_BALANCE) bad.push(["balance", "the balance"]);
      if (apr === null || apr > MAX_APR) bad.push(["apr", "the APR (0 to 100)"]);
      if (minimum === null || minimum > MAX_PAYMENT) bad.push(["minimum", "the minimum payment"]);
      bad.forEach(function (b) { f(b[0]).setAttribute("aria-invalid", "true"); });
      if (bad.length) problems.push(esc(name) + ": check " + bad.map(function (b) { return b[1]; }).join(" and ") + ".");
      else debts.push({ name: name, balance: balance, apr: apr, minimum: minimum });
    });
    return { debts: debts, problems: problems };
  }

  function startMonth() {
    var m = /^(\d{4})-(\d{2})$/.exec(startIn.value);
    if (m) return { y: Number(m[1]), m: Number(m[2]) - 1 };
    var now = new Date();
    return { y: now.getFullYear() + (now.getMonth() === 11 ? 1 : 0), m: (now.getMonth() + 1) % 12 };
  }
  function monthLabel(start, month) {
    var k = start.y * 12 + start.m + month - 1;
    return MONTHS[k % 12] + " " + Math.floor(k / 12);
  }
  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }

  function chart(results) {
    var w = 600, h = 220, pad = 8, series = [], max = 0, len = 0;
    results.forEach(function (r) { if (r.res.payoff) { max = Math.max(max, r.res.balances[0]); len = Math.max(len, r.res.balances.length - 1); } });
    if (!max || !len) return "";
    results.forEach(function (r) {
      if (!r.res.payoff) return;
      var pts = r.res.balances.map(function (b, i) {
        return (pad + (w - 2 * pad) * i / len).toFixed(1) + "," + (pad + (h - 2 * pad) * (1 - b / max)).toFixed(1);
      });
      series.push('<polyline class="dd-line ' + r.key + '" points="' + pts.join(" ") + '"/>');
    });
    var legend = results.filter(function (r) { return r.res.payoff; }).map(function (r) {
      return '<span class="dd-key ' + r.key + '">' + r.label + "</span>";
    }).join("");
    return '<figure class="dd-chart"><figcaption>Total balance, month by month</figcaption><svg viewBox="0 0 ' + w + " " + h +
      '" preserveAspectRatio="none" role="img" aria-label="Total balance falling to zero for each method">' + '<line class="dd-axis" x1="' + pad + '" y1="' + (h - pad) + '" x2="' + (w - pad) +
      '" y2="' + (h - pad) + '"/>' + series.join("") + '</svg><p class="dd-legend">' + legend + "</p></figure>";
  }

  function card(r, start) {
    var res = r.res;
    if (!res.payoff) {
      return '<div class="dd-card"><h3>' + r.label + '</h3><p class="dd-big">No payoff date</p><p>Your ' + money(res.budget) +
        " a month does not get ahead of the interest, so the balance never reaches zero within 50 years. The first month alone adds " +
        money(res.firstInterest) + " of interest. Raise the extra payment to see a date.</p></div>";
    }
    var steps = res.order.map(function (o) {
      return "<li><strong>" + esc(o.debt.name) + "</strong>, paid off " + monthLabel(start, o.month) + "</li>";
    }).join("");
    return '<div class="dd-card"><h3>' + r.label + '</h3><p class="dd-label">Debt free</p><p class="dd-big">' + monthLabel(start, res.months) +
      '</p><p class="dd-sub">in ' + plural(res.months, "month") + '</p><dl><div><dt>Interest</dt><dd>' + money(res.interest) +
      "</dd></div><div><dt>Total paid</dt><dd>" + money(res.balances[0] + res.interest) + '</dd></div></dl><p class="dd-label">Payoff order</p><ol>' + steps + "</ol></div>";
  }

  function compare(snow, ava) {
    if (!snow.payoff || !ava.payoff) return "";
    var d = Math.floor((snow.interest + 50) / 100) - Math.floor((ava.interest + 50) / 100), m = snow.months - ava.months, out = [];
    out.push(d > 0 ? "Avalanche saves $" + d.toLocaleString("en-US") + " in interest." : d < 0 ? "Snowball saves $" + (-d).toLocaleString("en-US") + " in interest." :
      "Both pay the same interest, to the dollar.");
    out.push(m > 0 ? "Avalanche finishes " + plural(m, "month") + " sooner." : m < 0 ? "Snowball finishes " + plural(-m, "month") + " sooner." :
      "Both finish in the same month.");
    var first = function (r) { return Math.min.apply(null, r.order.map(function (o) { return o.month; })); };
    var w = first(ava) - first(snow);
    if (w > 0) out.push("Snowball pays off its first debt " + plural(w, "month") + " earlier.");
    else if (w < 0) out.push("Avalanche pays off its first debt " + plural(-w, "month") + " earlier.");
    return '<p class="dd-compare">' + out.join(" ") + "</p>";
  }

  function render() {
    var data = read(), start = startMonth();
    var extra = parse(extraIn.value.trim() || "0", 2), html = "";
    extraIn.removeAttribute("aria-invalid");
    if (extra === null || extra > MAX_PAYMENT) { extraIn.setAttribute("aria-invalid", "true"); data.problems.push("Check the extra payment."); extra = 0; }
    if (data.problems.length) html += '<div class="dd-warn" role="alert"><p>' + data.problems.join("</p><p>") + "</p></div>";
    if (!data.debts.some(function (d) { return d.balance > 0; })) {
      out.innerHTML = html + "<p>Add each debt with its balance, APR and minimum payment.</p>";
      save();
      return;
    }
    var snow = E.simulate(data.debts, extra, "snowball"), ava = E.simulate(data.debts, extra, "avalanche"), mins = E.simulate(data.debts, 0, "snowball");
    if (snow.shortfalls.length) {
      html += '<div class="dd-warn"><p><strong>Minimum payment warning.</strong></p>' + snow.shortfalls.map(function (s) {
        return "<p>" + esc(s.debt.name) + ": its minimum (" + money(s.debt.minimum) + ") is below the first month of interest (" + money(s.interest) +
          "), so it grows until it becomes the target.</p>";
      }).join("") + "</div>";
    }
    html += '<p class="dd-budget">You pay ' + money(snow.budget) + " a month in total: " + money(snow.budget - Math.max(extra, 0)) + " of minimums plus " + money(Math.max(extra, 0)) + " extra.</p>";
    html += compare(snow, ava);
    var results = [{ key: "snow", label: "Snowball", res: snow }, { key: "ava", label: "Avalanche", res: ava }];
    html += '<div class="dd-cards">' + results.map(function (r) { return card(r, start); }).join("") + "</div>";
    html += '<p class="dd-mins">Minimums only, ' + money(mins.budget) + " a month: " +
      (mins.payoff ? "debt free " + monthLabel(start, mins.months) + ", interest " + money(mins.interest) + "." : "no payoff with minimums alone.") + "</p>";
    html += chart(results.concat([{ key: "mins", label: "Minimums only", res: mins }]));
    out.innerHTML = html;
    save();
  }

  function save() {
    try {
      localStorage.setItem("debt:last", JSON.stringify({
        extra: extraIn.value, start: startIn.value,
        debts: rows().map(function (r) { return ["name", "balance", "apr", "minimum"].map(function (n) { return r.querySelector("[name=" + n + "]").value; }); })
      }));
    } catch (e) {}
  }

  function load() {
    try {
      var last = JSON.parse(localStorage.getItem("debt:last") || "null");
      if (last && Array.isArray(last.debts) && last.debts.length) {
        last.debts.slice(0, MAX_ROWS).forEach(function (d) { addRow(Array.isArray(d) ? d.map(String) : null); });
        extraIn.value = String(last.extra || "");
        if (/^\d{4}-\d{2}$/.test(last.start || "")) startIn.value = last.start;
        return;
      }
    } catch (e) {}
    EXAMPLE.forEach(function (d) { addRow(d); });
  }

  function syncButtons() {
    root.querySelector("[data-add]").disabled = rows().length >= MAX_ROWS;
    rows().forEach(function (r) { r.querySelector(".dd-remove").disabled = rows().length === 1; });
  }

  load();
  if (!startIn.value) { var s = startMonth(); startIn.value = s.y + "-" + String(s.m + 1).padStart(2, "0"); }
  syncButtons();
  root.addEventListener("input", render);
  root.addEventListener("change", render);
  root.addEventListener("click", function (e) {
    var t = e.target;
    if (t.closest(".dd-remove")) {
      var row = t.closest(".dd-row"), next = row.nextElementSibling || row.previousElementSibling;
      row.remove();
      if (next) next.querySelector("input").focus();
    } else if (t.closest("[data-add]")) {
      addRow();
      var all = rows();
      all[all.length - 1].querySelector("input").focus();
    } else if (t.closest("[data-example]")) {
      list.innerHTML = "";
      EXAMPLE.forEach(function (d) { addRow(d); });
      extraIn.value = "150";
    } else if (t.closest("[data-clear]")) {
      list.innerHTML = "";
      addRow();
      extraIn.value = "";
      list.querySelector("input").focus();
    } else return;
    syncButtons();
    render();
  });
  root.addEventListener("submit", function (e) { e.preventDefault(); });
  render();
  root.setAttribute("data-ready", "1");
})();
