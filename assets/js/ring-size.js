var RS_TABLES={"US":[["0",36.546775658],["0.5",37.823518912],["1",39.100262167],["1.5",40.377005421],["2",41.653748675],["2.5",42.93049193],["3",44.207235184],["3.5",45.483978439],["4",46.760721693],["4.5",48.037464948],["5",49.314208202],["5.5",50.590951456],["6",51.867694711],["6.5",53.144437965],["7",54.42118122],["7.5",55.697924474],["8",56.974667728],["8.5",58.251410983],["9",59.528154237],["9.5",60.804897492],["10",62.081640746],["10.5",63.358384001],["11",64.635127255],["11.5",65.911870509],["12",67.188613764],["12.5",68.465357018],["13",69.742100273],["13.5",71.018843527],["14",72.295586781],["14.5",73.572330036],["15",74.84907329],["15.5",76.125816545],["16",77.402559799]],"UK":[["A",37.5],["A½",38.125],["B",38.75],["B½",39.375],["C",40.0],["C½",40.625],["D",41.25],["D½",41.875],["E",42.5],["E½",43.125],["F",43.75],["F½",44.375],["G",45.0],["G½",45.625],["H",46.25],["H½",46.875],["I",47.5],["I½",48.125],["J",48.75],["J½",49.375],["K",50.0],["K½",50.625],["L",51.25],["L½",51.875],["M",52.5],["M½",53.125],["N",53.75],["N½",54.375],["O",55.0],["O½",55.625],["P",56.25],["P½",56.875],["Q",57.5],["Q½",58.125],["R",58.75],["R½",59.375],["S",60.0],["S½",60.625],["T",61.25],["T½",61.875],["U",62.5],["U½",63.125],["V",63.75],["V½",64.375],["W",65.0],["W½",65.625],["X",66.25],["X½",66.875],["Y",67.5],["Y½",68.125],["Z",68.75],["Z+1",70.0],["Z+2",71.25],["Z+3",72.5],["Z+4",73.75],["Z+5",75.0],["Z+6",76.25]],"EU":[["38",38.0],["39",39.0],["40",40.0],["41",41.0],["42",42.0],["43",43.0],["44",44.0],["45",45.0],["46",46.0],["47",47.0],["48",48.0],["49",49.0],["50",50.0],["51",51.0],["52",52.0],["53",53.0],["54",54.0],["55",55.0],["56",56.0],["57",57.0],["58",58.0],["59",59.0],["60",60.0],["61",61.0],["62",62.0],["63",63.0],["64",64.0],["65",65.0],["66",66.0],["67",67.0],["68",68.0],["69",69.0],["70",70.0],["71",71.0],["72",72.0],["73",73.0],["74",74.0],["75",75.0],["76",76.0],["77",77.0]],"JP":[["1",40.840704497],["2",41.887902048],["3",42.935099599],["4",43.98229715],["5",45.029494701],["6",46.076692253],["7",47.123889804],["8",48.171087355],["9",49.218284906],["10",50.265482457],["11",51.312680009],["12",52.35987756],["13",53.407075111],["14",54.454272662],["15",55.501470213],["16",56.548667765],["17",57.595865316],["18",58.643062867],["19",59.690260418],["20",60.737457969],["21",61.784655521],["22",62.831853072],["23",63.879050623],["24",64.926248174],["25",65.973445725],["26",67.020643277],["27",68.067840828],["28",69.115038379],["29",70.16223593],["30",71.209433481]]};
/* Ring size converter on /tools/ring-size-chart/. RS_TABLES (label, inside circumference in mm) is written by build.py
   from the Ring Sizer app's tables; nearest() is the app's RingSizes.nearest(). */
