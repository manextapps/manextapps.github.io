/* Landing pages for links shared from the games: /v/ (Crack the Vault), /play/matchstick/ and /zip/.
   Each reads its query, says what the friend sent in plain words, and points two buttons at the app: "Open in the
   app" (a Chrome intent that falls back to Play, Android only) and Google Play with the install referrer each
   game's design asks for, so the app can open the same puzzle after install. */
(function () {
  "use strict";
  var root = document.getElementById("sl");
  if (!root) return;
  var kind = root.getAttribute("data-kind"), q = new URLSearchParams(location.search);
  var textEl = root.querySelector(".sl-text"), playBtn = root.querySelector("[data-sl-play]"), openBtn = root.querySelector("[data-sl-open]");
  var android = /Android/i.test(navigator.userAgent);
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function playUrl(pkg, referrer) {
    return "https://play.google.com/store/apps/details?id=" + pkg + "&referrer=" + encodeURIComponent(referrer);
  }
  function intentUrl(pkg, fallback) {
    return "intent://www.manextapps.com" + location.pathname + location.search + "#Intent;scheme=https;package=" + pkg +
      ";S.browser_fallback_url=" + encodeURIComponent(fallback) + ";end";
  }
  function setButtons(pkg, referrer) {
    var play = playUrl(pkg, referrer);
    playBtn.href = play;
    if (android) { openBtn.href = intentUrl(pkg, play); openBtn.hidden = false; }
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* A real calendar date from YYYYMMDD, as a UTC date so the weekday doesn't depend on the visitor's time zone. */
  function ymd(s) {
    if (!/^\d{8}$/.test(s || "")) return null;
    var y = +s.slice(0, 4), m = +s.slice(4, 6) - 1, d = +s.slice(6, 8), dt = new Date(Date.UTC(y, m, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m && dt.getUTCDate() === d ? dt : null;
  }
  function inRange(dt, todayUtcMs) {
    var first = Date.UTC(2026, 10, 1), today = new Date(todayUtcMs);
    var last = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1);
    return dt.getTime() >= first && dt.getTime() <= last;
  }
  function intIn(s, lo, hi) { return /^\d{1,6}$/.test(s || "") && +s >= lo && +s <= hi ? +s : null; }
  function clock(sec) { return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); }

  function vault() {
    var d = ymd(q.get("d")), t = intIn(q.get("t"), 1, 99), pkg = "com.crackthevault.game";
    // The vault day is the date at UTC-7, so "today" is computed there.
    if (d && !inRange(d, Date.now() - 7 * 3600 * 1000)) d = null;
    if (!d) { setButtons(pkg, "utm_source=friend_share&utm_medium=daily_result&utm_campaign=vault_share"); return; }
    var date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
    textEl.textContent = t
      ? "A friend opened the Crack the Vault daily vault for " + date + " in " + t + (t === 1 ? " try" : " tries") +
        ". Everyone gets the same vault that day, so you can try the exact same one."
      : "A friend sent you the Crack the Vault daily vault for " + date + ". Everyone gets the same vault that day, so you can try the exact same one.";
    setButtons(pkg, "utm_source=friend_share&utm_medium=daily_result&utm_campaign=vault_" + q.get("d"));
  }

  function zip() {
    var d = ymd(q.get("d")), l = intIn(q.get("l"), 1, 100000), t = intIn(q.get("t"), 1, 7200), pkg = "com.manextapps.zippuzzle";
    var g = /^\d{1,3}$/.test(q.get("g") || "") ? "&zg=" + q.get("g") : "";
    var SIZES = [[9, "Medium"], [6, "Medium"], [6, "Hard"], [7, "Medium"], [7, "Hard"], [8, "Medium"], [8, "Hard"]];
    // SITE_ZIP_PAGE.md: ignore dates before 2026-10-01 or more than 2 days ahead.
    if (d) {
      var now = new Date(), limit = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2);
      if (d.getTime() < Date.UTC(2026, 9, 1) || d.getTime() > limit) d = null;
    }
    if (d) {
      var s = SIZES[d.getUTCDay()], label = DAYS[d.getUTCDay()] + ", " + MONTHS[d.getUTCMonth()] + " " + d.getUTCDate();
      textEl.textContent = "Your friend " + (t ? "solved" : "sent you") + " the Zip Puzzle daily for " + label + ", " + (s[0] === 8 ? "an " : "a ") + s[0] + "x" + s[0] + " " + s[1] + " board" +
        (t ? ", in " + clock(t) : "") + ". That board lives in the Android app, and it's the same for everyone on that date. " +
        "Install the app and it opens that board right away" + (t ? ", with your friend's time to beat." : ".");
      setButtons(pkg, "utm_source=zip_share&utm_medium=web&utm_campaign=challenge&zd=" + q.get("d") + (t ? "&zt=" + t : "") + g);
    } else if (l) {
      textEl.textContent = "Your friend " + (t ? "solved level " + l + " of Zip Puzzle in " + clock(t) : "sent you level " + l + " of Zip Puzzle") +
        ". Every player gets the same board for that level. Install the app and it opens that board right away" + (t ? ", with your friend's time to beat." : ".");
      setButtons(pkg, "utm_source=zip_share&utm_medium=web&utm_campaign=challenge&zl=" + l + (t ? "&zt=" + t : "") + g);
    } else {
      setButtons(pkg, "utm_source=zip_share&utm_medium=web&utm_campaign=challenge");
    }
  }

  var PACKS = { move1: "Move one match", move2: "Move two matches", addremove: "Add or remove", shapes: "Squares and triangles" };

  function matchstick() {
    var p = q.get("p") || "", id = q.get("id") || "", pkg = "com.manextapps.matchstick";
    var okId = /^(d\d{1,6}|(move1|move2|addremove|shapes)\.\d{1,3})$/.test(id) ? id : "";
    setButtons(pkg, "utm_source=friend_share&utm_medium=share&utm_campaign=matchstick" + (okId ? "&utm_content=" + okId : ""));
    var what = "a Matchstick Puzzle";
    if (/^d\d+$/.test(okId)) {
      var day = new Date(+okId.slice(1) * 86400000);
      what = "the Matchstick Puzzle daily for " + MONTHS[day.getUTCMonth()] + " " + day.getUTCDate();
    } else if (okId) {
      var parts = okId.split(".");
      what = "level " + (+parts[1]) + " of the " + PACKS[parts[0]] + " pack in Matchstick Puzzle";
    }
    var m = /^(M1|M2|A1|R1)\.([0-9pme]{3,13})$/.exec(p);
    if (m) {
      var eq = m[2].replace(/p/g, "+").replace(/m/g, "-").replace(/e/g, "=");
      var task = { M1: "Move one match", M2: "Move two matches", A1: "Add one match", R1: "Take away one match" }[m[1]];
      var shown = eq.replace(/-/g, " \u2212 ").replace(/\+/g, " + ").replace(/=/g, " = ");
      textEl.textContent = "A friend sent you " + what + ": " + shown + ". " + task + " to make it true.";
      if (window.MatchShare) window.MatchShare(eq, m[1]);
      return;
    }
    var s = /^(Q|T)\.([0-9x]{1,5})\.(R|A|M)(\d)\.(\d{1,2})\.S\.[0-9a-z]{1,40}$/.exec(p);
    if (s) {
      var verb = { R: "Take away", A: "Add", M: "Move" }[s[3]], shape = s[1] === "Q" ? "square" : "triangle", n = +s[5];
      textEl.textContent = "A friend sent you " + what + ". " + verb + " " + s[4] + " match" + (s[4] === "1" ? "" : "es") +
        " and leave exactly " + n + " " + shape + (n === 1 ? "" : "s") + ". This kind of puzzle plays in the app.";
    }
  }

  ({ vault: vault, zip: zip, matchstick: matchstick })[kind]();
  root.setAttribute("data-ready", "1");
})();
