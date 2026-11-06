/* Age comparison on /tools/average-reaction-time/: puts your average from the test next to the group average
   for your age in Woods and others (2015), Table 2. Needs reaction-test.js, which sends "rt:done". */
(function () {
  "use strict";
  var box = document.getElementById("rt-age"), test = document.getElementById("reaction-tool");
  if (!box || !test) return;
  var input = box.querySelector("[name=age]"), out = box.querySelector(".rt-age-out");
  // [lowest age, highest age, group average in ms], as printed in the paper.
  var GROUPS = [[18, 24, 217.9], [25, 31, 221.0], [32, 38, 224.8], [39, 45, 227.7], [46, 51, 233.6], [52, 58, 236.4], [59, 65, 239.1]];
  var last = null;

  function render() {
    var age = parseInt(input.value, 10);
    if (!age) { out.textContent = "Type your age to see the study's average for people like you."; return; }
    if (age < 18 || age > 65) { out.textContent = "The study only covered ages 18 to 65, so there's no group to compare with."; return; }
    var g = GROUPS.filter(function (x) { return age >= x[0] && age <= x[1]; })[0];
    var text = "In the study, people aged " + g[0] + " to " + g[1] + " averaged " + g[2].toFixed(1) + " ms.";
    if (last !== null) {
      var d = Math.round(last - g[2]);
      text += " Your average here was " + last + " ms, " + (d > 0 ? d + " ms slower" : d < 0 ? -d + " ms faster" : "the same") +
        ". The study's own screen and mouse added about 18 ms, and a browser on your device adds its own delay, so expect to come out a little slower.";
    } else text += " Take the test above to compare.";
    out.textContent = text;
    try { localStorage.setItem("rt:age", input.value); } catch (e) {}
  }

  test.addEventListener("rt:done", function (e) { last = e.detail.average; render(); });
  try { var a = localStorage.getItem("rt:age"); if (a) input.value = a; } catch (e) {}
  input.addEventListener("input", render);
  box.addEventListener("submit", function (e) { e.preventDefault(); });
  render();
})();
