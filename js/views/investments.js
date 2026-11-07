'use strict';
App.views = App.views || {};

App.views.investments = (function () {
  const U = App.util, S = App.store, ui = App.ui;
  const plClass = (v) => (v > 0.5 ? 'pos' : v < -0.5 ? 'neg' : '');
  const qty = (n) => U.num(n, 6);
  const unitPrice = (p) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: p < 1 ? 6 : 2 }).format(p);

  function render(root) {
    const st = S.get();
    const pf = S.portfolio();
    const open = pf.holdings.filter((h) => h.qty > 0).sort((a, b) => b.value - a.value);
    const closed = pf.holdings.filter((h) => h.qty === 0);
    const staleDays = 30;
    const stale = open.filter((h) => !h.priceDate || (U.parseDate(U.today()) - U.parseDate(h.priceDate)) / 864e5 > staleDays);

    root.innerHTML = `
      <div class="page-head"><h1>Investments</h1>
        <div class="actions">
          ${open.length ? `<button class="btn" data-prices>${ui.icon('edit')} Update prices</button>` : ''}
          <button class="btn primary" data-trade>${ui.icon('plus')} Add trade</button>
        </div></div>
      ${!st.trades.length ? `
        <div class="card empty-state"><h2>Track your investments</h2>
          <p>Record each buy and sell (stocks, ETFs, funds, crypto…). The app works out your average cost and profit or loss. Update prices whenever you like.</p>
          <p class="small muted">Tip: create an account of type “Investment / broker” for your trades. It counts toward net worth with the value of its holdings only.</p>
          <button class="btn primary" data-trade2>${ui.icon('plus')} Add your first trade</button>
          ${!st.accounts.some((a) => a.type === 'broker') ? ' <button class="btn" data-broker>New broker account</button>' : ''}
        </div>` : `
      <div class="grid grid-4" style="margin-bottom:16px">
        <div class="card"><div class="stat-label">Portfolio value</div><div class="stat-value">${U.money(pf.value)}</div>
          <div class="stat-delta">${open.length} holding${open.length === 1 ? '' : 's'}</div></div>
        <div class="card"><div class="stat-label">Cost basis</div><div class="stat-value">${U.money(pf.cost)}</div><div class="stat-delta">average cost, incl. fees</div></div>
        <div class="card"><div class="stat-label">Unrealized gain/loss</div><div class="stat-value ${plClass(pf.unrealized)}">${U.signed(Math.round(pf.unrealized))}</div>
          <div class="stat-delta">${pf.cost ? (pf.unrealized >= 0 ? '+' : '') + U.pct(pf.unrealized / pf.cost) : '—'}</div></div>
        <div class="card"><div class="stat-label">Realized gain/loss</div><div class="stat-value ${plClass(pf.realized)}">${U.signed(Math.round(pf.realized))}</div><div class="stat-delta">from sales, after fees</div></div>
      </div>
      ${stale.length ? `<div class="note">${ui.icon('alert')} ${stale.length === 1 ? `${U.esc(stale[0].symbol)} has` : `${stale.length} holdings have`} no price from the last ${staleDays} days. <button class="link-btn" data-prices>Update prices</button></div>` : ''}
      <div class="card flush" style="margin-bottom:16px">
        <div class="card-head"><h2>Holdings</h2></div>
        <div class="table-wrap" style="margin:0;padding:0 8px"><table class="table">
          <thead><tr><th>Asset</th><th class="num">Quantity</th><th class="num">Avg cost</th><th class="num">Cost basis</th><th class="num">Price</th><th class="num">Value</th><th class="num">Gain/loss</th><th class="num">Weight</th></tr></thead>
          <tbody>${open.map((h) => `
            <tr class="clickable" data-sym="${U.esc(h.symbol)}" title="Update price">
              <td><strong>${U.esc(h.symbol)}</strong><div class="small muted truncate" style="max-width:220px">${U.esc(h.asset.name)} · ${U.esc(S.ASSET_KINDS[h.asset.kind] || h.asset.kind)}</div></td>
              <td class="num">${qty(h.qty)}</td>
              <td class="num">${unitPrice(h.avgCost)}</td>
              <td class="num">${U.money(h.cost)}</td>
              <td class="num">${unitPrice(h.price)}<div class="small muted">${h.priceDate ? U.fmtDate(h.priceDate) : ''}</div></td>
              <td class="num"><strong>${U.money(h.value)}</strong></td>
              <td class="num ${plClass(h.unrealized)}">${U.signed(Math.round(h.unrealized))}<div class="small">${h.cost ? (h.unrealized >= 0 ? '+' : '') + U.pct(h.unrealized / h.cost) : ''}</div></td>
              <td class="num">${pf.value ? U.pct(h.value / pf.value) : '—'}</td>
            </tr>`).join('') || '<tr><td colspan="8" class="empty">No open positions.</td></tr>'}</tbody>
        </table></div>
      </div>
      <div class="grid grid-2" style="margin-bottom:16px">
        <div class="card"><div class="card-head"><h2>Allocation by asset</h2></div><div data-alloc></div></div>
        <div class="card"><div class="card-head"><h2>Allocation by type</h2></div><div data-kind></div></div>
      </div>
      <div class="card" style="margin-bottom:16px"><div class="card-head"><h2>Portfolio value</h2><span class="sub">month-end, last 12 months</span></div><div data-chart></div></div>
      ${closed.length ? `<div class="card flush" style="margin-bottom:16px"><div class="card-head"><h2>Closed positions</h2></div>
        <div class="table-wrap" style="margin:0;padding:0 8px"><table class="table"><thead><tr><th>Asset</th><th class="num">Realized gain/loss</th><th class="num">Fees paid</th></tr></thead>
        <tbody>${closed.map((h) => `<tr><td><strong>${U.esc(h.symbol)}</strong> <span class="muted small">${U.esc(h.asset.name)}</span></td>
          <td class="num ${plClass(h.realized)}">${U.signed(Math.round(h.realized))}</td><td class="num">${U.money(h.fees)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
      <div class="card flush">
        <div class="card-head"><h2>Trade history</h2><span class="sub">${st.trades.length} trades</span></div>
        <div class="table-wrap" style="margin:0;padding:0 8px"><table class="table">
          <thead><tr><th>Date</th><th>Trade</th><th class="num">Quantity</th><th class="num">Price</th><th class="num">Fees</th><th class="num">Total</th><th>Account</th></tr></thead>
          <tbody>${S.sortedTrades().reverse().map((t) => `
            <tr class="clickable" data-trade-id="${t.id}">
              <td>${U.fmtDate(t.date)}</td>
              <td><span class="badge">${t.side === 'buy' ? 'Buy' : 'Sell'}</span> <strong>${U.esc(t.symbol)}</strong></td>
              <td class="num">${qty(t.qty)}</td>
              <td class="num">${unitPrice(t.price)}</td>
              <td class="num">${U.money(t.fees)}</td>
              <td class="num">${U.signed(S.tradeCash(t))}</td>
              <td class="secondary">${U.esc((S.account(t.accountId) || {}).name || '?')}</td>
            </tr>`).join('')}</tbody>
        </table></div>
      </div>`}`;

    root.querySelectorAll('[data-trade], [data-trade2]').forEach((b) => b.addEventListener('click', () => App.forms.trade()));
    root.querySelectorAll('[data-prices]').forEach((b) => b.addEventListener('click', () => App.forms.prices()));
    const br = root.querySelector('[data-broker]');
    if (br) br.addEventListener('click', () => App.forms.account());
    root.querySelectorAll('tr[data-sym]').forEach((tr) => tr.addEventListener('click', () => App.forms.prices(tr.dataset.sym)));
    root.querySelectorAll('tr[data-trade-id]').forEach((tr) => tr.addEventListener('click', () => App.forms.trade(st.trades.find((t) => t.id === tr.dataset.tradeId))));
    if (!st.trades.length) return;

    App.charts.barList(root.querySelector('[data-alloc]'), open.map((h) => ({ label: `${h.symbol} · ${h.asset.name}`, value: h.value, sub: pf.value ? U.pct(h.value / pf.value, 0) : '' })), { empty: 'No open positions.' });
    const byKind = {};
    for (const h of open) byKind[h.asset.kind] = (byKind[h.asset.kind] || 0) + h.value;
    App.charts.barList(root.querySelector('[data-kind]'), Object.entries(byKind).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ label: S.ASSET_KINDS[k] || k, value: v, sub: pf.value ? U.pct(v / pf.value, 0) : '' })), { empty: 'No open positions.' });

    const months = Array.from({ length: 12 }, (_, i) => U.addMonths(U.thisMonth(), i - 11));
    const values = months.map((m) => Math.round(S.portfolio(m === U.thisMonth() ? U.today() : U.endOfMonth(m)).value));
    App.charts.line(root.querySelector('[data-chart]'), {
      labels: months.map(U.monthShort), tipLabels: months.map((m) => (m === U.thisMonth() ? 'Today' : 'End of ' + U.monthLabel(m))),
      values, name: 'Portfolio value', title: 'Portfolio value, last 12 months',
    });
  }

  return { render };
})();
