/* Bingo card generator on /tools/bingo-card-generator/. The numbered cards are a straight port of the Bingo Caller
   app's docs/card_algorithm.js (v1): the same game type and card number give the same card on paper and in the app.
   Never change the math in card75, ticket90 or card30, or printed cards stop matching the app. */
(function () {
  "use strict";

  var SALT = 0x42494e47;
  var MAX_CARD = 999;

  function seedFor(balls, card) { return (SALT ^ (balls << 16) ^ card) >>> 0; }

  function mulberry32(seed) {
    var a = seed | 0;
    return function next() {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (t ^ (t >>> 14)) >>> 0;
    };
  }

  function below(next, n) { return Math.floor((next() * n) / 4294967296); }

  function shuffle(next, values) {
    for (var i = values.length - 1; i > 0; i--) {
      var j = below(next, i + 1), tmp = values[i];
      values[i] = values[j];
      values[j] = tmp;
    }
    return values;
  }

  function range(from, to) { var out = []; for (var v = from; v <= to; v++) out.push(v); return out; }

  function checkCard(card) {
    if (card !== Math.floor(card) || card < 1 || card > MAX_CARD) throw new RangeError("card must be 1 to 999");
  }

  function card75(card) {
    checkCard(card);
    var next = mulberry32(seedFor(75, card)), rows = [[], [], [], [], []];
    for (var c = 0; c < 5; c++) {
      var pool = shuffle(next, range(15 * c + 1, 15 * c + 15));
      for (var r = 0; r < 5; r++) rows[r].push(pool[r]);
    }
    rows[2][2] = 0;
    return rows;
  }

  function ticket90(card) {
    checkCard(card);
    var next = mulberry32(seedFor(90, card)), counts = [1, 1, 1, 1, 1, 1, 1, 1, 1], c, k;
    for (k = 0; k < 6; k++) {
      var open = [];
      for (c = 0; c < 9; c++) if (counts[c] < 3) open.push(c);
      counts[open[below(next, open.length)]] += 1;
    }
    var order = range(0, 8).sort(function (x, y) { return counts[y] - counts[x]; });
    var left = [5, 5, 5], rowsOf = new Array(9);
    order.forEach(function (col) {
      var rows = shuffle(next, [0, 1, 2]).sort(function (x, y) { return left[y] - left[x]; });
      var picked = rows.slice(0, counts[col]).sort(function (x, y) { return x - y; });
      picked.forEach(function (r) { left[r] -= 1; });
      rowsOf[col] = picked;
    });
    var grid = [[0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0]];
    for (c = 0; c < 9; c++) {
      var lo = c === 0 ? 1 : 10 * c, hi = c === 8 ? 90 : 10 * c + 9;
      var numbers = shuffle(next, range(lo, hi)).slice(0, counts[c]).sort(function (x, y) { return x - y; });
      rowsOf[c].forEach(function (r, i) { grid[r][c] = numbers[i]; });
    }
    return grid;
  }

  function card30(card) {
    checkCard(card);
    var next = mulberry32(seedFor(30, card));
    var numbers = shuffle(next, range(1, 30)).slice(0, 9).sort(function (x, y) { return x - y; });
    return [numbers.slice(0, 3), numbers.slice(3, 6), numbers.slice(6, 9)];
  }

  function cardFor(balls, card) {
    if (balls === 75) return card75(card);
    if (balls === 90) return ticket90(card);
    if (balls === 30) return card30(card);
    throw new RangeError("balls must be 75, 90 or 30");
  }

  /* Word cards (site only, not in the app): 24 words per card around a FREE centre. The set code seeds the draw and
     the words are sorted first, so the same code and the same words give the same cards in any typing order. */
  var WORD_SALT = 0x574f5244;
  var CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  function fnv(text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
    return h >>> 0;
  }

  function cleanWords(text) {
    var seen = {}, out = [];
    String(text || "").split(/[\n,;]+/).forEach(function (w) {
      w = w.replace(/\s+/g, " ").trim();
      var k = w.toLowerCase();
      if (w && !seen[k]) { seen[k] = 1; out.push(w); }
    });
    return out;
  }

  function sortWords(words) {
    return words.slice().sort(function (a, b) {
      var x = a.toLowerCase(), y = b.toLowerCase();
      return x < y ? -1 : x > y ? 1 : a < b ? -1 : a > b ? 1 : 0;
    });
  }

  function wordCards(words, code, count) {
    var list = sortWords(words), base = (fnv(code + "|" + list.join("\n")) ^ WORD_SALT) >>> 0, seen = {}, cards = [];
    for (var k = 1; k <= count; k++) {
      for (var attempt = 0; attempt < 50; attempt++) {
        var next = mulberry32((base ^ Math.imul(k + attempt * 1000, 0x9e3779b1)) >>> 0);
        var pick = shuffle(next, list.slice()).slice(0, 24);
        var rows = [pick.slice(0, 5), pick.slice(5, 10), pick.slice(10, 12).concat([""], pick.slice(12, 14)), pick.slice(14, 19), pick.slice(19, 24)];
        var sig = rows.map(function (r) { return r.join("\u0001"); }).join("\u0002");
        if (!seen[sig]) { seen[sig] = 1; cards.push(rows); break; }
      }
    }
    return cards;
  }

  window.BingoCards = { card75: card75, ticket90: ticket90, card30: card30, cardFor: cardFor, cleanWords: cleanWords, wordCards: wordCards };

  var root = document.getElementById("bg");
  if (!root) return;

  /* Print layouts: [orientation, columns, rows] of cards on a sheet. */
  var GAMES = {
    "75": { balls: 75, cols: 5, rows: 5, letters: true, per: { 1: ["portrait", 1, 1], 2: ["landscape", 2, 1], 4: ["portrait", 2, 2] }, def: 4 },
    "words": { balls: 0, cols: 5, rows: 5, letters: true, per: { 1: ["portrait", 1, 1], 2: ["landscape", 2, 1], 4: ["portrait", 2, 2] }, def: 2 },
    "90": { balls: 90, cols: 9, rows: 3, letters: false, per: { 3: ["portrait", 1, 3], 6: ["portrait", 1, 6] }, def: 6 },
    "30": { balls: 30, cols: 3, rows: 3, letters: false, per: { 2: ["landscape", 2, 1], 4: ["portrait", 2, 2], 6: ["portrait", 2, 3] }, def: 6 }
  };
  var PAPER = { letter: { w: 215.9, h: 279.4, name: "Letter" }, a4: { w: 210, h: 297, name: "A4" } };
  var MARGIN = 10, GAP = 7, FOOT = 6, LABEL = 6;
  var MAX_WORDS = 150, MAX_WORD_LEN = 40, PREVIEW = 4, SLIPS_PER_PAGE = 48;
  var LETTERS = ["B", "I", "N", "G", "O"];
  var SAMPLE = "apple\nbanana\ncherry\ngrape\nlemon\nmango\norange\npeach\npear\nplum\nmelon\nkiwi\ncarrot\npotato\nonion\npepper\ntomato\nbean\ncorn\npea\nrice\nbread\ncheese\negg\nhoney\nsoup\npizza\npasta\nsalad\ncookie";

  var els = {
    game: root.querySelector("[name=game]"), from: root.querySelector("[name=from]"), count: root.querySelector("[name=count]"),
    per: root.querySelector("[name=per]"), paper: root.querySelector("[name=paper]"), title: root.querySelector("[name=title]"),
    words: root.querySelector("[name=words]"), slips: root.querySelector("[name=slips]"), msg: root.querySelector(".bg-msg"),
    sum: root.querySelector(".bg-sum"), preview: root.querySelector(".bg-preview"), code: root.querySelector(".bg-code")
  };
  var state = { code: "" };
  var printRoot = document.createElement("div");
  printRoot.id = "bg-print-root";
  printRoot.setAttribute("aria-hidden", "true");
  document.body.appendChild(printRoot);
  var pageStyle = document.createElement("style");
  pageStyle.id = "bg-page-style";
  document.head.appendChild(pageStyle);

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function newCode() {
    var out = "", bytes = new Uint32Array(6);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (var i = 0; i < 6; i++) bytes[i] = Math.floor(Math.random() * 4294967296);
    for (var j = 0; j < 6; j++) out += CODE_CHARS[bytes[j] % CODE_CHARS.length];
    return out;
  }

  function intIn(el, lo, hi) {
    var t = String(el.value).trim();
    if (!/^\d+$/.test(t)) return null;
    var v = Number(t);
    return v >= lo && v <= hi ? v : null;
  }

  function fillPer(game, want) {
    var g = GAMES[game], keys = Object.keys(g.per);
    els.per.innerHTML = keys.map(function (k) { return "<option value=\"" + k + "\">" + k + " a page</option>"; }).join("");
    els.per.value = keys.indexOf(String(want)) >= 0 ? String(want) : String(g.def);
  }

  /* Reads the form into a set, or an error message for the field that's wrong. */
  function readSet() {
    var game = els.game.value, g = GAMES[game], set = { game: game, g: g, per: Number(els.per.value), paper: els.paper.value, title: els.title.value.trim().slice(0, 40), slips: els.slips.checked };
    [els.from, els.count, els.words].forEach(function (el) { el.removeAttribute("aria-invalid"); });
    if (game === "words") {
      var words = BingoCards.cleanWords(els.words.value);
      var long = words.filter(function (w) { return w.length > MAX_WORD_LEN; })[0];
      if (long) return { error: "Keep each word or phrase to " + MAX_WORD_LEN + " characters. This one is longer: " + long.slice(0, 50), field: els.words };
      if (words.length < 24) return { error: "Type at least 24 different words, one per line or with commas between them. You have " + words.length + " so far.", field: els.words };
      if (words.length > MAX_WORDS) return { error: "That's " + words.length + " words. The most a set can use is " + MAX_WORDS + ".", field: els.words };
      set.words = words;
      set.from = 1;
    } else {
      set.from = intIn(els.from, 1, MAX_CARD);
      if (set.from === null) return { error: "The first card number has to be a whole number from 1 to 999.", field: els.from };
    }
    set.count = intIn(els.count, 1, 100);
    if (set.count === null) return { error: "Pick from 1 to 100 cards.", field: els.count };
    if (game !== "words" && set.from + set.count - 1 > MAX_CARD) {
      return { error: "Card numbers stop at 999, so starting at " + set.from + " leaves room for " + (MAX_CARD - set.from + 1) + " cards.", field: els.count };
    }
    set.code = state.code;
    return set;
  }

  function cardsOf(set) {
    if (set.game === "words") return BingoCards.wordCards(set.words, set.code, set.count).map(function (rows, i) { return { n: i + 1, rows: rows }; });
    var out = [];
    for (var n = set.from; n < set.from + set.count; n++) out.push({ n: n, rows: cardFor(set.g.balls, n) });
    return out;
  }

  function setName(set) {
    if (set.game === "words") return "Word bingo, set " + set.code + ", " + set.count + (set.count === 1 ? " card" : " cards") + " from " + set.words.length + " words";
    var last = set.from + set.count - 1;
    return set.g.balls + " ball, " + (set.count === 1 ? "card " + set.from : "cards " + set.from + " to " + last);
  }

  function hashOf(set) {
    var p = ["game=" + set.game, "count=" + set.count, "per=" + set.per, "paper=" + set.paper];
    if (set.game === "words") p.push("set=" + set.code, "words=" + encodeURIComponent(sortWords(set.words).join("|")));
    else p.splice(1, 0, "from=" + set.from);
    if (set.title) p.push("title=" + encodeURIComponent(set.title));
    return "#" + p.join("&");
  }

  /* Card size: the cell that fits the slot, in mm for print or px for the preview. */
  function sizeFor(set, slotW, slotH, label, cap) {
    var g = set.g, t = set.title ? 0.55 : 0, cw, ch;
    slotW -= 1;
    slotH -= label + 1;
    if (g.letters) {
      cw = Math.min(slotW / g.cols, slotH / (g.rows + 0.7 + t), cap);
      ch = cw;
    } else {
      cw = Math.min(slotW / g.cols, cap);
      ch = Math.min(cw, slotH / (g.rows + t));
    }
    return { cw: Math.floor(cw * 100) / 100, ch: Math.floor(ch * 100) / 100 };
  }

  function cardHtml(set, card, size, unit) {
    var g = set.g, cells = "", label = set.game === "words" ? "Card " + card.n + " &middot; set " + esc(set.code) : "Card " + card.n;
    if (g.letters) LETTERS.forEach(function (l) { cells += '<div class="bg-h">' + l + "</div>"; });
    card.rows.forEach(function (row, r) {
      row.forEach(function (v, c) {
        var centre = g.letters && r === 2 && c === 2;
        if (centre) cells += '<div class="bg-x bg-free">FREE</div>';
        else if (set.game === "words") cells += '<div class="bg-x bg-w"><span>' + esc(v) + "</span></div>";
        else cells += '<div class="bg-x' + (v ? "" : " bg-blank") + '">' + (v || "") + "</div>";
      });
    });
    return '<div class="bg-card g' + set.game + '" style="--cw:' + size.cw + unit + ";--ch:" + size.ch + unit + '">' +
      (set.title ? '<p class="bg-title">' + esc(set.title) + "</p>" : "") +
      '<div class="bg-grid">' + cells + '</div><p class="bg-lab"><span>' + (set.game === "words" ? "Word bingo" : g.balls + " ball") + "</span><span>" + label + "</span></p></div>";
  }

  /* Word cells, word lists and slips shrink until the text fits its box. Runs where the boxes are laid out (the print
     copy sits off screen until printing, and mm sizes are the same on screen and on paper). A word that still doesn't
     fit at a small size is allowed to break. */
  function fitWords(container) {
    container.querySelectorAll(".bg-w, .bg-wlist li, .bg-slips div").forEach(function (box) {
      var span = box.querySelector("span");
      if (!span) return;
      var cs = getComputedStyle(box), size = parseFloat(cs.fontSize), padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      var room = function () { return box.clientHeight - padY; };
      for (var i = 0; i < 40 && (span.scrollWidth > span.clientWidth + 0.5 || span.offsetHeight > room() + 0.5); i++) {
        if (i === 20) box.classList.add("is-tight");
        size *= 0.93;
        box.style.fontSize = size.toFixed(2) + "px";
      }
    });
  }

  function fitTitles(container) {
    container.querySelectorAll(".bg-title").forEach(function (t) {
      var size = parseFloat(getComputedStyle(t).fontSize);
      for (var i = 0; i < 30 && t.scrollWidth > t.clientWidth + 0.5; i++) {
        size *= 0.94;
        t.style.fontSize = size.toFixed(2) + "px";
      }
    });
  }

  function sheetBox(set, orientation) {
    var p = PAPER[set.paper], w = orientation === "landscape" ? p.h : p.w, h = orientation === "landscape" ? p.w : p.h;
    return { pw: w, ph: h, w: w - 2 * MARGIN - 0.6, h: h - 2 * MARGIN - 1.2 };
  }

  function pageCss(size, orientation) {
    return "@media print{@page{size:" + size + " " + orientation + ";margin:" + MARGIN + "mm}}";
  }

  function footer(set, page, pages, extra) {
    return '<p class="bg-foot"><span>' + esc(setName(set)) + (extra ? ", " + extra : "") + "</span><span>Page " + page + " of " + pages + " &middot; manextapps.com/tools/bingo-card-generator</span></p>";
  }

  function buildCards(set, cards) {
    var lay = set.g.per[set.per], box = sheetBox(set, lay[0]), cols = lay[1], rows = lay[2];
    var slotW = (box.w - (cols - 1) * GAP) / cols, slotH = (box.h - FOOT - (rows - 1) * GAP) / rows;
    var size = sizeFor(set, slotW, slotH, LABEL, set.g.letters ? 36 : 24), pages = Math.ceil(cards.length / set.per), html = "";
    for (var p = 0; p < pages; p++) {
      var slice = cards.slice(p * set.per, (p + 1) * set.per);
      html += '<section class="bg-sheet" style="width:' + box.w.toFixed(1) + "mm;height:" + box.h.toFixed(1) + 'mm"><div class="bg-slots" style="grid-template-columns:repeat(' + cols + ",1fr);grid-template-rows:repeat(" + rows + ",1fr);gap:" + GAP + 'mm">' +
        slice.map(function (c) { return '<div class="bg-slot">' + cardHtml(set, c, size, "mm") + "</div>"; }).join("") + "</div>" + footer(set, p + 1, pages) + "</section>";
    }
    return { html: html, pages: pages, css: pageCss(set.paper === "a4" ? "A4" : "letter", lay[0]) };
  }

  function board(set, w) {
    var balls = set.g.balls, rows = [];
    if (balls === 75) for (var r = 0; r < 5; r++) rows.push({ head: LETTERS[r], nums: range(15 * r + 1, 15 * r + 15) });
    else for (var k = 0; k < balls / 10; k++) rows.push({ head: "", nums: range(10 * k + 1, 10 * k + 10) });
    var cols = rows[0].nums.length + (rows[0].head ? 1 : 0), cell = Math.min(w / cols, 16).toFixed(2);
    return '<div class="bg-board" style="--b:' + cell + 'mm;grid-template-columns:repeat(' + cols + "," + cell + 'mm)">' + rows.map(function (row) {
      return (row.head ? '<div class="bg-bh">' + row.head + "</div>" : "") + row.nums.map(function (n) { return "<div>" + n + "</div>"; }).join("");
    }).join("") + "</div>";
  }

  function buildCaller(set) {
    var box = sheetBox(set, "portrait"), pages = [], size = set.paper === "a4" ? "A4" : "letter";
    var head = '<h2 class="bg-ch">Caller sheet' + (set.title ? ": " + esc(set.title) : "") + "</h2>";
    var winners = '<table class="bg-win"><thead><tr><th>Game</th><th>Pattern</th><th>Card number</th><th>Calls</th></tr></thead><tbody>' +
      [1, 2, 3, 4, 5, 6].map(function (i) { return "<tr><td>" + i + "</td><td></td><td></td><td></td></tr>"; }).join("") + "</tbody></table>";
    var slips = [];
    if (set.game === "words") {
      var list = sortWords(set.words), n = list.length, cols = n <= 40 ? 2 : n <= 90 ? 3 : 4, per = Math.ceil(n / cols);
      var rowH = Math.min(8, (box.h - FOOT - 24) / per).toFixed(2);
      var colsHtml = "";
      for (var c = 0; c < cols; c++) colsHtml += "<ol>" + list.slice(c * per, (c + 1) * per).map(function (w) { return "<li><i></i><span>" + esc(w) + "</span></li>"; }).join("") + "</ol>";
      pages.push(head + '<p class="bg-cnote">Tick each word as you call it. ' + n + " words, alphabetical.</p>" + '<div class="bg-wlist" style="--rh:' + rowH + 'mm;grid-template-columns:repeat(' + cols + ',1fr)">' + colsHtml + "</div>");
      if (set.slips) for (var s = 0; s < n; s += SLIPS_PER_PAGE) slips.push(list.slice(s, s + SLIPS_PER_PAGE).map(esc));
    } else {
      pages.push(head + '<p class="bg-cnote">Cross off each number as you call it, then write down each winner.</p>' + board(set, box.w) + winners);
      if (set.slips) slips.push(range(1, set.g.balls).map(function (v) { return set.g.balls === 75 ? LETTERS[Math.floor((v - 1) / 15)] + " " + v : String(v); }));
    }
    slips.forEach(function (items) {
      var cols = set.game === "words" ? 4 : set.g.balls === 30 ? 6 : set.g.balls === 90 ? 9 : 8, rows = Math.ceil(items.length / cols);
      if (set.game === "words") rows = SLIPS_PER_PAGE / cols;
      var h = ((box.h - FOOT - 12) / rows).toFixed(2);
      pages.push('<h2 class="bg-ch">Calling slips</h2><div class="bg-slips' + (set.game === "words" ? " is-words" : "") + '" style="grid-template-columns:repeat(' + cols + ",1fr);grid-auto-rows:" + h + 'mm">' +
        items.map(function (t) { return "<div><span>" + t + "</span></div>"; }).join("") + "</div>");
    });
    var html = pages.map(function (inner, i) {
      return '<section class="bg-sheet bg-caller" style="width:' + box.w.toFixed(1) + "mm;height:" + box.h.toFixed(1) + 'mm"><div class="bg-cbody">' + inner + "</div>" + footer(set, i + 1, pages.length, "caller sheet") + "</section>";
    }).join("");
    return { html: html, pages: pages.length, css: pageCss(size, "portrait") };
  }

  var current = null, printing = "cards";

  function showError(e) {
    els.msg.textContent = e.error;
    if (e.field) e.field.setAttribute("aria-invalid", "true");
    root.setAttribute("data-pages", "0");
    root.setAttribute("data-caller-pages", "0");
    root.querySelectorAll("[data-print],[data-copy]").forEach(function (b) { b.disabled = true; });
  }

  function render() {
    var game = els.game.value;
    root.querySelectorAll("[data-only]").forEach(function (el) { el.hidden = el.getAttribute("data-only").split(" ").indexOf(game) < 0; });
    root.querySelectorAll("[data-not]").forEach(function (el) { el.hidden = el.getAttribute("data-not") === game; });
    var set = readSet();
    if (set.error) { current = null; showError(set); return; }
    els.msg.textContent = "";
    root.querySelectorAll("[data-print],[data-copy]").forEach(function (b) { b.disabled = false; });
    var cards = cardsOf(set), built = buildCards(set, cards), caller = buildCaller(set);
    current = { set: set, cards: built, caller: caller };
    root.setAttribute("data-pages", String(built.pages));
    root.setAttribute("data-caller-pages", String(caller.pages));
    printRoot.innerHTML = '<div class="bg-pc">' + built.html + '</div><div class="bg-pk">' + caller.html + "</div>";
    printRoot.setAttribute("data-show", printing);
    pageStyle.textContent = printing === "caller" ? caller.css : built.css;
    fitWords(printRoot);
    fitTitles(printRoot);

    var lay = set.g.per[set.per];
    els.sum.innerHTML = [["Cards", setName(set).replace(/^Word bingo, /, "")], ["Print", built.pages + (built.pages === 1 ? " page" : " pages") + ", " + set.per + " a page, " + PAPER[set.paper].name + " " + lay[0]],
      ["Caller sheet", caller.pages + (caller.pages === 1 ? " page" : " pages")]].map(function (x) { return "<div><dt>" + x[0] + "</dt><dd>" + esc(x[1]) + "</dd></div>"; }).join("");
    if (els.code) els.code.textContent = state.code;

    var width = els.preview.clientWidth || 320, colsOnScreen = width >= 900 ? 3 : width >= 560 ? 2 : 1, shown = cards.slice(0, colsOnScreen === 1 ? 2 : PREVIEW);
    var slot = (width - (colsOnScreen - 1) * 16) / colsOnScreen - 2;
    var psize = sizeFor(set, slot, 9999, 0, set.g.letters ? 54 : 40);
    els.preview.innerHTML = '<div class="bg-pgrid" style="grid-template-columns:repeat(' + colsOnScreen + ',1fr)">' + shown.map(function (c) { return cardHtml(set, c, psize, "px"); }).join("") + "</div>" +
      (cards.length > shown.length ? '<p class="bg-more">Showing ' + shown.length + " of " + cards.length + " cards. The print has all of them.</p>" : "");
    fitWords(els.preview);
    fitTitles(els.preview);
    try { history.replaceState(null, "", hashOf(set)); } catch (e) {}
    try { localStorage.setItem("bingo:last", hashOf(set)); } catch (e) {}
    root.setAttribute("data-ready", "1");
  }

  function applyHash(hash) {
    var q = {};
    String(hash || "").replace(/^#/, "").split("&").forEach(function (kv) {
      var i = kv.indexOf("=");
      if (i > 0) { try { q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); } catch (e) {} }
    });
    if (!GAMES[q.game]) return false;
    els.game.value = q.game;
    fillPer(q.game, q.per);
    if (q.from) els.from.value = q.from;
    if (q.count) els.count.value = q.count;
    if (PAPER[q.paper]) els.paper.value = q.paper;
    els.title.value = q.title || "";
    if (q.game === "words") {
      if (q.words) els.words.value = q.words.split("|").join("\n");
      state.code = /^[A-Z0-9]{4,12}$/.test(q.set || "") ? q.set : newCode();
    }
    return true;
  }

  var typingTimer = null;
  root.addEventListener("input", function (e) {
    if (e.target.name === "game") return;
    clearTimeout(typingTimer);
    // A long word list on 100 cards takes a moment to refit, so wait for a pause in typing.
    if (e.target.name === "words" || e.target.name === "title") typingTimer = setTimeout(function () { typingTimer = null; render(); }, 350);
    else render();
  });
  els.game.addEventListener("change", function () { fillPer(els.game.value); if (els.game.value === "words" && !state.code) state.code = newCode(); render(); });
  root.addEventListener("submit", function (e) { e.preventDefault(); });
  root.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (typingTimer && (b.hasAttribute("data-print") || b.hasAttribute("data-copy"))) { clearTimeout(typingTimer); typingTimer = null; render(); }
    if (!current) return;
    if (b.hasAttribute("data-print")) {
      printing = b.getAttribute("data-print");
      printRoot.setAttribute("data-show", printing);
      pageStyle.textContent = printing === "caller" ? current.caller.css : current.cards.css;
      if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "bingo-print-" + printing + "-" + current.set.game, event: true });
      window.print();
    } else if (b.hasAttribute("data-newcode")) {
      state.code = newCode();
      render();
    } else if (b.hasAttribute("data-copy")) {
      var link = location.href.split("#")[0] + hashOf(current.set);
      var done = function () { b.textContent = "Link copied"; setTimeout(function () { b.textContent = "Copy the link to this set"; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, function () { window.prompt("Copy this link", link); });
      else window.prompt("Copy this link", link);
    } else if (b.hasAttribute("data-sample")) {
      els.words.value = SAMPLE;
      render();
    }
  });
  window.addEventListener("afterprint", function () {
    if (printing === "caller" && current) { printing = "cards"; printRoot.setAttribute("data-show", "cards"); pageStyle.textContent = current.cards.css; }
  });
  var resizeTimer = null;
  window.addEventListener("resize", function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 150); });
  window.addEventListener("hashchange", function () { if (applyHash(location.hash)) render(); });

  els.paper.value = /^en-(US|CA)|^es-(MX|US)|^fil|^en-PH/i.test(navigator.language || "") ? "letter" : "a4";
  els.words.value = SAMPLE;
  var stored = null;
  try { stored = localStorage.getItem("bingo:last"); } catch (e) {}
  if (!applyHash(location.hash) && !(stored && applyHash(stored))) fillPer(els.game.value);
  if (!state.code) state.code = newCode();
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (current) render(); });
})();
