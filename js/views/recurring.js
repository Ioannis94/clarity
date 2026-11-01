'use strict';
App.views = App.views || {};

App.views.recurring = (function () {
  const U = App.util, S = App.store, ui = App.ui;
  const FREQ_LABEL = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' };

  // Rough monthly equivalent of a rule, for the summary.
  function perMonth(r) {
    const k = { daily: 365 / 12, weekly: 52 / 12, monthly: 1, yearly: 1 / 12 }[r.freq] || 1;
    return (r.amount * k) / (r.every || 1);
  }
  const every = (r) => (r.every > 1 ? `Every ${r.every} ${FREQ_LABEL[r.freq]}s` : `Every ${FREQ_LABEL[r.freq]}`);

  function render(root) {
    const rules = S.get().recurring.slice().sort((a, b) => (a.active === b.active ? (a.next < b.next ? -1 : 1) : a.active ? -1 : 1));
    const active = rules.filter((r) => r.active && (!r.end || r.next <= r.end));
    const inc = active.filter((r) => r.type === 'income').reduce((s, r) => s + perMonth(r), 0);
    const exp = active.filter((r) => r.type === 'expense').reduce((s, r) => s + perMonth(r), 0);

    root.innerHTML = `
      <div class="page-head"><h1>Recurring</h1>
        <div class="actions"><button class="btn primary" data-add>${ui.icon('plus')} New recurring</button></div></div>
      <p class="secondary" style="margin-top:-8px;margin-bottom:16px">Salary, rent, subscriptions and other repeating entries are added automatically on their date whenever you open the app.</p>
      ${rules.length ? `
      <div class="grid grid-3" style="margin-bottom:16px">
        <div class="card"><div class="stat-label">Recurring income / month</div><div class="stat-value pos">${U.money(inc)}</div></div>
        <div class="card"><div class="stat-label">Recurring expenses / month</div><div class="stat-value">${U.money(exp)}</div></div>
        <div class="card"><div class="stat-label">Fixed balance / month</div><div class="stat-value ${inc - exp < 0 ? 'neg' : ''}">${U.signed(Math.round(inc - exp))}</div></div>
      </div>
      <div class="card flush"><div class="table-wrap" style="margin:0;padding:0"><table class="table">
        <thead><tr><th style="padding-left:18px">Entry</th><th>Schedule</th><th>Next</th><th class="num">Amount</th><th style="padding-right:18px"></th></tr></thead>
        <tbody>${rules.map((r) => {
          const c = ui.catLabel(r.categoryId, r.type);
          const acc = S.account(r.accountId), to = S.account(r.toAccountId);
          const ended = r.end && r.next > r.end;
          return `<tr class="clickable" data-id="${r.id}" style="${r.active && !ended ? '' : 'opacity:.55'}">
            <td style="padding-left:18px"><div style="display:flex;gap:12px;align-items:center"><span class="cat-icon">${U.esc(c.icon)}</span>
              <div style="min-width:0"><div class="tx-title">${U.esc(r.payee || c.name)}</div>
              <div class="tx-sub">${U.esc(r.type === 'transfer' ? `${acc ? acc.name : '?'} → ${to ? to.name : '?'}` : `${c.name} · ${acc ? acc.name : '?'}`)}</div></div></div></td>
            <td class="secondary">${every(r)}${r.end ? `<div class="small muted">until ${U.fmtDate(r.end)}</div>` : ''}</td>
            <td>${!r.active ? '<span class="badge">Paused</span>' : ended ? '<span class="badge">Ended</span>' : U.fmtDate(r.next)}</td>
            <td class="num"><strong class="${r.type === 'income' ? 'pos' : ''}">${r.type === 'transfer' ? U.money(r.amount) : U.signed(r.type === 'income' ? r.amount : -r.amount)}</strong></td>
            <td style="padding-right:18px;text-align:right"><button class="btn small" data-toggle="${r.id}">${r.active ? 'Pause' : 'Resume'}</button></td>
          </tr>`;
        }).join('')}</tbody></table></div></div>` : `
      <div class="card empty-state"><h2>No recurring entries</h2><p>Add your salary, rent, utilities or subscriptions once and they'll be recorded every period.</p>
        <button class="btn primary" data-add2>${ui.icon('plus')} New recurring</button></div>`}`;

    root.querySelectorAll('[data-add], [data-add2]').forEach((b) => b.addEventListener('click', () => App.forms.recurring()));
    root.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      S.toggleRecurring(b.dataset.toggle);
    }));
    root.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => App.forms.recurring(S.get().recurring.find((r) => r.id === tr.dataset.id))));
  }

  return { render };
})();
