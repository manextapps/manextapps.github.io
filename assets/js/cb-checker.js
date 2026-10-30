/* Clue checker on the strategy guide: type your own clues, see every code that still fits and the
 * solver's reasoning. Needs cb-engine.js (window.CB). */
(function () {
  "use strict";
  var root = document.getElementById("clue-checker");
  if (!root || !window.CB) return;
  var CB = window.CB;
  var rows = root.querySelector(".ck-rows");
  var out = root.querySelector(".ck-out");

  function options(max, value) {
    var s = "";
    for (var i = 0; i <= max; i++) s += '<option value="' + i + '"' + (i === value ? " selected" : "") + ">" + i + "</option>";
    return s;
  }

  function addRow(guess, total, exact) {
    var i = rows.children.length + 1;
    var li = document.createElement("li");
    li.className = "ck-row";
    li.innerHTML =
      '<label><span>Guess ' + i + '</span><input inputmode="numeric" autocomplete="off" maxlength="5" pattern="[0-9]*" value="' + (guess || "") + '" aria-label="Guess ' + i + '"></label>' +
      '<label><span>Digits in the code</span><select data-total>' + options(5, total || 0) + "</select></label>" +
      '<label><span>Of those, in the right place</span><select data-exact>' + options(5, exact || 0) + "</select></label>" +
      '<button type="button" class="ck-remove" aria-label="Remove guess ' + i + '">&times;</button>';
    rows.appendChild(li);
  }

  function read() {
    var clues = [];
    var problems = [];
    var n = 0;
    Array.prototype.forEach.call(rows.children, function (li, idx) {
      var guess = li.querySelector("input").value.trim();
      if (!guess) return;
      var c = { guess: guess, total: Number(li.querySelector("[data-total]").value), exact: Number(li.querySelector("[data-exact]").value) };
      if (!n) n = guess.length;
      if (!/^[0-9]{3,5}$/.test(guess)) problems.push("Guess " + (idx + 1) + " needs 3 to 5 digits.");
      else if (guess.length !== n) problems.push("Guess " + (idx + 1) + " has a different length from guess 1.");
      else if (new Set(guess).size !== guess.length) problems.push("Guess " + (idx + 1) + " repeats a digit. This only works with codes of different digits.");
      else if (c.exact > c.total) problems.push("Guess " + (idx + 1) + ": the digits in the right place cannot be more than the digits in the code.");
      else if (c.total > n) problems.push("Guess " + (idx + 1) + " counts more digits than it has.");
      clues.push(c);
    });
    return { n: n, clues: clues, problems: problems };
  }

  function check() {
    var r = read();
    if (!r.clues.length) {
      out.innerHTML = "<p>Type at least one guess.</p>";
      return;
    }
    if (r.problems.length) {
      out.innerHTML = '<p class="ck-bad">' + r.problems.join("<br>") + "</p>";
      return;
    }
    var all = CB.solutions(r.n, r.clues);
    var total = CB.table(r.n).codes.length;
    var html = "<p><strong>" + all.length.toLocaleString("en") + "</strong> of " + total.toLocaleString("en") + " possible codes fit " +
      (r.clues.length === 1 ? "this clue" : "these " + r.clues.length + " clues") + ".</p>";
    if (all.length === 0) {
      html += "<p>No code fits. Check the counts you typed: one of them is probably off by one.</p>";
    } else if (all.length <= 40) {
      html += '<p class="ck-codes">' + all.map(function (c) { return "<span>" + c + "</span>"; }).join("") + "</p>";
    } else {
      html += "<p>Add more clues to narrow it down. The list shows up once 40 or fewer codes are left.</p>";
    }
    if (all.length === 1) {
      var res = new CB.LogicSolver(r.n, r.clues).solve();
      if (res.solved) {
        html += "<p>Exactly one answer. Here's how to get there with logic alone:</p><ol class=\"steps\">" +
          res.steps.map(function (s) { return "<li>" + CB.explain(s, r.n) + "</li>"; }).join("") + "</ol>";
      } else {
        html += "<p>Exactly one answer, but my step by step solver gets stuck after " + res.steps.length +
          " steps. You'd need trial and error or a deeper case split to reach it.</p>";
      }
    }
    out.innerHTML = html;
  }

  root.addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    if (t.classList.contains("ck-remove")) {
      t.closest("li").remove();
    } else if (t.hasAttribute("data-add")) {
      if (rows.children.length < 10) addRow();
    } else if (t.hasAttribute("data-run")) {
      check();
    } else if (t.hasAttribute("data-riddle")) {
      rows.innerHTML = "";
      [["682", 1, 1], ["614", 1, 0], ["206", 2, 0], ["738", 0, 0], ["780", 1, 0]].forEach(function (r) { addRow(r[0], r[1], r[2]); });
      check();
    }
  });

  addRow("", 0, 0);
  addRow("", 0, 0);
})();
