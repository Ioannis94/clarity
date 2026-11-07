'use strict';
// Add/edit dialogs: transactions, recurring rules, accounts, trades and prices.
App.forms = (function () {
  const U = App.util, S = App.store, ui = App.ui;
  const FREQS = [['monthly', 'Monthly'], ['weekly', 'Weekly'], ['yearly', 'Yearly'], ['daily', 'Daily']];

  function typeSwitch(name, items, selected) {
    return `<div class="segmented" role="radiogroup">${items.map(([v, l]) => `
      <label><input type="radio" name="${name}" value="${v}"${v === selected ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
  }

  // Shared fields for a transaction or a recurring rule.
  function txFieldsHTML(v) {
    const accounts = S.activeAccounts();
    const to = v.toAccountId || (accounts.find((a) => a.id !== v.accountId) || {}).id;
    return `
      <div class="field">${typeSwitch('type', [['expense', 'Expense'], ['income', 'Income'], ['transfer', 'Transfer']], v.type)}</div>
      <div class="row">
        <div class="field"><label for="f-amount">Amount (€)</label>
          <input id="f-amount" name="amount" class="amount-input" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${U.esc(U.centsToInput(v.amount))}" autofocus></div>
        <div class="field"><label for="f-date">${v.isRule ? 'First date' : 'Date'}</label>
          <input id="f-date" name="date" type="date" value="${U.esc(v.date)}" required></div>
      </div>
      <div class="row">
        <div class="field"><label for="f-account" data-from-label>${v.type === 'transfer' ? 'From account' : 'Account'}</label>
          <select id="f-account" name="accountId">${ui.accountOptions(v.accountId)}</select></div>
        <div class="field" data-for="transfer"><label for="f-to">To account</label>
          <select id="f-to" name="toAccountId">${ui.accountOptions(to)}</select></div>
        <div class="field" data-for="category"><label for="f-cat">Category</label>
          <select id="f-cat" name="categoryId"></select></div>
      </div>
      <div class="field"><label for="f-payee" data-payee-label>${v.type === 'income' ? 'From (payer)' : 'Payee / description'}</label>
        <input id="f-payee" name="payee" list="payee-list" autocomplete="off" value="${U.esc(v.payee)}" placeholder="e.g. Supermarket, Landlord, Employer">
        <datalist id="payee-list">${S.payees().map((p) => `<option value="${U.esc(p)}">`).join('')}</datalist></div>
      <div class="field"><label for="f-note">Note</label>
        <input id="f-note" name="note" autocomplete="off" value="${U.esc(v.note)}" placeholder="Optional"></div>`;
  }

  // Wire up type switching and payee-based category suggestions.
  function bindTxFields(form, v) {
    let catTouched = !!v.categoryId;
    const cat = form.elements.categoryId;
    const sync = () => {
      const type = form.elements.type.value;
      const kind = type === 'income' ? 'income' : 'expense';
      const current = cat.value || v.categoryId;
      cat.innerHTML = ui.categoryOptions(kind, current);
      if (!S.category(cat.value) || S.category(cat.value).kind !== kind) cat.value = (S.fallbackCategory(kind) || {}).id || '';
      form.querySelector('[data-for="transfer"]').hidden = type !== 'transfer';
      form.querySelector('[data-for="category"]').hidden = type === 'transfer';
      form.querySelector('[data-from-label]').textContent = type === 'transfer' ? 'From account' : 'Account';
      form.querySelector('[data-payee-label]').textContent = type === 'income' ? 'From (payer)' : type === 'transfer' ? 'Description' : 'Payee / description';
    };
    cat.innerHTML = ui.categoryOptions(v.type === 'income' ? 'income' : 'expense', v.categoryId);
    if (!v.categoryId) cat.value = (S.fallbackCategory(v.type === 'income' ? 'income' : 'expense') || {}).id || '';
    sync();
    form.querySelectorAll('input[name="type"]').forEach((r) => r.addEventListener('change', () => { catTouched = false; sync(); suggest(); }));
    cat.addEventListener('change', () => { catTouched = true; });
    const suggest = () => {
      if (catTouched) return;
      const type = form.elements.type.value;
      if (type === 'transfer') return;
      const g = S.guessCategory(form.elements.payee.value, type);
      if (g) cat.value = g;
    };
    form.elements.payee.addEventListener('change', suggest);
    form.elements.payee.addEventListener('blur', suggest);
  }

  function readTxFields(form) {
    const f = form.elements;
    const type = f.type.value;
    const amount = U.toCents(f.amount.value);
    if (!(amount > 0)) return ui.fieldError(form, 'amount', 'Enter an amount greater than zero.');
    if (!U.isDate(f.date.value)) return ui.fieldError(form, 'date', 'Pick a date.');
    if (!f.accountId.value) return ui.fieldError(form, 'accountId', 'Create an account first.');
    if (type === 'transfer' && f.toAccountId.value === f.accountId.value) return ui.fieldError(form, 'toAccountId', 'Choose a different account.');
    return {
      type, amount, date: f.date.value, accountId: f.accountId.value,
      toAccountId: type === 'transfer' ? f.toAccountId.value : null,
      categoryId: type === 'transfer' ? null : f.categoryId.value || null,
      payee: f.payee.value, note: f.note.value,
    };
  }

  // ---------- Transaction ----------
  function transaction(tx, preset = {}) {
    if (!S.activeAccounts().length) { ui.toast('Add an account first.', 'error'); location.hash = '#/accounts'; return; }
    const editing = !!tx;
    const v = tx ? Object.assign({}, tx) : Object.assign({ type: 'expense', amount: null, date: U.today(), accountId: S.activeAccounts()[0].id, payee: '', note: '' }, preset);
    const rule = tx && tx.recurringId && S.get().recurring.find((r) => r.id === tx.recurringId);
    ui.modal({
      title: editing ? 'Edit transaction' : 'New transaction',
      submitLabel: editing ? 'Save' : 'Add',
      body: txFieldsHTML(v) + (editing ? (rule ? `<p class="note">Created by the recurring rule “${U.esc(rule.payee || 'untitled')}”. Editing it here changes only this entry.</p>` : '') : `
        <div class="field">
          <label class="check"><input type="checkbox" name="repeat"> Repeat this automatically</label>
          <div class="row" data-repeat hidden>
            <select name="freq" aria-label="How often">${ui.options(FREQS, 'monthly')}</select>
            <div class="hint" style="align-self:center">Future entries are added on their date when you open the app.</div>
          </div>
        </div>`),
      leftButtons: editing ? `<button type="button" class="btn ghost danger-text" data-delete>${ui.icon('trash')} Delete</button>` : '',
      onOpen(form) {
        bindTxFields(form, v);
        if (!editing) form.elements.repeat.addEventListener('change', (e) => { form.querySelector('[data-repeat]').hidden = !e.target.checked; });
        const del = form.querySelector('[data-delete]');
        if (del) del.addEventListener('click', async () => {
          ui.closeModal();
          if (await ui.confirm('Delete this transaction? This cannot be undone.')) { S.deleteTx(tx.id); ui.toast('Transaction deleted'); }
        });
      },
      onSubmit(form) {
        const data = readTxFields(form);
        if (!data) return false;
        if (editing) { S.updateTx(tx.id, data); ui.toast('Saved'); return; }
        if (form.elements.repeat.checked) {
          const r = S.saveRecurring(Object.assign(data, { start: data.date, freq: form.elements.freq.value, every: 1 }));
          ui.toast(r.start <= U.today() ? 'Added, and set to repeat' : 'Scheduled');
        } else {
          S.addTx(data);
          ui.toast('Transaction added');
        }
      },
    });
  }

  // ---------- Recurring rule ----------
  function recurring(rule) {
    if (!S.activeAccounts().length) { ui.toast('Add an account first.', 'error'); return; }
    const editing = !!rule;
    const v = rule ? Object.assign({ date: rule.start, isRule: true }, rule)
      : { type: 'expense', amount: null, date: U.today(), accountId: S.activeAccounts()[0].id, payee: '', note: '', freq: 'monthly', every: 1, end: '', isRule: true };
    ui.modal({
      title: editing ? 'Edit recurring entry' : 'New recurring entry',
      body: txFieldsHTML(v) + `
        <div class="row-3">
          <div class="field"><label for="f-freq">Repeats</label><select id="f-freq" name="freq">${ui.options(FREQS, v.freq)}</select></div>
          <div class="field"><label for="f-every">Every</label><input id="f-every" name="every" type="number" min="1" max="99" value="${v.every || 1}"></div>
          <div class="field"><label for="f-end">Ends (optional)</label><input id="f-end" name="end" type="date" value="${U.esc(v.end || '')}"></div>
        </div>
        <p class="note">Entries are added automatically on each date when you open the app. If the first date is in the past, the missed entries are added now.</p>`,
      leftButtons: editing ? `<button type="button" class="btn ghost danger-text" data-delete>${ui.icon('trash')} Delete</button>` : '',
      onOpen(form) {
        bindTxFields(form, v);
        const del = form.querySelector('[data-delete]');
        if (del) del.addEventListener('click', async () => {
          ui.closeModal();
          if (await ui.confirm('Delete this recurring entry? Transactions it already created are kept.')) { S.deleteRecurring(rule.id); ui.toast('Recurring entry deleted'); }
        });
      },
      onSubmit(form) {
        const data = readTxFields(form);
        if (!data) return false;
        const end = form.elements.end.value;
        if (end && end < data.date) return ui.fieldError(form, 'end', 'The end date must be after the first date.');
        const before = S.get().transactions.length;
        S.saveRecurring(Object.assign(data, { id: rule && rule.id, start: data.date, freq: form.elements.freq.value, every: form.elements.every.value, end, active: rule ? rule.active : true }));
        const added = S.get().transactions.length - before;
        ui.toast(added ? `Saved — ${added} entr${added === 1 ? 'y' : 'ies'} added` : 'Saved');
      },
    });
  }

  // ---------- Account ----------
  function account(acc) {
    const editing = !!acc;
    const v = acc || { name: '', type: 'bank', opening: 0, archived: false };
    ui.modal({
      title: editing ? 'Edit account' : 'New account',
      body: `
        <div class="field"><label for="a-name">Name</label><input id="a-name" name="name" value="${U.esc(v.name)}" placeholder="e.g. Piraeus Bank, Revolut, Wallet" autofocus></div>
        <div class="row">
          <div class="field"><label for="a-type">Type</label><select id="a-type" name="type">${ui.options(Object.entries(S.ACCOUNT_TYPES), v.type)}</select></div>
          <div class="field" data-opening><label for="a-open">Starting balance (€)</label><input id="a-open" name="opening" inputmode="decimal" value="${U.esc(U.centsToInput(v.opening))}">
            <span class="hint">Balance before your first entry. Use a minus sign for card debt.</span></div>
          <p class="note" data-broker-note>A broker account is worth its holdings only. Add your purchases under Investments.</p>
        </div>
        ${editing ? `<label class="check"><input type="checkbox" name="archived"${v.archived ? ' checked' : ''}> Archived (hidden from forms, still counted in net worth)</label>` : ''}`,
      leftButtons: editing ? `<button type="button" class="btn ghost danger-text" data-delete>${ui.icon('trash')} Delete</button>` : '',
      onOpen(form) {
        const syncType = () => {
          const broker = form.elements.type.value === 'broker';
          form.querySelector('[data-opening]').hidden = broker;
          form.querySelector('[data-broker-note]').hidden = !broker;
        };
        form.elements.type.addEventListener('change', syncType);
        syncType();
        const del = form.querySelector('[data-delete]');
        if (del) del.addEventListener('click', async () => {
          if (S.accountInUse(acc.id)) { ui.toast('This account has entries. Archive it instead.', 'error'); return; }
          ui.closeModal();
          if (await ui.confirm(`Delete the account “${acc.name}”?`)) { S.deleteAccount(acc.id); ui.toast('Account deleted'); }
        });
      },
      onSubmit(form) {
        const f = form.elements;
        if (!f.name.value.trim()) return ui.fieldError(form, 'name', 'Give the account a name.');
        const opening = f.opening.value.trim() ? U.toCents(f.opening.value) : 0;
        if (isNaN(opening)) return ui.fieldError(form, 'opening', 'Enter a number, e.g. 1250.00');
        S.saveAccount({ id: acc && acc.id, name: f.name.value, type: f.type.value, opening, archived: f.archived ? f.archived.checked : false });
        ui.toast(editing ? 'Account saved' : 'Account added');
      },
    });
  }

  // ---------- Trade ----------
  function trade(tr, preset = {}) {
    if (!S.activeAccounts().length) { ui.toast('Add an account first.', 'error'); return; }
    const editing = !!tr;
    const brokers = S.activeAccounts().filter((a) => a.type === 'broker');
    const v = tr ? Object.assign({}, tr) : Object.assign({ side: 'buy', symbol: '', qty: '', price: '', fees: 0, date: U.today(), note: '', accountId: (brokers[0] || S.activeAccounts()[0]).id }, preset);
    const asset = S.get().assets[v.symbol] || { name: '', kind: 'stock' };
    const known = Object.keys(S.get().assets).sort();
    const accOpts = S.activeAccounts().slice().sort((a, b) => (a.type === 'broker' ? -1 : 0) - (b.type === 'broker' ? -1 : 0)).map((a) => [a.id, a.name + (a.type === 'broker' ? '' : ` (${S.ACCOUNT_TYPES[a.type]})`)]);
    ui.modal({
      title: editing ? 'Edit trade' : 'New trade',
      submitLabel: editing ? 'Save' : 'Add',
      body: `
        <div class="field">${typeSwitch('side', [['buy', 'Buy'], ['sell', 'Sell']], v.side)}</div>
        <div class="row">
          <div class="field"><label for="t-sym">Symbol / ticker</label>
            <input id="t-sym" name="symbol" list="sym-list" autocomplete="off" value="${U.esc(v.symbol)}" placeholder="e.g. VWCE, AAPL, BTC" autofocus style="text-transform:uppercase">
            <datalist id="sym-list">${known.map((s) => `<option value="${U.esc(s)}">${U.esc(S.get().assets[s].name)}</option>`).join('')}</datalist></div>
          <div class="field"><label for="t-date">Date</label><input id="t-date" name="date" type="date" value="${U.esc(v.date)}"></div>
        </div>
        <div class="row">
          <div class="field"><label for="t-name">Name</label><input id="t-name" name="name" value="${U.esc(asset.name)}" placeholder="e.g. Vanguard FTSE All-World"></div>
          <div class="field"><label for="t-kind">Asset type</label><select id="t-kind" name="kind">${ui.options(Object.entries(S.ASSET_KINDS), asset.kind)}</select></div>
        </div>
        <div class="row-3">
          <div class="field"><label for="t-qty">Quantity</label><input id="t-qty" name="qty" inputmode="decimal" value="${U.esc(v.qty)}" placeholder="0"></div>
          <div class="field"><label for="t-price">Price per unit (€)</label><input id="t-price" name="price" inputmode="decimal" value="${U.esc(v.price)}" placeholder="0.00"></div>
          <div class="field"><label for="t-fees">Fees (€)</label><input id="t-fees" name="fees" inputmode="decimal" value="${U.esc(U.centsToInput(v.fees))}"></div>
        </div>
        <div class="field"><label for="t-acc">Account</label><select id="t-acc" name="accountId">${ui.options(accOpts, v.accountId)}</select>
          <span class="hint">A broker account counts only its holdings. Any other account pays the cost from its balance (a sale adds to it).</span></div>
        <div class="field"><label for="t-note">Note</label><input id="t-note" name="note" value="${U.esc(v.note)}" placeholder="Optional"></div>
        <p class="note" data-total>Total: —</p>`,
      leftButtons: editing ? `<button type="button" class="btn ghost danger-text" data-delete>${ui.icon('trash')} Delete</button>` : '',
      onOpen(form) {
        const f = form.elements;
        const total = () => {
          const q = U.parseNum(f.qty.value), p = U.parseNum(f.price.value), fee = U.toCents(f.fees.value || '0') || 0;
          const el = form.querySelector('[data-total]');
          if (!(q > 0) || !(p >= 0)) { el.textContent = 'Total: —'; return; }
          const gross = Math.round(q * p * 100);
          el.textContent = f.side.value === 'buy' ? `Total cost: ${U.money(gross + fee)}` : `You receive: ${U.money(gross - fee)}`;
        };
        ['qty', 'price', 'fees'].forEach((n) => f[n].addEventListener('input', total));
        form.querySelectorAll('input[name="side"]').forEach((r) => r.addEventListener('change', total));
        f.symbol.addEventListener('change', () => {
          const sym = f.symbol.value.trim().toUpperCase();
          const a = S.get().assets[sym];
          if (a) { f.name.value = a.name; f.kind.value = a.kind; }
          if (!f.price.value) { const p = S.priceAt(sym, f.date.value || U.today()); if (p) f.price.value = p.price; }
        });
        total();
        const del = form.querySelector('[data-delete]');
        if (del) del.addEventListener('click', async () => {
          ui.closeModal();
          if (await ui.confirm('Delete this trade?')) { S.deleteTrade(tr.id); ui.toast('Trade deleted'); }
        });
      },
      onSubmit(form) {
        const f = form.elements;
        const symbol = f.symbol.value.trim().toUpperCase();
        if (!symbol) return ui.fieldError(form, 'symbol', 'Enter a symbol.');
        if (!U.isDate(f.date.value)) return ui.fieldError(form, 'date', 'Pick a date.');
        const qty = U.parseNum(f.qty.value);
        if (!(qty > 0)) return ui.fieldError(form, 'qty', 'Enter a quantity greater than zero.');
        const price = U.parseNum(f.price.value);
        if (!(price >= 0)) return ui.fieldError(form, 'price', 'Enter the price per unit.');
        const fees = f.fees.value.trim() ? U.toCents(f.fees.value) : 0;
        if (isNaN(fees) || fees < 0) return ui.fieldError(form, 'fees', 'Enter a valid fee.');
        if (f.side.value === 'sell') {
          const others = S.get().trades.filter((t) => t.id !== (tr && tr.id) && t.symbol === symbol && t.date <= f.date.value);
          const held = others.reduce((s, t) => s + (t.side === 'buy' ? t.qty : -t.qty), 0);
          if (qty > held + 1e-9) return ui.fieldError(form, 'qty', `You held only ${U.num(held)} ${symbol} on that date.`);
        }
        S.saveTrade({ id: tr && tr.id, created: tr && tr.created, side: f.side.value, symbol, date: f.date.value, qty, price, fees, accountId: f.accountId.value, note: f.note.value },
          { name: f.name.value.trim() || symbol, kind: f.kind.value });
        ui.toast(editing ? 'Trade saved' : 'Trade added');
      },
    });
  }

  // ---------- Prices ----------
  function prices(only) {
    const hs = S.holdings().filter((h) => h.qty > 0 && (!only || h.symbol === only));
    if (!hs.length) { ui.toast('No open holdings to price.', 'error'); return; }
    ui.modal({
      title: only ? `Update price — ${only}` : 'Update prices',
      body: `
        <div class="field"><label for="p-date">Price date</label><input id="p-date" name="date" type="date" value="${U.today()}"></div>
        ${hs.map((h, i) => `
          <div class="field"><label for="p-${i}">${U.esc(h.symbol)} <span class="muted">· ${U.esc(h.asset.name)}</span></label>
            <input id="p-${i}" name="p_${U.esc(h.symbol)}" inputmode="decimal" value="${h.price || ''}" placeholder="Price per unit (€)"${i === 0 ? ' autofocus' : ''}>
            <span class="hint">Last: ${h.priceDate ? `${U.num(h.price)} € on ${U.fmtDate(h.priceDate)}${h.priceSource === 'trade' ? ' (trade price)' : ''}` : 'none'}</span></div>`).join('')}`,
      onSubmit(form) {
        const date = form.elements.date.value;
        if (!U.isDate(date)) return ui.fieldError(form, 'date', 'Pick a date.');
        const entries = [];
        for (const h of hs) {
          const raw = form.elements['p_' + h.symbol].value.trim();
          if (!raw) continue;
          const p = U.parseNum(raw);
          if (!(p >= 0)) return ui.fieldError(form, 'p_' + h.symbol, 'Enter a valid price.');
          if (p !== h.price || date !== h.priceDate) entries.push([h.symbol, p]);
        }
        if (entries.length) S.setPrices(entries, date);
        ui.toast(entries.length ? 'Prices updated' : 'No changes');
      },
    });
  }

  return { transaction, recurring, account, trade, prices };
})();
