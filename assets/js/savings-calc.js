/* 52 week savings challenge calculator. Same amounts as the Savings Challenge app (domain/Plan.kt):
 * cell n saves n x the first amount, laid out small first, big first or shuffled; 26 paydays every
 * two weeks; 100 envelopes numbered 1 to 100. Money is kept in cents so totals never drift. */
(function () {
  "use strict";
  var root = document.getElementById("savings-tool");
  if (!root) return;

  var TYPES = {
    weeks: { count: 52, step: 7, base: "1", unit: "Week", title: "52 week savings challenge" },
    paydays: { count: 26, step: 14, base: "10", unit: "Payday", title: "26 payday savings challenge" },
    envelopes: { count: 100, step: 0, base: "1", unit: "Envelope", title: "100 envelope challenge" },
  };
  var CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "NZD", "INR", "ZAR", "PHP", "NGN"];

  var form = root.querySelector("form");
  var els = {
    base: form.querySelector("[name=base]"),
    order: form.querySelector("[name=order]"),
    start: form.querySelector("[name=start]"),
    currency: form.querySelector("[name=currency]"),
    baseLabel: root.querySelector("[data-base-label]"),
    summary: root.querySelector(".sv-summary"),
    chart: root.querySelector(".sv-chart"),
    printHead: root.querySelector(".sv-print-head"),
    reshuffle: root.querySelector("[data-reshuffle]"),
    draw: root.querySelector("[data-draw]"),
    drawOut: root.querySelector(".sv-draw-out"),
  };
  var state = { type: "weeks", seed: 1, done: {} };

  function store(key, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(key) || "null");
      localStorage.setItem(key, JSON.stringify(value));
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
        style: "currency", currency: currency, currencyDisplay: "narrowSymbol",
        minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2,
      }).format(cents / 100);
    } catch (e) {
      return (cents / 100).toFixed(whole ? 0 : 2);
    }
  }

  function parseDay(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
  }

  function dayLabel(ms) {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(ms));
  }

  function seededShuffle(list, seed) {
    var s = seed >>> 0;
    function next() {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(next() * (i + 1));
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  function settings() {
    var t = TYPES[state.type];
    var base = Math.round(parseFloat(String(els.base.value).replace(",", ".")) * 100);
    if (!isFinite(base) || base < 0) base = 0;
    base = Math.min(base, 100000000);
    return {
      type: state.type, t: t, base: base, order: els.order.value,
      start: parseDay(els.start.value), currency: els.currency.value, seed: state.seed,
    };
  }

  function plan(s) {
    var amounts = [];
    for (var i = 1; i <= s.t.count; i++) amounts.push(i * s.base);
    if (s.type !== "envelopes") {
      if (s.order === "down") amounts.reverse();
      else if (s.order === "random") seededShuffle(amounts, s.seed);
    }
    var running = 0;
    return amounts.map(function (a, i) {
      running += a;
      return {
        n: i + 1, amount: a, total: running,
        date: s.type === "envelopes" || s.start === null ? null : s.start + i * s.t.step * 86400000,
      };
    });
  }

  function key(s) {
    return "savings:done:" + [s.type, s.base, s.type === "envelopes" ? "" : s.order, s.type === "envelopes" ? "" : els.start.value, s.order === "random" ? s.seed : ""].join("|");
  }

  function render() {
    var s = settings();
    var rows = plan(s);
    var t = s.t;
    state.done = store(key(s)) || {};
    els.baseLabel.textContent = "Amount for " + t.unit.toLowerCase() + " 1";
    root.querySelectorAll("[data-only]").forEach(function (el) {
      el.hidden = el.getAttribute("data-only").split(" ").indexOf(state.type) < 0;
    });
    els.reshuffle.hidden = state.type === "envelopes" || s.order !== "random";
    root.querySelectorAll("[data-type]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-type") === state.type));
    });

    var total = rows.length ? rows[rows.length - 1].total : 0;
    var saved = rows.reduce(function (sum, r) { return sum + (state.done[r.n] ? r.amount : 0); }, 0);
    var savedCount = rows.filter(function (r) { return state.done[r.n]; }).length;
    var last = rows[rows.length - 1];
    var biggest = s.base * t.count;
    var parts = [
      ["Total at the end", money(total, s.currency)],
      ["Biggest single save", money(biggest, s.currency)],
      [state.type === "envelopes" ? "Envelopes" : state.type === "weeks" ? "Weeks" : "Paydays", String(t.count)],
    ];
    if (last && last.date !== null) parts.push(["Last save", dayLabel(last.date)]);
    parts.push(["Saved so far", money(saved, s.currency) + " (" + savedCount + " of " + t.count + ")"]);
    els.summary.innerHTML = parts.map(function (p) {
      return "<div><dt>" + p[0] + "</dt><dd>" + p[1] + "</dd></div>";
    }).join("");

    var cur = s.currency;
    var orderName = { up: "small first", down: "big first", random: "random order" }[s.order];
    els.printHead.textContent = t.title.charAt(0).toUpperCase() + t.title.slice(1) + ": " + money(s.base, cur) + " to start, " +
      (state.type === "envelopes" ? "" : orderName + ", ") + money(total, cur) + " in total";

    if (state.type === "envelopes") {
      var cells = rows.map(function (r) {
        return '<li><button type="button" class="sv-env' + (state.done[r.n] ? " is-done" : "") + '" data-cell="' + r.n +
          '" aria-pressed="' + Boolean(state.done[r.n]) + '"><span>#' + r.n + "</span>" + money(r.amount, cur) + "</button></li>";
      }).join("");
      els.chart.innerHTML = '<ol class="sv-grid" aria-label="Envelopes 1 to 100">' + cells + "</ol>";
    } else {
      var body = rows.map(function (r) {
        var id = "sv-row-" + r.n;
        return '<tr class="' + (state.done[r.n] ? "is-done" : "") + '"><td class="num">' + r.n + "</td><td>" +
          (r.date === null ? "" : dayLabel(r.date)) + '</td><td class="num">' + money(r.amount, cur) + '</td><td class="num">' +
          money(r.total, cur) + '</td><td class="sv-check"><input type="checkbox" id="' + id + '" data-cell="' + r.n + '"' +
          (state.done[r.n] ? " checked" : "") + '><label for="' + id + '"><span class="visually-hidden">Saved ' + t.unit.toLowerCase() + " " + r.n + "</span></label></td></tr>";
      }).join("");
      els.chart.innerHTML = '<div class="table-wrap"><table class="sv-table"><thead><tr><th class="num">' + t.unit +
        '</th><th>Date</th><th class="num">Save</th><th class="num">Total so far</th><th class="sv-check">Done</th></tr></thead><tbody>' +
        body + "</tbody></table></div>";
    }
    els.drawOut.textContent = "";
    store("savings:settings", { type: state.type, base: els.base.value, order: els.order.value, start: els.start.value, currency: els.currency.value, seed: state.seed });
  }

  function toggle(n, on) {
    var s = settings();
    if (on) state.done[n] = 1;
    else delete state.done[n];
    store(key(s), state.done);
    render();
  }

  /* ---------- PDF: one A4 page, Helvetica, written by hand ---------- */

  var WIN_ANSI = { "€": "\\200", "£": "\\243", "¥": "\\245", " ": " ", " ": " ", "–": "-", "’": "'" };

  function pdfText(str) {
    var out = "";
    for (var i = 0; i < str.length; i++) {
      var ch = str.charAt(i);
      if (ch === "(" || ch === ")" || ch === "\\") out += "\\" + ch;
      else if (str.charCodeAt(i) < 128) out += ch;
      else if (WIN_ANSI[ch]) out += WIN_ANSI[ch];
      else out += "?";
    }
    return out;
  }

  function pdfMoney(cents, currency) {
    var m = money(cents, currency);
    for (var i = 0; i < m.length; i++) {
      var code = m.charCodeAt(i);
      if (code > 127 && !WIN_ANSI[m.charAt(i)]) return currency + " " + (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
    }
    return m;
  }

  function buildPdf() {
    var s = settings();
    var rows = plan(s);
    var cur = s.currency;
    var W = 595, H = 842, ops = [];
    function text(x, y, size, str, bold) {
      ops.push("BT /" + (bold ? "F2" : "F1") + " " + size + " Tf " + x + " " + y + " Td (" + pdfText(str) + ") Tj ET");
    }
    function rect(x, y, w, h, fill) { ops.push(x + " " + y + " " + w + " " + h + " re " + (fill ? "f" : "S")); }

    var total = rows[rows.length - 1].total;
    text(40, 800, 18, s.t.title.charAt(0).toUpperCase() + s.t.title.slice(1), true);
    text(40, 780, 10, pdfMoney(s.base, cur) + " to start, " + pdfMoney(total, cur) + " in total" +
      (s.type === "envelopes" ? ". Draw an envelope, save the amount, cross it off." : ". Tick each box when the money is set aside."));
    ops.push("0.6 w 0.2 0.25 0.5 RG");

    if (s.type === "envelopes") {
      var cw = 51.5, ch = 66, x0 = 40, y0 = 740;
      rows.forEach(function (r, i) {
        var col = i % 10, row = Math.floor(i / 10);
        var x = x0 + col * cw, y = y0 - row * ch;
        rect(x, y - ch + 4, cw - 4, ch - 4);
        text(x + 5, y - 16, 8, "#" + r.n);
        text(x + 5, y - 38, 10, pdfMoney(r.amount, cur), true);
      });
    } else {
      var perCol = Math.ceil(rows.length / 2), colW = 262, rowH = Math.min(26, 700 / (perCol + 1));
      [0, 1].forEach(function (c) {
        var x = 40 + c * (colW + 11), y = 748;
        text(x, y, 8, s.t.unit, true);
        text(x + 40, y, 8, "Date", true);
        text(x + 120, y, 8, "Save", true);
        text(x + 175, y, 8, "Total", true);
        rows.slice(c * perCol, (c + 1) * perCol).forEach(function (r, i) {
          var yy = y - (i + 1) * rowH;
          text(x, yy, 9, String(r.n));
          text(x + 40, yy, 9, r.date === null ? "" : dayLabel(r.date));
          text(x + 120, yy, 9, pdfMoney(r.amount, cur), true);
          text(x + 175, yy, 9, pdfMoney(r.total, cur));
          rect(x + 240, yy - 2, 10, 10);
        });
      });
    }
    text(40, 30, 8, "Made with the calculator at www.manextapps.com/tools/52-week-savings-challenge/");

    var content = ops.join("\n");
    var objs = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + W + " " + H + "] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
      "<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream",
    ];
    var pdf = "%PDF-1.4\n";
    var offsets = [];
    objs.forEach(function (o, i) {
      offsets.push(pdf.length);
      pdf += (i + 1) + " 0 obj\n" + o + "\nendobj\n";
    });
    var xref = pdf.length;
    pdf += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n";
    offsets.forEach(function (o) { pdf += String(o).padStart(10, "0") + " 00000 n \n"; });
    pdf += "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
    return pdf;
  }

  function downloadPdf() {
    var blob = new Blob([buildPdf()], { type: "application/pdf" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = TYPES[state.type].title.replace(/ /g, "-") + ".pdf";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-type")) {
      state.type = b.getAttribute("data-type");
      els.base.value = TYPES[state.type].base;
      render();
    } else if (b.hasAttribute("data-cell")) {
      var n = Number(b.getAttribute("data-cell"));
      toggle(n, !state.done[n]);
    } else if (b.hasAttribute("data-reshuffle")) {
      state.seed = (Math.random() * 4294967296) >>> 0;
      render();
    } else if (b.hasAttribute("data-print")) {
      window.print();
    } else if (b.hasAttribute("data-pdf")) {
      downloadPdf();
    } else if (b.hasAttribute("data-draw")) {
      var rows = plan(settings()).filter(function (r) { return !state.done[r.n]; });
      if (!rows.length) {
        els.drawOut.textContent = "Every envelope is done. That's the whole challenge.";
        return;
      }
      var pick = rows[Math.floor(Math.random() * rows.length)];
      els.drawOut.textContent = "Envelope " + pick.n + ": put " + money(pick.amount, els.currency.value) + " aside, then tap it below to mark it done.";
    }
  });
  root.addEventListener("change", function (e) {
    if (e.target.matches("input[type=checkbox][data-cell]")) toggle(Number(e.target.getAttribute("data-cell")), e.target.checked);
    else render();
  });
  form.addEventListener("input", function (e) {
    if (e.target === els.base) render();
  });
  form.addEventListener("submit", function (e) { e.preventDefault(); });

  // Printing shows only the chart: a copy goes into its own container, the rest of the page is hidden.
  var printRoot = document.createElement("div");
  printRoot.id = "sv-print-root";
  document.body.appendChild(printRoot);
  window.addEventListener("beforeprint", function () {
    var src = root.querySelector(".sv-printable");
    printRoot.innerHTML = src.innerHTML;
    printRoot.querySelectorAll("[id]").forEach(function (el) { el.removeAttribute("id"); });
    printRoot.querySelectorAll("input[data-cell]").forEach(function (box) {
      box.checked = Boolean(state.done[box.getAttribute("data-cell")]);
    });
  });
  window.addEventListener("afterprint", function () { printRoot.innerHTML = ""; });

  CURRENCIES.forEach(function (c) {
    var o = document.createElement("option");
    o.value = c;
    o.textContent = c + " " + money(100, c).replace(/[\d.,\s]/g, "");
    els.currency.appendChild(o);
  });

  var saved = store("savings:settings");
  var now = new Date();
  els.start.value = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  els.currency.value = guessCurrency();
  if (saved) {
    state.type = TYPES[saved.type] ? saved.type : "weeks";
    els.base.value = saved.base;
    els.order.value = saved.order;
    if (saved.start) els.start.value = saved.start;
    if (CURRENCIES.indexOf(saved.currency) >= 0) els.currency.value = saved.currency;
    state.seed = saved.seed || 1;
  }
  render();
})();
