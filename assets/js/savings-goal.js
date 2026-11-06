/* Goal finder on /tools/money-saving-challenges/: for a target total, the first deposit each challenge needs.
   Every challenge here grows the same way (deposit n is n times the first), so the total is
   first x n(n + 1)/2 and the first deposit is the goal divided by that, rounded up to a cent. */
(function () {
  "use strict";
  var root = document.getElementById("sv-goal");
  if (!root) return;
  var input = root.querySelector("[name=goal]"), out = root.querySelector(".sv-goal-out");
  var LIST = [
    ["52 week challenge", 52, "/tools/52-week-savings-challenge/"],
    ["26 payday challenge", 26, "/tools/52-week-savings-challenge/#paydays"],
    ["100 envelope challenge", 100, "/tools/100-envelope-challenge/"],
    ["Penny challenge", 365, "/tools/penny-challenge/"],
  ];

  function money(c) {
    return (c / 100).toLocaleString("en", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
  }

  function render() {
    var goal = Math.round(parseFloat(String(input.value).replace(/[^\d.]/g, "")) * 100);
    if (!isFinite(goal) || goal <= 0) { out.innerHTML = "<p>Type the total you'd like to reach.</p>"; return; }
    goal = Math.min(goal, 1e11);
    var rows = LIST.map(function (x) {
      var steps = x[1] * (x[1] + 1) / 2, first = Math.ceil(goal / steps);
      return "<tr><td><a href=\"" + x[2] + "\">" + x[0] + '</a></td><td class="num">' + money(first) + '</td><td class="num">' + money(first * x[1]) +
        '</td><td class="num">' + money(first * steps) + "</td></tr>";
    }).join("");
    out.innerHTML = '<div class="table-wrap"><table class="sv-compare"><thead><tr><th>Challenge</th><th class="num">First deposit</th><th class="num">Biggest</th><th class="num">You end with</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
    try { localStorage.setItem("savings:goal", input.value); } catch (e) {}
  }

  try { var saved = localStorage.getItem("savings:goal"); if (saved) input.value = saved; } catch (e) {}
  input.addEventListener("input", render);
  root.addEventListener("submit", function (e) { e.preventDefault(); });
  render();
  root.setAttribute("data-ready", "1");
})();
