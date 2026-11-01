'use strict';
App.views = App.views || {};

App.views.accounts = (function () {
  const U = App.util, S = App.store, ui = App.ui;

  function render(root) {
    const st = S.get();
    const bal = S.balances(U.today());
    const nw = S.netWorth();
    // Market value of the holdings kept in each account.
    const holdingsByAcc = {};
    for (const id of new Set(st.trades.map((t) => t.accountId))) holdingsByAcc[id] = S.portfolio(undefined, id).value;
    const groups = {};
    for (const a of st.accounts) (groups[a.archived ? '_archived' : a.type] = groups[a.archived ? '_archived' : a.type] || []).push(a);
    const order = [...Object.keys(S.ACCOUNT_TYPES), '_archived'].filter((k) => groups[k]);

    root.innerHTML = `
      <div class="page-head"><h1>Accounts</h1>
        <div class="actions">
          <button class="btn" data-transfer>${ui.icon('repeat')} Transfer</button>
          <button class="btn primary" data-add>${ui.icon('plus')} New account</button>
        </div></div>
      <div class="hero">
        <div><div class="hero-label">Net worth</div><div class="hero-value">${U.money(nw.total)}</div></div>
        <div class="hero-parts"><span>Cash & accounts <strong>${U.money(nw.cash)}</strong></span><span>Investments <strong>${U.money(nw.invest)}</strong></span></div>
      </div>
      ${order.map((k) => `
        <h2 class="section-title">${k === '_archived' ? 'Archived' : U.esc(S.ACCOUNT_TYPES[k])}</h2>
        <div class="grid grid-3">${groups[k].map((a) => {
          const cash = bal[a.id] || 0;
          const inv = holdingsByAcc[a.id] || 0;
          return `<div class="card acc-card" data-id="${a.id}" tabindex="0" role="button">
            <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
              <div class="acc-type">${U.esc(S.ACCOUNT_TYPES[a.type] || a.type)}</div>
              <button class="icon-btn" data-edit="${a.id}" aria-label="Edit ${U.esc(a.name)}" style="margin:-8px -8px 0 0">${ui.icon('edit')}</button>
            </div>
            <div class="acc-name">${U.esc(a.name)}</div>
            <div class="acc-balance ${cash + inv < 0 ? 'neg' : ''}">${U.money(cash + inv)}</div>
            ${a.type === 'broker' || inv ? `<div class="small muted">Cash ${U.money(cash)} · Holdings ${U.money(inv)}</div>` : ''}
          </div>`;
        }).join('')}</div>`).join('')}
      ${!st.accounts.length ? '<div class="card empty-state"><h2>No accounts</h2><p>Add a bank account, card, cash wallet or broker account to start.</p></div>' : ''}
      <p class="small muted" style="margin-top:20px">Click an account to see its transactions.</p>`;

    root.querySelector('[data-add]').addEventListener('click', () => App.forms.account());
    root.querySelector('[data-transfer]').addEventListener('click', () => App.forms.transaction(null, { type: 'transfer' }));
    root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      App.forms.account(S.account(b.dataset.edit));
    }));
    root.querySelectorAll('.acc-card').forEach((c) => {
      const go = () => { location.hash = `#/transactions?account=${c.dataset.id}`; };
      c.addEventListener('click', go);
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    });
  }

  return { render };
})();
