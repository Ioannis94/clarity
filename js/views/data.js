'use strict';
App.views = App.views || {};

App.views.data = (function () {
  const U = App.util, S = App.store, ui = App.ui;

  // ---------- Export ----------
  // On a phone this opens the share sheet (Google Drive, Gmail…); elsewhere it downloads the file.
  async function exportBackup() {
    const name = `clarity-backup-${U.today()}.json`;
    const json = S.exportJSON();
    const done = (msg) => { localStorage.setItem('clarity.lastBackup', U.today()); ui.toast(msg); App.render(); };
    if (navigator.canShare) {
      for (const type of ['application/json', 'text/plain']) {
        const file = new File([json], name, { type });
        if (!navigator.canShare({ files: [file] })) continue;
        try {
          await navigator.share({ files: [file], title: 'Clarity backup' });
          return done('Backup saved');
        } catch (e) {
          if (e.name === 'AbortError') return; // share sheet dismissed
          break; // sharing failed: fall back to a download
        }
      }
    }
    U.download(name, json, 'application/json');
    done('Backup downloaded');
  }
  // Days since the last backup, or null if there has never been one.
  function daysSinceBackup() {
    const last = localStorage.getItem('clarity.lastBackup');
    return last ? Math.round((U.parseDate(U.today()) - U.parseDate(last)) / 864e5) : null;
  }
  function exportTransactions() {
    const rows = [['Date', 'Type', 'Amount', 'Account', 'To account', 'Category', 'Payee', 'Note']];
    for (const t of S.sortedTx().reverse()) {
      const c = S.category(t.categoryId);
      rows.push([t.date, t.type, (t.type === 'expense' ? -t.amount : t.amount) / 100, (S.account(t.accountId) || {}).name || '',
        (S.account(t.toAccountId) || {}).name || '', c ? c.name : '', t.payee, t.note]);
    }
    U.download(`clarity-transactions-${U.today()}.csv`, '﻿' + U.csvStringify(rows), 'text/csv');
  }
  function exportTrades() {
    const rows = [['Date', 'Side', 'Symbol', 'Name', 'Quantity', 'Price', 'Fees', 'Total', 'Account', 'Note']];
    for (const t of S.sortedTrades()) {
      rows.push([t.date, t.side, t.symbol, (S.get().assets[t.symbol] || {}).name || '', t.qty, t.price, t.fees / 100, S.tradeCash(t) / 100,
        (S.account(t.accountId) || {}).name || '', t.note]);
    }
    U.download(`clarity-trades-${U.today()}.csv`, '﻿' + U.csvStringify(rows), 'text/csv');
  }

  async function restore(file) {
    let data;
    try { data = JSON.parse(await U.readFile(file)); } catch (e) { ui.toast('That file is not a valid backup.', 'error'); return; }
    if (!data || !Array.isArray(data.transactions) || !Array.isArray(data.accounts)) { ui.toast('That file is not a Clarity backup.', 'error'); return; }
    const ok = await ui.confirm(`Replace all current data with this backup (${data.transactions.length} transactions, ${data.accounts.length} accounts)? Your current data will be lost unless you export it first.`,
      { title: 'Restore backup?', okLabel: 'Replace my data' });
    if (!ok) return;
    S.replaceAll(data);
    App.applyTheme();
    ui.toast('Backup restored');
  }

  // ---------- CSV import ----------
  const findCol = (headers, patterns) => headers.findIndex((h) => patterns.some((p) => p.test(h)));
  function guessDateFormat(values) {
    for (const fmt of ['DMY', 'YMD', 'MDY']) if (values.length && values.every((v) => U.parseDateFmt(v, fmt))) return fmt;
    return 'DMY';
  }

  function importCSV(text, filename) {
    const delim = U.detectDelimiter(text);
    const rows = U.csvParse(text, delim);
    if (rows.length < 1) { ui.toast('The file is empty.', 'error'); return; }
    const width = Math.max(...rows.map((r) => r.length));
    const firstIsHeader = rows[0].some((c) => /[a-zα-ω]/i.test(c)) && !rows[0].some((c) => U.parseDateFmt(c, 'DMY') || U.parseDateFmt(c, 'YMD'));
    const headers = firstIsHeader ? rows[0].map((h, i) => h.trim() || `Column ${i + 1}`) : Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
    const lc = headers.map((h) => h.toLowerCase());
    const m = {
      header: firstIsHeader,
      date: Math.max(0, findCol(lc, [/date|ημερομ|datum|fecha/])),
      payee: findCol(lc, [/payee|descr|details|περιγρ|αιτιολ|merchant|name|text|memo|reference/]),
      amount: findCol(lc, [/^amount|ποσό|ποσο|betrag|importe|value/]),
      debit: findCol(lc, [/debit|χρέωσ|χρεωσ|withdraw|out/]),
      credit: findCol(lc, [/credit|πίστωσ|πιστωσ|deposit|in$/]),
      decimal: 'auto', sign: 'negExpense', accountId: (S.activeAccounts().find((a) => a.type === 'bank') || S.activeAccounts()[0] || {}).id,
    };
    m.mode = m.amount < 0 && m.debit >= 0 && m.credit >= 0 ? 'split' : 'single';
    if (m.amount < 0) m.amount = m.debit >= 0 ? m.debit : Math.min(width - 1, 1);
    if (m.payee < 0) m.payee = width > 1 ? 1 : 0;
    const body = () => rows.slice(m.header ? 1 : 0);
    m.dateFmt = guessDateFormat(body().slice(0, 20).map((r) => r[m.date]).filter(Boolean));

    const colOpts = (sel, allowNone) => (allowNone ? '<option value="-1">— none —</option>' : '') + headers.map((h, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>${U.esc(h)}</option>`).join('');
    let parsed = [];

    function parse() {
      const existing = new Set(S.get().transactions.filter((t) => t.accountId === m.accountId).map((t) => `${t.date}|${t.type}|${t.amount}`));
      const seen = new Map();
      parsed = body().map((r) => {
        const date = U.parseDateFmt(r[m.date], m.dateFmt);
        let cents;
        if (m.mode === 'split') {
          const d = U.toCents(r[m.debit] || '', m.decimal === 'auto' ? undefined : m.decimal);
          const c = U.toCents(r[m.credit] || '', m.decimal === 'auto' ? undefined : m.decimal);
          cents = (isNaN(c) ? 0 : Math.abs(c)) - (isNaN(d) ? 0 : Math.abs(d));
          if (isNaN(d) && isNaN(c)) cents = NaN;
        } else {
          cents = U.toCents(r[m.amount] || '', m.decimal === 'auto' ? undefined : m.decimal);
          if (m.sign === 'posExpense') cents = -cents;
        }
        const payee = String(r[m.payee] || '').trim().replace(/\s+/g, ' ');
        const ok = !!date && !isNaN(cents) && cents !== 0;
        const type = cents < 0 ? 'expense' : 'income';
        const amount = Math.abs(cents);
        const key = `${date}|${type}|${amount}`;
        // Identical rows inside the file are kept; only matches beyond what already exists count as duplicates.
        const n = (seen.get(key) || 0) + 1; seen.set(key, n);
        const dup = ok && existing.has(key) && n === 1;
        const categoryId = ok ? S.guessCategory(payee, type) || (S.fallbackCategory(type) || {}).id : null;
        return { ok, dup, include: ok && !dup, date, payee, type, amount, categoryId };
      });
    }

    function drawPreview(form) {
      parse();
      const valid = parsed.filter((p) => p.ok);
      const dups = parsed.filter((p) => p.dup).length;
      const bad = parsed.length - valid.length;
      form.querySelector('[data-summary]').innerHTML =
        `<strong>${valid.length}</strong> rows ready · ${dups} likely duplicate${dups === 1 ? '' : 's'} (unticked) · ${bad} skipped (no valid date or amount)`;
      const shown = parsed.slice(0, 400);
      form.querySelector('[data-preview]').innerHTML = `<table class="table compact preview-table">
        <thead><tr><th></th><th>Date</th><th>Description</th><th class="num">Amount</th><th>Category</th></tr></thead>
        <tbody>${shown.map((p, i) => p.ok ? `<tr>
          <td><input type="checkbox" data-inc="${i}"${p.include ? ' checked' : ''} aria-label="Import row ${i + 1}"></td>
          <td class="${p.dup ? 'dup' : ''}" style="white-space:nowrap">${U.fmtDate(p.date)}</td>
          <td class="${p.dup ? 'dup' : ''}"><span class="truncate" style="display:block;max-width:280px">${U.esc(p.payee)}</span>${p.dup ? '<span class="badge">duplicate?</span>' : ''}</td>
          <td class="num ${p.type === 'income' ? 'pos' : ''}">${U.signed(p.type === 'income' ? p.amount : -p.amount)}</td>
          <td><select data-cat="${i}" aria-label="Category">${ui.categoryOptions(p.type, p.categoryId)}</select></td>
        </tr>` : `<tr><td></td><td colspan="4" class="muted small">Skipped: ${U.esc(body()[i].join(' | ').slice(0, 120))}</td></tr>`).join('')}</tbody></table>
        ${parsed.length > shown.length ? `<p class="small muted">Showing the first ${shown.length} of ${parsed.length} rows. The rest will be imported with suggested categories.</p>` : ''}`;
      form.querySelectorAll('[data-inc]').forEach((c) => c.addEventListener('change', () => { parsed[c.dataset.inc].include = c.checked; }));
      form.querySelectorAll('[data-cat]').forEach((s) => s.addEventListener('change', () => { parsed[s.dataset.cat].categoryId = s.value; }));
      form.querySelectorAll('[data-single]').forEach((el) => { el.hidden = m.mode !== 'single'; });
      form.querySelectorAll('[data-split]').forEach((el) => { el.hidden = m.mode !== 'split'; });
    }

    ui.modal({
      title: `Import ${filename || 'CSV'}`,
      wide: true,
      submitLabel: 'Import',
      body: `
        <div class="map-grid">
          <div class="field"><label>Import into account</label><select name="accountId">${ui.accountOptions(m.accountId)}</select></div>
          <div class="field"><label>Date column</label><select name="date">${colOpts(m.date)}</select></div>
          <div class="field"><label>Date format</label><select name="dateFmt">${ui.options([['DMY', 'Day/Month/Year'], ['YMD', 'Year-Month-Day'], ['MDY', 'Month/Day/Year']], m.dateFmt)}</select></div>
          <div class="field"><label>Description column</label><select name="payee">${colOpts(m.payee)}</select></div>
          <div class="field"><label>Amounts are in</label><select name="mode">${ui.options([['single', 'One column (+/−)'], ['split', 'Separate debit & credit']], m.mode)}</select></div>
          <div class="field" data-single><label>Amount column</label><select name="amount">${colOpts(m.amount)}</select></div>
          <div class="field" data-single><label>Expenses are</label><select name="sign">${ui.options([['negExpense', 'Negative numbers'], ['posExpense', 'Positive numbers']], m.sign)}</select></div>
          <div class="field" data-split><label>Debit (money out)</label><select name="debit">${colOpts(m.debit, true)}</select></div>
          <div class="field" data-split><label>Credit (money in)</label><select name="credit">${colOpts(m.credit, true)}</select></div>
          <div class="field"><label>Decimal separator</label><select name="decimal">${ui.options([['auto', 'Detect'], [',', 'Comma (1.234,56)'], ['.', 'Dot (1,234.56)']], m.decimal)}</select></div>
          <div class="field" style="justify-content:flex-end"><label class="check"><input type="checkbox" name="header"${m.header ? ' checked' : ''}> First row is a header</label></div>
        </div>
        <p class="note" data-summary></p>
        <div data-preview style="overflow-x:auto"></div>`,
      onOpen(form) {
        form.addEventListener('change', (e) => {
          const n = e.target.name;
          if (!n || !(n in m)) return;
          m[n] = e.target.type === 'checkbox' ? e.target.checked : /^(date|payee|amount|debit|credit)$/.test(n) ? Number(e.target.value) : e.target.value;
          if (n === 'date' || n === 'header') m.dateFmt = form.elements.dateFmt.value = guessDateFormat(body().slice(0, 20).map((r) => r[m.date]).filter(Boolean));
          drawPreview(form);
        });
        drawPreview(form);
      },
      onSubmit() {
        const list = parsed.filter((p) => p.ok && p.include);
        if (!list.length) { ui.toast('Nothing selected to import.', 'error'); return false; }
        S.addTxs(list.map((p) => ({ date: p.date, type: p.type, amount: p.amount, accountId: m.accountId, categoryId: p.categoryId, payee: p.payee, note: '' })));
        ui.toast(`Imported ${list.length} transaction${list.length === 1 ? '' : 's'}`);
      },
    });
  }

  async function handleFile(file) {
    if (!file) return;
    if (!S.activeAccounts().length) { ui.toast('Create an account first.', 'error'); return; }
    const text = await U.readFile(file);
    importCSV(text, file.name);
  }

  function eraseAll() {
    ui.modal({
      title: 'Erase all data?',
      danger: true, submitLabel: 'Erase everything',
      body: `<p>This permanently removes every account, transaction, budget, recurring entry and trade from this browser. Export a backup first if you might need it.</p>
        <div class="field"><label for="erase">Type <strong>ERASE</strong> to confirm</label><input id="erase" name="confirm" autocomplete="off"></div>`,
      onSubmit(form) {
        if (form.elements.confirm.value.trim() !== 'ERASE') return ui.fieldError(form, 'confirm', 'Type ERASE in capitals.');
        S.reset();
        App.applyTheme();
        ui.toast('All data erased');
        location.hash = '#/dashboard';
      },
    });
  }

  function render(root) {
    const st = S.get();
    const last = localStorage.getItem('clarity.lastBackup');
    root.innerHTML = `
      <div class="page-head"><h1>Import & export</h1></div>
      <div class="grid grid-2">
        <div class="card">
          <div class="card-head"><h2>Import bank statement</h2></div>
          <p class="secondary small">Most banks let you download transactions as CSV (Excel files can be saved as CSV). You'll choose which columns hold the date, description and amount, then review before anything is added.</p>
          <label class="dropzone" data-drop>
            <input type="file" accept=".csv,.txt,text/csv" data-csv hidden>
            ${ui.icon('upload')}<div><strong>Choose a CSV file</strong> or drop it here</div>
          </label>
        </div>
        <div class="card">
          <div class="card-head"><h2>Backup</h2></div>
          <p class="secondary small">Your data lives only on this phone. If the phone is lost, reset or the app is uninstalled, the backup is your only copy, so save one to Google Drive or email regularly. It is also how you move to a new phone.</p>
          <p class="small ${last ? 'muted' : 'neg'}">${last ? `Last backup: ${U.fmtDate(last)}` : 'No backup saved yet.'}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn primary" data-backup>${ui.icon('download')} Save backup</button>
            <label class="btn">${ui.icon('upload')} Restore backup<input type="file" accept=".json,application/json" data-restore hidden></label>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Export to spreadsheet</h2></div>
          <p class="secondary small">CSV files open in Excel, Numbers or Google Sheets.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" data-exp-tx ${st.transactions.length ? '' : 'disabled'}>${ui.icon('download')} Transactions (${st.transactions.length})</button>
            <button class="btn" data-exp-tr ${st.trades.length ? '' : 'disabled'}>${ui.icon('download')} Trades (${st.trades.length})</button>
          </div>
        </div>
        <div class="card danger-zone">
          <div class="card-head"><h2>Erase data</h2></div>
          <p class="secondary small">Remove everything stored in this browser and start fresh. Using ${(S.bytesUsed() / 1024).toFixed(0)} KB of storage.</p>
          <button class="btn danger-text" data-erase>${ui.icon('trash')} Erase all data</button>
        </div>
      </div>`;

    root.querySelector('[data-backup]').addEventListener('click', exportBackup);
    root.querySelector('[data-exp-tx]').addEventListener('click', exportTransactions);
    root.querySelector('[data-exp-tr]').addEventListener('click', exportTrades);
    root.querySelector('[data-erase]').addEventListener('click', eraseAll);
    root.querySelector('[data-restore]').addEventListener('change', (e) => { restore(e.target.files[0]); e.target.value = ''; });
    root.querySelector('[data-csv]').addEventListener('change', (e) => { handleFile(e.target.files[0]); e.target.value = ''; });
    const drop = root.querySelector('[data-drop]');
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('drag'); handleFile(e.dataTransfer.files[0]); });
  }

  return { render, exportBackup, daysSinceBackup };
})();
