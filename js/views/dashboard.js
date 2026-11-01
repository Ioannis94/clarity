'use strict';
App.views = App.views || {};

App.views.dashboard = (function () {
  const U = App.util, S = App.store, ui = App.ui;
  let month = U.thisMonth();
  const QUOTE = '<p class="tagline">“What gets measured gets managed”</p>';

  function welcome(root) {
    root.innerHTML = `
      <div class="page-head"><div><h1>Welcome to Clarity</h1>${QUOTE}</div></div>
      <div class="card" style="max-width:720px">
        <p class="secondary">Track your spending, income, budgets and investments. Everything is stored only in this browser on this device. Export a backup from <a href="#/data">Import & export</a> now and then.</p>
        <div class="list-item"><span class="cat-icon">${ui.icon('wallet')}</span><div class="grow"><div class="tx-title">1. Set up your accounts</div><div class="tx-sub">Bank accounts, cards, cash, broker. Enter their current balance.</div></div><a class="btn small" href="#/accounts">Accounts</a></div>
        <div class="list-item"><span class="cat-icon">${ui.icon('plus')}</span><div class="grow"><div class="tx-title">2. Add transactions</div><div class="tx-sub">Use the + button or press <span class="kbd">N</span>. Or import a CSV from your bank.</div></div><button class="btn small" data-add>Add</button></div>
        <div class="list-item"><span class="cat-icon">${ui.icon('repeat')}</span><div class="grow"><div class="tx-title">3. Add recurring entries</div><div class="tx-sub">Salary, rent, subscriptions: recorded automatically.</div></div><a class="btn small" href="#/recurring">Recurring</a></div>
        <div class="list-item"><span class="cat-icon">${ui.icon('target')}</span><div class="grow"><div class="tx-title">4. Set budgets</div><div class="tx-sub">Monthly limits per category.</div></div><a class="btn small" href="#/budgets">Budgets</a></div>
        <div class="list-item"><span class="cat-icon">${ui.icon('trend')}</span><div class="grow"><div class="tx-title">5. Record investments</div><div class="tx-sub">Buys and sells, with profit/loss tracking.</div></div><a class="btn small" href="#/investments">Investments</a></div>
        <p class="small muted" style="margin-top:16px">Just looking around? <button class="link-btn" data-demo>Load demo data</button> (you can erase it later in Import & export).</p>
      </div>`;
    root.querySelector('[data-add]').addEventListener('click', () => App.forms.transaction());
    root.querySelector('[data-demo]').addEventListener('click', App.demo.load);
  }

  function render(root) {
    const st = S.get();
    if (!st.transactions.length && !st.trades.length) return welcome(root);

    const today = U.today();
    const nw = S.netWorth(today);
    const prevEnd = U.endOfMonth(U.addMonths(U.thisMonth(), -1));
    const nwPrev = S.netWorth(prevEnd).total;
    const cur = S.monthStats(month);
    const prev = S.monthStats(U.addMonths(month, -1));
    const net = cur.income - cur.expense;
    const rate = cur.income ? net / cur.income : 0;
    const expDelta = prev.expense && cur.expense ? (cur.expense - prev.expense) / prev.expense : null;
    const nwChange = nw.total - nwPrev;
    const backupAge = App.views.data.daysSinceBackup();
    const needsBackup = backupAge == null || backupAge > 14;

    root.innerHTML = `
      <div class="page-head"><div><h1>Dashboard</h1>${QUOTE}</div><div class="actions" data-month></div></div>
      ${needsBackup ? `<div class="note backup-note">${ui.icon('alert')}<span>${backupAge == null ? 'You haven’t saved a backup yet.' : `Last backup was ${backupAge} days ago.`} Your data lives only on this phone.</span>
        <button class="btn small primary" data-backup>Save backup</button></div>` : ''}
      <div class="hero">
        <div><div class="hero-label">Net worth</div><div class="hero-value">${U.money(nw.total)}</div>
          <div class="stat-delta"><span class="${nwChange >= 0 ? 'pos' : 'neg'}">${U.signed(nwChange)}</span> since ${U.fmtDate(prevEnd)}</div></div>
        <div class="hero-parts"><span>Cash & accounts <strong>${U.money(nw.cash)}</strong></span><span>Investments <strong>${U.money(nw.invest)}</strong></span></div>
      </div>
      <div class="grid grid-4" style="margin-bottom:16px">
        <a class="card" href="#/transactions?type=income&month=${month}" style="color:inherit;text-decoration:none"><div class="stat-label">Income · ${U.monthShort(month)}</div><div class="stat-value">${U.money(cur.income)}</div>
          <div class="stat-delta">${prev.income ? `${U.money(prev.income)} in ${U.monthShort(U.addMonths(month, -1))}` : '&nbsp;'}</div></a>
        <a class="card" href="#/transactions?type=expense&month=${month}" style="color:inherit;text-decoration:none"><div class="stat-label">Expenses · ${U.monthShort(month)}</div><div class="stat-value">${U.money(cur.expense)}</div>
          <div class="stat-delta">${expDelta == null ? '&nbsp;' : `<span class="${expDelta > 0 ? 'neg' : 'pos'}">${expDelta > 0 ? '▲' : '▼'} ${U.pct(Math.abs(expDelta), 0)}</span> vs ${U.monthShort(U.addMonths(month, -1))}`}</div></a>
        <div class="card"><div class="stat-label">Saved · ${U.monthShort(month)}</div><div class="stat-value ${net < 0 ? 'neg' : ''}">${U.signed(net)}</div><div class="stat-delta">income minus expenses</div></div>
        <div class="card"><div class="stat-label">Savings rate</div><div class="stat-value ${rate < 0 ? 'neg' : ''}">${cur.income ? U.pct(rate, 0) : '—'}</div><div class="stat-delta">of income kept</div></div>
      </div>
      <div class="grid grid-2" style="margin-bottom:16px">
        <div class="card"><div class="card-head"><h2>Income vs expenses</h2><span class="sub">12 months</span></div><div data-cols></div></div>
        <div class="card"><div class="card-head"><h2>Net worth</h2><span class="sub">month-end</span></div><div data-nw></div></div>
      </div>
      <div class="grid grid-2" style="margin-bottom:16px">
        <div class="card"><div class="card-head"><h2>Spending by category</h2><span class="sub">${U.monthLabel(month)}</span></div><div data-cats></div></div>
        <div class="card"><div class="card-head"><h2>Budgets</h2><a class="small" href="#/budgets">See all</a></div><div data-budgets></div></div>
      </div>
      <div class="grid grid-2">
        <div class="card flush"><div class="card-head"><h2>Recent transactions</h2><a class="small" href="#/transactions">See all</a></div><div data-recent style="margin-top:8px"></div></div>
        <div class="card"><div class="card-head"><h2>Accounts</h2><a class="small" href="#/accounts">Manage</a></div><div data-accounts></div></div>
      </div>`;

    root.querySelector('[data-month]').appendChild(ui.monthSwitcher(month, (m) => { month = m; render(root); }));
    const backupBtn = root.querySelector('[data-backup]');
    if (backupBtn) backupBtn.addEventListener('click', App.views.data.exportBackup);

    // Income vs expenses, 12 months ending at the selected month.
    const months = Array.from({ length: 12 }, (_, i) => U.addMonths(month, i - 11));
    const stats = months.map((m) => S.monthStats(m));
    App.charts.columns(root.querySelector('[data-cols]'), {
      labels: months.map(U.monthShort), tipLabels: months.map(U.monthLabel), title: 'Income and expenses per month',
      series: [
        { name: 'Income', color: '--series-1', values: stats.map((s) => s.income) },
        { name: 'Expenses', color: '--series-2', values: stats.map((s) => s.expense) },
      ],
    });

    // Net worth at each month end (today for the current month).
    const first = S.firstMonth();
    const nwMonths = months.filter((m) => m >= U.addMonths(first, -1) && m <= U.thisMonth());
    if (nwMonths.length < 2) nwMonths.unshift(U.addMonths(nwMonths[0] || U.thisMonth(), -1));
    App.charts.line(root.querySelector('[data-nw]'), {
      labels: nwMonths.map(U.monthShort), tipLabels: nwMonths.map((m) => (m === U.thisMonth() ? 'Today' : 'End of ' + U.monthLabel(m))),
      values: nwMonths.map((m) => Math.round(S.netWorth(m === U.thisMonth() ? today : U.endOfMonth(m)).total)), name: 'Net worth', title: 'Net worth over time',
    });

    // Spending by category for the selected month.
    const cats = Object.entries(cur.byCategory)
      .filter(([id]) => (S.category(id) ? S.category(id).kind === 'expense' : id === '_none_expense'))
      .sort((a, b) => b[1] - a[1]);
    const top = cats.slice(0, 8);
    const rest = cats.slice(8).reduce((s, [, v]) => s + v, 0);
    const items = top.map(([id, v]) => {
      const c = ui.catLabel(id.startsWith('_none') ? null : id, 'expense');
      return { label: c.name, icon: c.icon, value: v, sub: cur.expense ? U.pct(v / cur.expense, 0) : '', href: `#/transactions?category=${id.startsWith('_none') ? '_none' : id}&month=${month}` };
    });
    if (rest) items.push({ label: `${cats.length - 8} other categories`, icon: '…', value: rest, sub: U.pct(rest / cur.expense, 0) });
    App.charts.barList(root.querySelector('[data-cats]'), items, { empty: 'No expenses this month.' });

    // Budget glance: the five most-used budgets.
    const bud = Object.entries(st.budgets).filter(([id]) => S.category(id))
      .map(([id, lim]) => ({ c: S.category(id), lim, spent: cur.byCategory[id] || 0 }))
      .sort((a, b) => b.spent / b.lim - a.spent / a.lim).slice(0, 5);
    root.querySelector('[data-budgets]').innerHTML = bud.length ? bud.map((b) => {
      const r = b.spent / b.lim;
      const cls = r > 1 ? 'over' : r >= 0.85 ? 'warning' : '';
      return `<div class="budget-row">
        <span class="budget-name"><span class="cat-icon" style="width:28px;height:28px;font-size:14px">${U.esc(b.c.icon)}</span><span class="truncate">${U.esc(b.c.name)}</span></span>
        <span class="num small"><strong>${U.money(b.spent)}</strong> <span class="muted">/ ${U.money(b.lim)}</span></span>
        <div class="meter ${cls}"><span style="width:${Math.min(100, r * 100).toFixed(1)}%"></span></div>
        ${cls ? `<div class="budget-status ${cls}">${ui.icon('alert')}${r > 1 ? 'Over budget' : 'Close to limit'}</div>` : ''}
      </div>`;
    }).join('') : '<p class="empty">No budgets yet. <a href="#/budgets">Set some</a></p>';

    // Recent transactions.
    const recent = S.sortedTx().slice(0, 7);
    const box = root.querySelector('[data-recent]');
    box.innerHTML = recent.map((t) => {
      const c = ui.catLabel(t.categoryId, t.type);
      const acc = S.account(t.accountId);
      const amt = t.type === 'income' ? U.signed(t.amount) : t.type === 'expense' ? U.signed(-t.amount) : U.money(t.amount);
      return `<div class="tx-row" data-id="${t.id}" tabindex="0" role="button"><span class="cat-icon">${U.esc(c.icon)}</span>
        <div class="tx-main"><div class="tx-title">${U.esc(t.payee || c.name)}</div><div class="tx-sub">${U.fmtDay(t.date)} · ${U.esc(acc ? acc.name : '')}</div></div>
        <span class="tx-amount ${t.type === 'income' ? 'pos' : ''}">${amt}</span></div>`;
    }).join('');
    box.addEventListener('click', (e) => {
      const row = e.target.closest('.tx-row');
      if (row) App.forms.transaction(st.transactions.find((t) => t.id === row.dataset.id));
    });

    // Account balances (cash + holdings).
    const bal = S.balances(today);
    const accs = S.activeAccounts();
    root.querySelector('[data-accounts]').innerHTML = accs.map((a) => {
      const inv = st.trades.some((t) => t.accountId === a.id) ? S.portfolio(today, a.id).value : 0;
      const total = (bal[a.id] || 0) + inv;
      return `<a class="list-item" href="#/transactions?account=${a.id}" style="color:inherit;text-decoration:none">
        <div class="grow"><div class="tx-title">${U.esc(a.name)}</div><div class="tx-sub">${U.esc(S.ACCOUNT_TYPES[a.type])}</div></div>
        <strong class="num ${total < 0 ? 'neg' : ''}">${U.money(total)}</strong></a>`;
    }).join('') || '<p class="empty">No accounts.</p>';
  }

  return { render };
})();
