/* Answer checks on /puzzles/printable-code-breaker-puzzles/. Each puzzle carries its code; the answers are
   printed on the page anyway, in the closed answer boxes and the key. */
(function () {
  "use strict";
  document.addEventListener("submit", function (e) {
    var form = e.target.closest(".cbp-check");
    if (!form) return;
    e.preventDefault();
    var item = form.closest(".cbp-item"), code = item.getAttribute("data-code");
    var value = form.querySelector("input").value.replace(/\D/g, ""), out = form.querySelector(".cbp-out");
    if (value.length !== code.length) { out.textContent = "Type all " + code.length + " digits."; return; }
    var right = value === code;
    out.textContent = right ? "That's it. The lock opens." : "Not quite. Check each clue against " + value + ".";
    item.classList.toggle("is-solved", right);
  });
})();
