'use strict';
App.views = App.views || {};

App.views.budgets = (function () {
  const U = App.util, S = App.store, ui = App.ui;
  let month = U.thisMonth();

  // Status of one budget line: meter class, icon and label (never color alone).
  function status(spent, limit) {
    if (spent > limit) return { cls: 'over', icon: 'alert', text: `Over by ${U.money(spent - limit)}` };
    if (spent >= limit * 0.85) return { cls: 'warning', icon: 'alert', text: `${U.money(limit - spent)} left · close to limit` };
    return { cls: '', icon: null, text: `${U.money(limit - spent)} left` };
  }

  function avgSpend(catId, months = 3) {
    let sum = 0;
    for (let i = 1; i <= months; i++) sum += S.monthStats(U.addMonths(U.thisMonth(), -i)).byCategory[catId] || 0;
    return Math.round(sum / months);
  }

  function editBudgets() {
    const cats = S.categoriesOf('expense');
    const b = S.get().budgets;
    ui.modal({
      title: 'Monthly budgets',
      body: `<p class="note">Set a monthly limit per category. Leave a field empty for no budget. The hint shows your average over the last 3 months.</p>
        ${cats.map((c) => {
          const avg = avgSpend(c.id);
          return `<div class="field" style="display:grid;grid-template-columns:minmax(0,1fr) 130px;align-items:center;gap:12px;margin-bottom:10px">
            <label for="b-${c.id}" style="display:flex;gap:10px;align-items:center"><span class="cat-icon" style="width:30px;height:30px;font-size:15px">${U.esc(c.icon)}</span>
              <span><span style="color:var(--text)">${U.esc(c.name)}</span><br><span class="hint">${avg ? 'avg ' + U.money(avg) : 'no recent spending'}</span></span></label>
            <input id="b-${c.id}" name="${c.id}" inputmode="decimal" placeholder="—" value="${b[c.id] ? U.centsToInput(b[c.id]) : ''}">
          </div>`;
        }).join('')}`,
      onSubmit(form) {
        const map = {};
        for (const c of cats) {
          const raw = form.elements[c.id].value.trim();
          if (!raw) continue;
          const v = U.toCents(raw);
          if (isNaN(v) || v < 0) return ui.fieldError(form, c.id, 'Enter a valid amount.');
          map[c.id] = v;
        }
        S.setBudgets(map);
        ui.toast('Budgets saved');
      },
    });
  }

  function render(root) {
    const st = S.get();
    const stats = S.monthStats(month);
    const budgeted = Object.entries(st.budgets).filter(([id]) => S.category(id));
    const totalLimit = budgeted.reduce((s, [, v]) => s + v, 0);
    const totalSpent = budgeted.reduce((s, [id]) => s + (stats.byCategory[id] || 0), 0);
    const isCurrent = month === U.thisMonth();
    const [y, m] = month.split('-').map(Number);
    const dim = U.daysInMonth(y, m);
    const dayOfMonth = Number(U.today().slice(8, 10));
    const pace = isCurrent ? dayOfMonth / dim : 1;
    const unbudgeted = Object.entries(stats.byCategory)
      .filter(([id]) => !st.budgets[id] && (S.category(id) ? S.category(id).kind === 'expense' : id === '_none_expense'))
      .sort((a, b) => b[1] - a[1]);

    root.innerHTML = `
      <div class="page-head"><h1>Budgets</h1>
        <div class="actions"><span data-month></span><button class="btn primary" data-edit>${ui.icon('edit')} Edit budgets</button></div></div>
      ${!budgeted.length ? `<div class="card empty-state"><h2>No budgets yet</h2><p>Set monthly limits for categories like groceries or restaurants and track how much is left.</p>
        <button class="btn primary" data-edit2>Set budgets</button></div>` : `
      <div class="grid grid-3" style="margin-bottom:16px">
        <div class="card"><div class="stat-label">Budgeted</div><div class="stat-value">${U.money(totalLimit)}</div></div>
        <div class="card"><div class="stat-label">Spent</div><div class="stat-value">${U.money(totalSpent)}</div>
          <div class="stat-delta">${U.pct(totalLimit ? totalSpent / totalLimit : 0, 0)} of budget${isCurrent ? ` · ${U.pct(pace, 0)} of month gone` : ''}</div></div>
        <div class="card"><div class="stat-label">${totalLimit - totalSpent >= 0 ? 'Left to spend' : 'Over budget'}</div>
          <div class="stat-value ${totalLimit - totalSpent < 0 ? 'neg' : ''}">${U.money(Math.abs(totalLimit - totalSpent))}</div>
          ${isCurrent && totalLimit - totalSpent > 0 ? `<div class="stat-delta">≈ ${U.money((totalLimit - totalSpent) / Math.max(1, dim - dayOfMonth + 1))} per day for ${dim - dayOfMonth + 1} days</div>` : ''}</div>
      </div>
      <div class="card">
        ${budgeted.sort((a, b) => (stats.byCategory[b[0]] || 0) / b[1] - (stats.byCategory[a[0]] || 0) / a[1]).map(([id, limit]) => {
          const c = S.category(id);
          const spent = stats.byCategory[id] || 0;
          const s = status(spent, limit);
          return `<div class="budget-row">
            <a class="budget-name" href="#/transactions?category=${id}&month=${month}" style="color:inherit"><span class="cat-icon" style="width:30px;height:30px;font-size:15px">${U.esc(c.icon)}</span><span class="truncate">${U.esc(c.name)}</span></a>
            <div class="num"><strong>${U.money(spent)}</strong> <span class="muted">/ ${U.money(limit)}</span></div>
            <div class="meter ${s.cls}" role="meter" aria-valuemin="0" aria-valuemax="${limit}" aria-valuenow="${spent}" aria-label="${U.esc(c.name)}"><span style="width:${Math.min(100, (spent / limit) * 100).toFixed(1)}%"></span></div>
            <div class="budget-status ${s.cls}">${s.icon ? ui.icon(s.icon) : ''}${s.text}</div>
            <div class="small muted num">${U.pct(spent / limit, 0)}</div>
          </div>`;
        }).join('')}
      </div>`}
      ${unbudgeted.length ? `<h2 class="section-title">Spending without a budget</h2><div class="card" data-unbudgeted></div>` : ''}`;

    root.querySelector('[data-month]').appendChild(ui.monthSwitcher(month, (mm) => { month = mm; render(root); }));
    root.querySelectorAll('[data-edit], [data-edit2]').forEach((b) => b.addEventListener('click', editBudgets));
    const ub = root.querySelector('[data-unbudgeted]');
    if (ub) App.charts.barList(ub, unbudgeted.map(([id, v]) => {
      const c = ui.catLabel(id.startsWith('_none') ? null : id, 'expense');
      return { label: c.name, icon: c.icon, value: v, href: `#/transactions?category=${id.startsWith('_none') ? '_none' : id}&month=${month}` };
    }));
  }

  return { render };
})();