(function () {
  "use strict";
  var root = document.getElementById("rs");
  var T = window.RS_TABLES;
  if (!root || !T) return;
  var mode = root.querySelector("[name=mode]"), value = root.querySelector("[name=value]"), unit = root.querySelector("[name=unit]");
  var system = root.querySelector("[name=system]"), size = root.querySelector("[name=size]"), out = root.querySelector(".rs-out");
  var SYSTEMS = ["US", "UK", "EU", "JP"], NAMES = { US: "US and Canada", UK: "UK and Australia", EU: "EU (ISO)", JP: "Japan" };
  var MIN_D = 12.0, MAX_D = 24.5;

  function nearest(sys, d) {
    var t = T[sys], c = d * Math.PI, best = t[0];
    for (var i = 1; i < t.length; i++) if (Math.abs(t[i][1] - c) < Math.abs(best[1] - c)) best = t[i];
    var low = t[1][1] - t[0][1], high = t[t.length - 1][1] - t[t.length - 2][1];
    if (c < t[0][1] - low / 2 - 1e-9 || c > t[t.length - 1][1] + high / 2 + 1e-9) return null;
    return best;
  }
  function mm(x) { return (Math.round(x * 10) / 10).toFixed(1); }
  function show(el, on) { el.hidden = !on; }

  function fillSizes(keep) {
    var t = T[system.value], html = "";
    for (var i = 0; i < t.length; i++) html += '<option value="' + i + '">' + t[i][0] + "</option>";
    size.innerHTML = html;
    var start = { US: "7", UK: "N½", EU: "54", JP: "14" }[system.value], idx = 0;
    for (var j = 0; j < t.length; j++) if (t[j][0] === (keep || start)) idx = j;
    size.value = String(idx);
  }

  function diameter() {
    if (mode.value === "size") return T[system.value][Number(size.value)][1] / Math.PI;
    var v = Number(String(value.value).trim().replace(",", "."));
    if (!String(value.value).trim() || !isFinite(v)) return null;
    if (unit.value === "in") v *= 25.4;
    var d = mode.value === "c" ? v / Math.PI : v;
    // The limits are shown with one decimal, so accept what the user sees as the edge.
    var lo = mode.value === "c" ? Math.floor(MIN_D * Math.PI * 10) / 10 : MIN_D, hi = mode.value === "c" ? Math.ceil(MAX_D * Math.PI * 10) / 10 : MAX_D;
    var shown = mode.value === "c" ? v : d;
    return shown < lo - 1e-9 || shown > hi + 1e-9 ? null : d;
  }

  function render() {
    var typed = mode.value !== "size";
    show(root.querySelector("[data-typed]"), typed);
    show(root.querySelector("[data-known]"), !typed);
    var d = diameter();
    if (d === null) {
      var c = mode.value === "c";
      out.innerHTML = "<p>Type " + (c ? "the distance around, from " + mm(MIN_D * Math.PI) + " to " + mm(MAX_D * Math.PI) : "the inside diameter, from " + mm(MIN_D) + " to " + mm(MAX_D)) +
        " mm" + (unit.value === "in" ? " (or the same in inches)" : "") + ".</p>";
      return;
    }
    var cards = "";
    SYSTEMS.forEach(function (s) {
      var n = nearest(s, d);
      cards += '<div class="rs-card"><dt>' + NAMES[s] + "</dt><dd>" + (n ? '<strong>' + n[0] + '</strong><span>' + mm(n[1]) + " mm around</span>" : '<strong class="rs-off">Off chart</strong><span>No size this ' + (d < 17 ? "small" : "big") + "</span>") + "</dd></div>";
    });
    out.innerHTML = '<dl class="rs-sum"><div><dt>Inside diameter</dt><dd>' + mm(d) + ' mm</dd></div><div><dt>Around the inside</dt><dd>' + mm(d * Math.PI) + " mm</dd></div></dl>" +
      '<dl class="rs-cards">' + cards + "</dl>";
    try { localStorage.setItem("ringsize:last", JSON.stringify({ mode: mode.value, value: value.value, unit: unit.value, system: system.value, size: T[system.value][Number(size.value)][0] })); } catch (e) {}
  }

  var keep = null;
  try {
    var last = JSON.parse(localStorage.getItem("ringsize:last") || "null");
    if (last) {
      if (["d", "c", "size"].indexOf(last.mode) >= 0) mode.value = last.mode;
      if (typeof last.value === "string") value.value = last.value;
      unit.value = last.unit === "in" ? "in" : "mm";
      if (SYSTEMS.indexOf(last.system) >= 0) system.value = last.system;
      keep = last.size;
    }
  } catch (e) {}
  fillSizes(keep);
  value.addEventListener("input", render);
  var prevMode = mode.value;
  mode.addEventListener("change", function () {
    // Switching between diameter and circumference converts the number already typed instead of rejecting it.
    if (prevMode !== "size" && mode.value !== "size") {
      var now = mode.value;
      mode.value = prevMode;
      var d = diameter();
      mode.value = now;
      if (d !== null) {
        var v = (now === "c" ? d * Math.PI : d) / (unit.value === "in" ? 25.4 : 1);
        value.value = unit.value === "in" ? String(Math.round(v * 1000) / 1000) : mm(v);
      }
    }
    prevMode = mode.value;
    render();
  });
  var prevUnit = unit.value;
  unit.addEventListener("change", function () {
    var v = Number(String(value.value).trim().replace(",", "."));
    if (String(value.value).trim() && isFinite(v) && prevUnit !== unit.value) {
      value.value = unit.value === "in" ? String(Math.round(v / 25.4 * 1000) / 1000) : mm(v * 25.4);
    }
    prevUnit = unit.value;
    render();
  });
  size.addEventListener("change", render);
  system.addEventListener("change", function () { fillSizes(null); render(); });
  root.addEventListener("submit", function (e) { e.preventDefault(); });
  render();
  root.setAttribute("data-ready", "1");
})();
