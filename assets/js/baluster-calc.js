/* Baluster spacing calculator on /tools/baluster-spacing-calculator/. Needs inch-math.js (window.InchMath).
   The math is the Stair Calculator app's StairEngine.balusters(): n balusters leave n + 1 equal gaps, and n is the
   fewest that keeps every gap at or under the max. Marks are worked out exactly and rounded one by one, so
   rounding never adds up along the rail. */
(function () {
  "use strict";
  var root = document.getElementById("bl");
  var M = window.InchMath;
  if (!root || !M) return;
  var F = ["rail", "post", "width", "gap"];
  var LABEL = { rail: "rail length", post: "post width", width: "baluster width", gap: "max gap" };
  var MAX_COUNT = 500, ZERO = BigInt(0), MM = M.of(254, 10);
  var out = root.querySelector(".bl-out"), draw = root.querySelector(".bl-draw"), unit = root.querySelector("[name=unit]");

  function field(name) { return root.querySelector("[name=" + name + "]"); }
  function len(x) { return unit.value === "mm" ? M.decimal(M.mul(x, MM), 0) + " mm" : M.feetInches(x, 16); }
  function exact(x) { return unit.value === "mm" ? M.decimal(M.mul(x, MM), 1) + " mm" : M.decimal(x, 3) + "″"; }
  function isRounded(x) {
    return unit.value === "mm" ? M.mul(x, MM).d !== BigInt(1) : M.cmp(M.roundTo(x, 16), x) !== 0;
  }

  // In mm, a plain number means millimeters; feet, inch marks and a typed "mm" read the same in either unit.
  function parse(text) {
    var plain = M.number(String(text));
    if (plain && unit.value === "mm") return M.div(plain, MM);
    return M.parseLength(text);
  }
  function asText(x) {
    if (unit.value === "mm") return M.decimal(M.mul(x, MM), 1);
    return M.cmp(M.roundTo(x, 16), x) === 0 ? M.inchPart(x) : M.decimal(x, 3);
  }

  function calculate() {
    var v = {}, bad = null;
    F.forEach(function (name) {
      var x = parse(field(name).value);
      field(name).removeAttribute("aria-invalid");
      if (!x || x.n < ZERO) { if (!bad) bad = name; field(name).setAttribute("aria-invalid", "true"); }
      v[name] = x;
    });
    if (bad) return { error: "Check the " + LABEL[bad] + ". Type it like 6' 0\", 3 1/2, 1.5 or 89 mm." };
    if (v.rail.n <= ZERO) return { error: "Enter a rail length above zero." };
    if (v.width.n <= ZERO) return { error: "Enter a baluster width above zero." };
    if (v.gap.n <= ZERO) return { error: "Enter a max gap above zero." };
    if (M.cmp(v.post, v.rail) >= 0) return { error: "The posts are wider than the rail length." };
    var clear = M.sub(v.rail, v.post);
    var needed = M.div(M.sub(clear, v.gap), M.add(v.width, v.gap));
    var count = needed.n <= ZERO ? 0 : Number(M.ceil(needed));
    if (count > MAX_COUNT) return { error: "That makes more than " + MAX_COUNT + " balusters. Check the values." };
    var gap = M.div(M.sub(clear, M.mul(v.width, M.of(count))), M.of(count + 1));
    return { v: v, clear: clear, count: count, gap: gap, oc: M.add(gap, v.width) };
  }

  function svg(r) {
    var W = 620, H = 210, pad = 14, post = M.num(r.v.post), clear = M.num(r.clear), w = M.num(r.v.width), g = M.num(r.gap);
    var total = clear + post, s = (W - 2 * pad) / (total + post), top = 40, bottom = H - 40, x = function (inch) { return (pad + (inch + post / 2) * s).toFixed(1); };
    var half = post / 2, o = '<svg class="bl-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Rail section drawn to scale with ' + r.count +
      " balusters and " + len(r.gap) + ' gaps">';
    o += '<rect class="bl-post" x="' + x(-half) + '" y="' + (top - 14) + '" width="' + (post * s).toFixed(1) + '" height="' + (bottom - top + 28) + '"/>';
    o += '<rect class="bl-post" x="' + x(total - half) + '" y="' + (top - 14) + '" width="' + (post * s).toFixed(1) + '" height="' + (bottom - top + 28) + '"/>';
    o += '<line class="bl-rail" x1="' + x(half) + '" y1="' + top + '" x2="' + x(total - half) + '" y2="' + top + '"/>';
    o += '<line class="bl-rail" x1="' + x(half) + '" y1="' + bottom + '" x2="' + x(total - half) + '" y2="' + bottom + '"/>';
    for (var k = 0; k < r.count; k++) {
      var x0 = half + g * (k + 1) + w * k;
      o += '<rect class="bl-bal" x="' + x(x0) + '" y="' + top + '" width="' + Math.max(w * s, 1).toFixed(1) + '" height="' + (bottom - top) + '"/>';
    }
    var gy = (top + bottom) / 2;
    o += '<line class="bl-dim" x1="' + x(half) + '" y1="' + gy + '" x2="' + x(half + g) + '" y2="' + gy + '"/>';
    [half, half + g].forEach(function (t) { o += '<line class="bl-dim" x1="' + x(t) + '" y1="' + (gy - 8) + '" x2="' + x(t) + '" y2="' + (gy + 8) + '"/>'; });
    o += '<text class="bl-t" x="' + x(half + g / 2) + '" y="' + (top - 22) + '" text-anchor="' + (r.count ? "start" : "middle") + '">' + len(r.gap) + " gap</text>";
    o += '<line class="bl-dim" x1="' + x(0) + '" y1="' + (H - 12) + '" x2="' + x(total) + '" y2="' + (H - 12) + '"/>';
    o += '<text class="bl-t" x="' + (W / 2) + '" y="' + (H - 18) + '" text-anchor="middle">' + len(r.v.rail) + " post center to post center</text>";
    return o + "</svg>";
  }

  function render() {
    var r = calculate();
    if (r.error) {
      out.innerHTML = '<p class="bl-msg" role="alert">' + r.error + "</p>";
      draw.innerHTML = "";
      return;
    }
    var cells = [["Balusters", String(r.count)], ["Even gap", len(r.gap) + (isRounded(r.gap) ? '<span>exactly ' + exact(r.gap) + "</span>" : "")],
      ["On center", r.count ? len(r.oc) + (isRounded(r.oc) ? '<span>exactly ' + exact(r.oc) + "</span>" : "") : "none"], ["Clear span", len(r.clear)]];
    var html = '<dl class="bl-sum">' + cells.map(function (c) { return "<div><dt>" + c[0] + "</dt><dd>" + c[1] + "</dd></div>"; }).join("") + "</dl>";
    if (!r.count) html += '<p class="bl-msg">The clear span is already at or under your max gap, so this section needs no balusters.</p>';
    else {
      var rows = "", w = r.v.width;
      for (var k = 0; k < r.count; k++) {
        var edge = M.add(M.mul(r.gap, M.of(k + 1)), M.mul(w, M.of(k))), mid = M.add(edge, M.div(w, M.of(2)));
        rows += '<tr><td class="num">' + (k + 1) + '</td><td class="num">' + len(edge) + '</td><td class="num">' + len(mid) + "</td></tr>";
      }
      html += '<details class="bl-list"><summary>Layout marks for all ' + r.count + " balusters</summary>" +
        '<div class="table-wrap"><table><caption>From the face of the first post' + (unit.value === "mm" ? ", to the nearest mm" : ", to the nearest 1/16″") +
        '</caption><thead><tr><th class="num">Baluster</th><th class="num">Near edge</th><th class="num">Center</th></tr></thead><tbody>' + rows + "</tbody></table></div></details>";
    }
    var open = out.querySelector(".bl-list") && out.querySelector(".bl-list").open;
    out.innerHTML = html;
    if (open && out.querySelector(".bl-list")) out.querySelector(".bl-list").open = true;
    draw.innerHTML = svg(r);
    try {
      var keep = { unit: unit.value };
      F.forEach(function (n) { keep[n] = field(n).value; });
      localStorage.setItem("balusters:last", JSON.stringify(keep));
    } catch (e) {}
  }

  try {
    var last = JSON.parse(localStorage.getItem("balusters:last") || "null");
    if (last) {
      F.forEach(function (n) { if (typeof last[n] === "string") field(n).value = last[n]; });
      unit.value = last.unit === "mm" ? "mm" : "in";
    }
  } catch (e) {}
  root.addEventListener("input", render);
  var shown = unit.value;
  unit.addEventListener("change", function () {
    var now = unit.value;
    unit.value = shown;
    var vals = F.map(function (n) { return parse(field(n).value); });
    unit.value = now;
    F.forEach(function (n, i) { if (vals[i]) field(n).value = asText(vals[i]); });
    shown = now;
    render();
  });
  root.addEventListener("submit", function (e) { e.preventDefault(); });
  render();
  root.setAttribute("data-ready", "1");
})();
