/* The Debt Payoff Planner app's PayoffEngine. Money in cents, APR in thousandths of a percent, so every step is
   exact integer math; balance x APR can pass 2^53, so interest goes through BigInt. */
(function (root) {
  "use strict";
  var MAX_MONTHS = 600, CEILING = 1e12;

  function interest(balance, aprMilli) {
    if (balance <= 0 || aprMilli <= 0) return 0;
    return Number((BigInt(balance) * BigInt(aprMilli) * BigInt(2) + BigInt(1200000)) / BigInt(2400000));
  }

  function order(debts, strategy) {
    var idx = debts.map(function (d, i) { return { d: d, i: i }; });
    idx.sort(strategy === "snowball"
      ? function (a, b) { return a.d.balance - b.d.balance || b.d.apr - a.d.apr || a.i - b.i; }
      : function (a, b) { return b.d.apr - a.d.apr || a.d.balance - b.d.balance || a.i - b.i; });
    return idx.map(function (t) { return t.d; });
  }

  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }

  function simulate(debts, extra, strategy) {
    var ord = order(debts.filter(function (d) { return d.balance > 0; }), strategy), n = ord.length;
    var budget = sum(ord.map(function (d) { return d.minimum; })) + Math.max(extra, 0);
    var shortfalls = ord.filter(function (d) { return d.minimum < interest(d.balance, d.apr); })
      .map(function (d) { return { debt: d, interest: interest(d.balance, d.apr) }; });
    var firstInterest = sum(ord.map(function (d) { return interest(d.balance, d.apr); }));
    var bal = ord.map(function (d) { return d.balance; }), total = new Array(n).fill(0), payoff = new Array(n).fill(0);
    var balances = [sum(bal)], month = 0;
    while (sum(bal) > 0) {
      month++;
      if (month > MAX_MONTHS || sum(bal) > CEILING) return { payoff: false, budget: budget, shortfalls: shortfalls, firstInterest: firstInterest };
      var left = budget, intr = [], i, pay;
      for (i = 0; i < n; i++) { intr[i] = bal[i] > 0 ? interest(bal[i], ord[i].apr) : 0; bal[i] += intr[i]; }
      for (i = 0; i < n; i++) {
        if (bal[i] <= 0) continue;
        pay = Math.min(ord[i].minimum, bal[i], left); bal[i] -= pay; left -= pay;
      }
      for (i = 0; i < n && left > 0; i++) {
        if (bal[i] <= 0) continue;
        pay = Math.min(left, bal[i]); bal[i] -= pay; left -= pay;
      }
      for (i = 0; i < n; i++) {
        if (payoff[i]) continue;
        total[i] += intr[i];
        if (bal[i] === 0) payoff[i] = month;
      }
      balances.push(sum(bal));
    }
    return {
      payoff: true, budget: budget, shortfalls: shortfalls, firstInterest: firstInterest, months: month, interest: sum(total),
      order: ord.map(function (d, k) { return { debt: d, month: payoff[k], interest: total[k] }; }), balances: balances
    };
  }

  var api = { interest: interest, order: order, simulate: simulate, MAX_MONTHS: MAX_MONTHS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DebtEngine = api;
})(this);
