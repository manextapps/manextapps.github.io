/* Board foot calculator on /tools/board-foot-calculator/. Needs inch-math.js (window.InchMath) for exact fractions.
   Same formula as the Construction Calculator app's BoardFeet tool: thickness × width × length in inches ÷ 144. */
(function () {
  "use strict";
  var root = document.getElementById("bf");
  var M = window.InchMath;
  if (!root || !M) return;
  var body = root.querySelector(".bf-rows"), out = root.querySelector(".bf-out"), msg = root.querySelector(".bf-msg");
  var MAX_ROWS = 30, KEY = "boardfeet:rows";
  var EXAMPLE = [
    { n: "10", t: "2", w: "6", l: "8", p: "1.10", per: "bf" },
    { n: "3", t: "8/4", w: "6", l: "10", p: "9.50", per: "bf" },
    { n: "4", t: "1", w: "8", l: "6", p: "", per: "bf" },
  ];
  var B144 = M.of(144), CM3_PER_BF = M.of(2359737216, 1000000);

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function rowHtml(r, i) {
    return '<fieldset class="bf-row" data-i="' + i + '"><legend>Line ' + (i + 1) + "</legend>" +
      '<label>Pieces<input name="n" inputmode="numeric" autocomplete="off" value="' + esc(r.n) + '"></label>' +
      '<label>Thickness, in<input name="t" autocomplete="off" value="' + esc(r.t) + '"></label>' +
      '<label>Width, in<input name="w" autocomplete="off" value="' + esc(r.w) + '"></label>' +
      '<label>Length, ft<input name="l" autocomplete="off" value="' + esc(r.l) + '"></label>' +
      '<label>Price<input name="p" inputmode="decimal" autocomplete="off" value="' + esc(r.p) + '"></label>' +
      '<label>Per<select name="per"><option value="bf"' + (r.per === "bf" ? " selected" : "") + '>bd ft</option><option value="lf"' + (r.per === "lf" ? " selected" : "") +
      '>linear ft</option><option value="pc"' + (r.per === "pc" ? " selected" : "") + ">piece</option></select></label>" +
      '<button type="button" class="bf-del" data-del aria-label="Remove line ' + (i + 1) + '">Remove</button><output class="bf-each"></output></fieldset>';
  }

  function readRows() {
    return Array.prototype.map.call(body.querySelectorAll(".bf-row"), function (fs) {
      var o = {};
      ["n", "t", "w", "l", "p", "per"].forEach(function (k) { o[k] = fs.querySelector("[name=" + k + "]").value; });
      return o;
    });
  }

  function draw(rows) { body.innerHTML = rows.map(rowHtml).join(""); }

  /* Inches from a thickness or width: 1 1/2, 1.5, 8/4, 38 mm. */
  function size(text) {
    var x = M.parseLength(String(text).trim());
    return x && x.n > BigInt(0) ? x : null;
  }

  /* Inches from a length: a plain number is feet; 8' 6", 102 in, 2400 mm and 240 cm work too. */
  function length(text) {
    var s = String(text).trim(), x;
    if (!s) return null;
    var cm = /^(.*\S)\s*cm$/i.exec(s);
    if (cm) { x = M.number(cm[1]); x = x && M.div(M.mul(x, M.of(100)), M.of(254)); }
    else if (/['′"″]|ft|feet|foot|in|mm/i.test(s)) x = M.parseLength(s);
    else { x = M.number(s); x = x && M.mul(x, M.of(12)); }
    return x && x.n > BigInt(0) ? x : null;
  }

  function money(x) {
    var r = M.roundTo(x, 100), cents = r.n * BigInt(100) / r.d, txt = (cents / BigInt(100)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return "$" + txt + "." + String(cents % BigInt(100)).padStart(2, "0");
  }
  function bd(x) { return M.decimal(x, 2); }

  function render() {
    var rows = readRows(), fields = body.querySelectorAll(".bf-row"), total = M.of(0), linear = M.of(0), cost = M.of(0), pieces = 0, priced = 0, bad = null;
    rows.forEach(function (r, i) {
      var fs = fields[i], each = fs.querySelector(".bf-each");
      fs.querySelectorAll("input").forEach(function (el) { el.removeAttribute("aria-invalid"); });
      var empty = !r.n.trim() && !r.t.trim() && !r.w.trim() && !r.l.trim();
      if (empty) { each.textContent = ""; return; }
      var n = /^\d{1,5}$/.test(r.n.trim()) ? Number(r.n) : null, t = size(r.t), w = size(r.w), l = length(r.l);
      var p = r.p.trim() ? M.number(r.p.trim().replace(/^\$/, "")) : null;
      [["n", n], ["t", t], ["w", w], ["l", l], ["p", r.p.trim() ? p : true]].forEach(function (f) {
        if (!f[1]) { fs.querySelector("[name=" + f[0] + "]").setAttribute("aria-invalid", "true"); if (!bad) bad = { line: i + 1, field: f[0] }; }
      });
      if (!n || !t || !w || !l || (r.p.trim() && !p)) { each.textContent = "Check this line"; return; }
      var one = M.div(M.mul(M.mul(t, w), l), B144), all = M.mul(one, M.of(n)), lf = M.mul(M.div(l, M.of(12)), M.of(n));
      total = M.add(total, all);
      linear = M.add(linear, lf);
      pieces += n;
      var line = bd(one) + " bd ft each, " + bd(all) + " in all";
      if (p) {
        var c = r.per === "pc" ? M.mul(p, M.of(n)) : r.per === "lf" ? M.mul(p, lf) : M.mul(p, all);
        cost = M.add(cost, c);
        priced++;
        line += ", " + money(c);
        if (r.per !== "bf") line += ", " + money(M.div(c, all)) + " a bd ft";
      }
      each.textContent = line;
    });
    var names = { n: "number of pieces", t: "thickness", w: "width", l: "length", p: "price" };
    msg.textContent = bad ? "Line " + bad.line + ": check the " + names[bad.field] + ". Sizes can be 1 1/2, 1.5, 8/4 or 38 mm, and lengths 8, 8' 6\" or 2400 mm." : "";
    var cubicFt = M.div(total, M.of(12)), m3 = M.div(M.mul(total, CM3_PER_BF), M.of(1000000));
    var parts = [["Total", bd(total) + " board feet"], ["Pieces", String(pieces)], ["Linear feet", M.decimal(linear, 2)], ["Cubic feet", M.decimal(cubicFt, 3)], ["Cubic meters", M.decimal(m3, 4)]];
    if (priced) parts.push(["Cost", money(cost) + (priced < rows.filter(function (r) { return r.n.trim(); }).length ? ", priced lines only" : "")]);
    out.innerHTML = '<dl class="st-res">' + parts.map(function (x) { return "<div><dt>" + x[0] + "</dt><dd>" + x[1] + "</dd></div>"; }).join("") + "</dl>";
    try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch (e) {}
    root.setAttribute("data-total", M.decimal(total, 6));
  }

  root.addEventListener("input", render);
  root.addEventListener("change", render);
  root.addEventListener("submit", function (e) { e.preventDefault(); });
  root.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var rows = readRows();
    if (b.hasAttribute("data-add")) {
      if (rows.length >= MAX_ROWS) return;
      var last = rows[rows.length - 1] || { per: "bf" };
      rows.push({ n: "1", t: last.t || "", w: "", l: last.l || "", p: "", per: last.per || "bf" });
      draw(rows);
      body.querySelector(".bf-row:last-child [name=w]").focus();
    } else if (b.hasAttribute("data-del")) {
      var i = Number(b.closest(".bf-row").getAttribute("data-i"));
      rows.splice(i, 1);
      if (!rows.length) rows.push({ n: "", t: "", w: "", l: "", p: "", per: "bf" });
      draw(rows);
    } else if (b.hasAttribute("data-reset")) {
      draw(EXAMPLE);
    } else return;
    render();
  });

  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  var ok = Array.isArray(saved) && saved.length && saved.length <= MAX_ROWS && saved.every(function (r) { return r && typeof r.n === "string"; });
  draw(ok ? saved : EXAMPLE);
  render();
  root.setAttribute("data-ready", "1");
})();
