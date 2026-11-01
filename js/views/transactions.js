'use strict';
App.views = App.views || {};

App.views.transactions = (function () {
  const U = App.util, S = App.store, ui = App.ui;
  // Filters survive re-renders while the app is open.
  const f = { q: '', month: U.thisMonth(), all: false, account: '', category: '', type: '' };
  let lastParams = '';
  let limit = 150;

  function applyParams(params) {
    const key = JSON.stringify(params);
    if (key === lastParams) return;
    lastParams = key;
    if (!Object.keys(params).length) return;
    Object.assign(f, { q: '', account: '', category: '', type: '' });
    if (params.account) { f.account = params.account; f.all = true; }
    if (params.category) f.category = params.category;
    if (params.month) { f.month = params.month; f.all = false; }
    if (params.type) f.type = params.type;
  }

  function filtered() {
    const q = f.q.trim().toLowerCase();
    return S.sortedTx().filter((t) => {
      if (!f.all && t.date.slice(0, 7) !== f.month) return false;
      if (f.account && t.accountId !== f.account && t.toAccountId !== f.account) return false;
      if (f.type && t.type !== f.type) return false;
      if (f.category === '_none') { if (t.categoryId || t.type === 'transfer') return false; }
      else if (f.category && t.categoryId !== f.category) return false;
      if (q) {
        const c = S.category(t.categoryId);
        const hay = [t.payee, t.note, c && c.name, (S.account(t.accountId) || {}).name, U.centsToInput(t.amount)].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  // How a transaction changes the money shown in the current view.
  function signedAmount(t) {
    if (t.type === 'income') return t.amount;
    if (t.type === 'expense') return -t.amount;
    if (f.account) return t.toAccountId === f.account ? t.amount : -t.amount;
    return 0;
  }

  function rowHTML(t) {
    const c = ui.catLabel(t.categoryId, t.type);
    const acc = S.account(t.accountId), to = S.account(t.toAccountId);
    const title = t.payee || c.name;
    const sub = t.type === 'transfer'
      ? `${acc ? acc.name : '?'} → ${to ? to.name : '?'}`
      : [t.payee ? c.name : '', acc ? acc.name : ''].filter(Boolean).join(' · ');
    const amt = signedAmount(t);
    const cls = t.type === 'income' ? 'pos' : '';
    const text = t.type === 'transfer' && !f.account ? U.money(t.amount) : U.signed(amt);
    return `<div class="tx-row" data-id="${t.id}" tabindex="0" role="button">
      <span class="cat-icon">${U.esc(c.icon)}</span>
      <div class="tx-main"><div class="tx-title">${U.esc(title)}${t.recurringId ? ` <span class="badge" title="Recurring">${ui.icon('repeat')}</span>` : ''}</div>
        <div class="tx-sub">${U.esc(sub)}${t.note ? ' · ' + U.esc(t.note) : ''}</div></div>
      <span class="tx-amount ${cls}">${text}</span>
    </div>`;
  }

  function renderResults(root) {
    const list = filtered();
    let inc = 0, exp = 0;
    for (const t of list) { if (t.type === 'income') inc += t.amount; else if (t.type === 'expense') exp += t.amount; }
    root.querySelector('[data-summary]').innerHTML = `
      <div class="card"><div class="stat-label">Income</div><div class="stat-value pos">${U.money(inc)}</div></div>
      <div class="card"><div class="stat-label">Expenses</div><div class="stat-value">${U.money(exp)}</div></div>
      <div class="card"><div class="stat-label">Net</div><div class="stat-value ${inc - exp < 0 ? 'neg' : ''}">${U.signed(inc - exp)}</div></div>
      <div class="card"><div class="stat-label">Entries</div><div class="stat-value">${list.length}</div></div>`;

    const box = root.querySelector('[data-list]');
    if (!list.length) {
      const none = !S.get().transactions.length;
      box.innerHTML = `<div class="empty-state">${none
        ? `<h2>No transactions yet</h2><p>Add your first expense or income with the + button, or import a bank statement.</p>
           <button class="btn primary" data-add>${ui.icon('plus')} Add transaction</button> <a class="btn" href="#/data">Import CSV</a>`
        : '<p>No transactions match these filters.</p>'}</div>`;
      const add = box.querySelector('[data-add]');
      if (add) add.addEventListener('click', () => App.forms.transaction());
      return;
    }
    const shown = list.slice(0, limit);
    const days = new Map();
    for (const t of shown) { if (!days.has(t.date)) days.set(t.date, []); days.get(t.date).push(t); }
    box.innerHTML = [...days.entries()].map(([d, txs]) => {
      const net = txs.reduce((s, t) => s + signedAmount(t), 0);
      return `<div class="tx-group"><div class="tx-day"><span>${U.fmtDay(d)}</span><span class="num">${net ? U.signed(net) : ''}</span></div>${txs.map(rowHTML).join('')}</div>`;
    }).join('') + (list.length > limit ? `<div style="padding:14px;text-align:center"><button class="btn" data-more>Show more (${list.length - limit} left)</button></div>` : '');
    const more = box.querySelector('[data-more]');
    if (more) more.addEventListener('click', () => { limit += 300; renderResults(root); });
  }

  function render(root, params) {
    applyParams(params);
    limit = 150;
    const accounts = S.get().accounts;
    root.innerHTML = `
      <div class="page-head"><h1>Transactions</h1>
        <div class="actions"><button class="btn primary" data-add>${ui.icon('plus')} Add</button></div></div>
      <div class="toolbar">
        <div class="search">${ui.icon('search')}<input type="search" placeholder="Search payee, note, amount…" value="${U.esc(f.q)}" data-q aria-label="Search"></div>
        <span data-month></span>
        <button class="btn ${f.all ? 'primary' : ''}" data-all>${f.all ? 'All time ✓' : 'All time'}</button>
        <select data-type aria-label="Type">${ui.options([['', 'All types'], ['expense', 'Expenses'], ['income', 'Income'], ['transfer', 'Transfers']], f.type)}</select>
        <select data-account aria-label="Account">${ui.options([['', 'All accounts'], ...accounts.map((a) => [a.id, a.name])], f.account)}</select>
        <select data-category aria-label="Category">
          <option value="">All categories</option>
          <optgroup label="Expenses">${ui.categoryOptions('expense', f.category)}</optgroup>
          <optgroup label="Income">${ui.categoryOptions('income', f.category)}</optgroup>
          <option value="_none"${f.category === '_none' ? ' selected' : ''}>Uncategorized</option>
        </select>
      </div>
      <div class="grid grid-4" data-summary style="margin-bottom:16px"></div>
      <div class="card flush" data-list></div>`;
    if (!f.category) root.querySelector('[data-category]').value = '';

    const monthSlot = root.querySelector('[data-month]');
    const drawMonth = () => {
      const sw = ui.monthSwitcher(f.month, (m) => { f.month = m; f.all = false; drawMonth(); syncAll(); renderResults(root); });
      sw.style.opacity = f.all ? 0.5 : 1;
      monthSlot.replaceChildren(sw);
    };
    const allBtn = root.querySelector('[data-all]');
    const syncAll = () => { allBtn.classList.toggle('primary', f.all); allBtn.textContent = f.all ? 'All time ✓' : 'All time'; monthSlot.firstChild.style.opacity = f.all ? 0.5 : 1; };
    drawMonth();
    allBtn.addEventListener('click', () => { f.all = !f.all; syncAll(); renderResults(root); });

    root.querySelector('[data-q]').addEventListener('input', U.debounce((e) => { f.q = e.target.value; renderResults(root); }, 150));
    root.querySelector('[data-type]').addEventListener('change', (e) => { f.type = e.target.value; renderResults(root); });
    root.querySelector('[data-account]').addEventListener('change', (e) => { f.account = e.target.value; renderResults(root); });
    root.querySelector('[data-category]').addEventListener('change', (e) => { f.category = e.target.value; renderResults(root); });
    root.querySelector('[data-add]').addEventListener('click', () => App.forms.transaction(null, f.account ? { accountId: f.account } : {}));

    const list = root.querySelector('[data-list]');
    const open = (e) => {
      const row = e.target.closest('.tx-row');
      if (!row) return;
      const tx = S.get().transactions.find((t) => t.id === row.dataset.id);
      if (tx) App.forms.transaction(tx);
    };
    list.addEventListener('click', open);
    list.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); } });
    renderResults(root);
  }

  return { render };
})();
