/* Solver UI on /puzzles/bulls-and-cows-solver/. Needs bulls-cows.js (window.BullsCows). */
(function () {
  "use strict";
  var root = document.getElementById("bc");
  if (!root || !window.BullsCows) return;
  var B = window.BullsCows;
  var rows = root.querySelector(".bc-rows");
  var out = root.querySelector(".bc-out");
  var lenSel = root.querySelector("[name=bc-len]");
  var rep = root.querySelector("[name=bc-repeat]");
  var lead = root.querySelector("[name=bc-lead]");

  function opts(max, v) {
    var s = "";
    for (var i = 0; i <= max; i++) s += '<option value="' + i + '"' + (i === v ? " selected" : "") + ">" + i + "</option>";
    return s;
  }

  function addRow(guess, bulls, cows) {
    var n = +lenSel.value, i = rows.children.length + 1, li = document.createElement("li");
    li.className = "bc-row";
    li.innerHTML =
      '<label class="bc-g"><span>Guess ' + i + '</span><input inputmode="numeric" autocomplete="off" maxlength="' + n + '" value="' + (guess || "") + '"></label>' +
      '<label><span>Bulls</span><select data-b>' + opts(n, bulls || 0) + "</select></label>" +
      '<label><span>Cows</span><select data-c>' + opts(n, cows || 0) + "</select></label>" +
      '<button type="button" class="bc-del" aria-label="Remove guess ' + i + '">&times;</button>';
    rows.appendChild(li);
  }

  function renumber() {
    Array.prototype.forEach.call(rows.children, function (li, i) {
      li.querySelector(".bc-g span").textContent = "Guess " + (i + 1);
      li.querySelector(".bc-del").setAttribute("aria-label", "Remove guess " + (i + 1));
    });
  }

  function settings() { return { length: +lenSel.value, repeats: rep.checked, leadingZero: lead.checked }; }

  function fmt(n) { return n.toLocaleString("en-US"); }

  function run() {
    var st = settings(), clues = [], problems = [];
    Array.prototype.forEach.call(rows.children, function (li, i) {
      var g = li.querySelector("input").value.replace(/\D/g, ""), b = +li.querySelector("[data-b]").value, c = +li.querySelector("[data-c]").value;
      li.classList.remove("is-bad");
      if (!g) return;
      if (g.length !== st.length) { problems.push("Guess " + (i + 1) + " needs " + st.length + " digits."); li.classList.add("is-bad"); return; }
      if (b + c > st.length) { problems.push("Guess " + (i + 1) + ": bulls and cows together can't be more than " + st.length + "."); li.classList.add("is-bad"); return; }
      clues.push({ guess: g, bulls: b, cows: c, row: i });
    });
    var total = B.allCodes(st.length, st.repeats, st.leadingZero).length;
    var html = "";
    if (problems.length) html += '<p class="bc-warn">' + problems.join(" ") + "</p>";
    var r = B.solve(st, clues);
    var trail = [fmt(total)].concat(r.counts.map(fmt)).join(" &rarr; ");
    if (!clues.length) {
      html += "<p>There are <strong>" + fmt(total) + "</strong> possible codes with these settings. Enter a guess and its bulls and cows to start narrowing them down.</p>";
    } else if (r.conflict >= 0) {
      var row = clues[r.conflict].row + 1;
      rows.children[clues[r.conflict].row].classList.add("is-bad");
      html += '<p class="bc-none"><strong>No code fits these clues.</strong> The trouble starts at guess ' + row +
        ": no code agrees with it and every guess above it. Check its bulls and cows, and check the settings above (repeated digits and a leading zero change the answer).</p>" +
        '<p class="bc-trail">Codes left after each guess: ' + trail + "</p>";
    } else {
      var n = r.codes.length;
      html += n === 1 ? '<p class="bc-one">The code is <strong class="mono">' + r.codes[0] + "</strong>. It's the only one that fits every clue.</p>" :
        "<p><strong>" + fmt(n) + "</strong> codes still fit.</p>";
      html += '<p class="bc-trail">Codes left after each guess: ' + trail + "</p>";
      if (n > 1) {
        var shown = r.codes.slice(0, 60).map(function (c) { return '<span class="mono">' + c + "</span>"; }).join(" ");
        html += '<p class="bc-codes">' + shown + (n > 60 ? " and " + fmt(n - 60) + " more" : "") + "</p>";
        var s = B.suggest(r.codes, 800);
        if (s) html += '<p class="bc-suggest">A good next guess: <strong class="mono">' + s.guess + "</strong>. Whatever the answer turns out to be, it leaves at most " +
          s.worst + (s.worst === 1 ? " code" : " codes") + '. <button type="button" class="bc-use" data-guess="' + s.guess + '">Use it</button></p>';
      }
    }
    out.innerHTML = html;
  }

  function rebuild() {
    var keep = Array.prototype.map.call(rows.children, function (li) {
      return [li.querySelector("input").value, +li.querySelector("[data-b]").value, +li.querySelector("[data-c]").value];
    });
    rows.innerHTML = "";
    keep.forEach(function (k) { addRow(k[0].slice(0, +lenSel.value), Math.min(k[1], +lenSel.value), Math.min(k[2], +lenSel.value)); });
    if (!rows.children.length) addRow();
    run();
  }

  root.addEventListener("input", function (e) { if (e.target.matches("input[inputmode]")) run(); });
  root.addEventListener("change", function (e) {
    if (e.target === lenSel) rebuild(); else run();
  });
  root.addEventListener("click", function (e) {
    if (e.target.closest(".bc-del")) {
      e.target.closest("li").remove();
      if (!rows.children.length) addRow();
      renumber(); run();
    } else if (e.target.closest("[data-add]")) {
      addRow(); rows.lastChild.querySelector("input").focus(); run();
    } else if (e.target.closest("[data-clear]")) {
      rows.innerHTML = ""; addRow(); run();
    } else if (e.target.closest("[data-example]")) {
      lenSel.value = "4"; rep.checked = false; lead.checked = true; rows.innerHTML = "";
      [["1234", 0, 1], ["5678", 1, 0]].forEach(function (x) { addRow(x[0], x[1], x[2]); });
      run();
    } else if (e.target.closest(".bc-use")) {
      var empty = Array.prototype.filter.call(rows.children, function (li) { return !li.querySelector("input").value; })[0];
      if (!empty) { addRow(); empty = rows.lastChild; }
      empty.querySelector("input").value = e.target.getAttribute("data-guess");
      empty.querySelector("[data-b]").focus();
      run();
    }
  });

  addRow();
  run();
  root.setAttribute("data-ready", "1");
})();
