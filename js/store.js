'use strict';
// Data layer: state shape, persistence in localStorage, mutations and derived numbers.
//
// Money is stored as integer cents. Investment quantities and unit prices are floats
// (euros per unit) because shares and crypto can be fractional.
App.store = (function () {
  const U = App.util;
  const KEY = 'clarity.v1';
  const OLD_KEYS = { 'ledger.v1': KEY, 'ledger.lastBackup': 'clarity.lastBackup' };
  const listeners = [];
  let state = null;

  const ACCOUNT_TYPES = {
    cash: 'Cash', bank: 'Bank account', card: 'Credit card', savings: 'Savings', broker: 'Investment / broker', other: 'Other',
  };
  const ASSET_KINDS = { stock: 'Stock', etf: 'ETF', fund: 'Mutual fund', bond: 'Bond', crypto: 'Crypto', other: 'Other' };

  const DEFAULT_CATEGORIES = [
    ['expense', 'Groceries', '🛒'], ['expense', 'Restaurants & cafés', '🍽️'], ['expense', 'Rent / mortgage', '🏠'],
    ['expense', 'Utilities & bills', '💡'], ['expense', 'Transport & fuel', '⛽'], ['expense', 'Shopping', '🛍️'],
    ['expense', 'Health', '💊'], ['expense', 'Entertainment', '🎬'], ['expense', 'Subscriptions', '📺'],
    ['expense', 'Travel', '✈️'], ['expense', 'Education', '📚'], ['expense', 'Gifts & donations', '🎁'],
    ['expense', 'Insurance', '🛡️'], ['expense', 'Taxes', '🧾'], ['expense', 'Fees & charges', '🏦'],
    ['expense', 'Other expenses', '📦'],
    ['income', 'Salary', '💼'], ['income', 'Freelance', '🧑‍💻'], ['income', 'Dividends', '📈'], ['income', 'Interest', '🪙'],
    ['income', 'Gifts received', '🎁'], ['income', 'Refunds', '↩️'], ['income', 'Other income', '➕'],
  ];

  function defaults() {
    return {
      version: 1,
      settings: { theme: 'auto', pin: null, lockAfterMin: 5 },
      accounts: [
        { id: U.uid(), name: 'Cash', type: 'cash', opening: 0, archived: false },
        { id: U.uid(), name: 'Bank account', type: 'bank', opening: 0, archived: false },
      ],
      categories: DEFAULT_CATEGORIES.map(([kind, name, icon]) => ({ id: U.uid(), kind, name, icon })),
      transactions: [], // {id, date, type: expense|income|transfer, amount, accountId, toAccountId, categoryId, payee, note, recurringId, created}
      budgets: {},      // categoryId -> monthly limit in cents
      recurring: [],    // {id, type, amount, accountId, toAccountId, categoryId, payee, note, freq, every, day, start, next, end, active}
      trades: [],       // {id, date, side: buy|sell, symbol, qty, price, fees, accountId, note, created}
      prices: {},       // SYMBOL -> [{date, price}] sorted by date
      assets: {},       // SYMBOL -> {name, kind}
    };
  }

  // ---------- Persistence ----------
  // Data saved before the app was renamed is moved to the new keys once.
  function moveOldKeys() {
    for (const [from, to] of Object.entries(OLD_KEYS)) {
      const v = localStorage.getItem(from);
      if (v != null && localStorage.getItem(to) == null) localStorage.setItem(to, v);
      localStorage.removeItem(from);
    }
  }
  function load() {
    try {
      moveOldKeys();
      const raw = localStorage.getItem(KEY);
      state = raw ? migrate(JSON.parse(raw)) : defaults();
    } catch (e) {
      console.error('Could not load data', e);
      state = defaults();
    }
    return state;
  }
  function migrate(s) {
    const d = defaults();
    for (const k of Object.keys(d)) if (s[k] == null) s[k] = d[k];
    s.settings = Object.assign(d.settings, s.settings);
    return s;
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      App.ui && App.ui.toast('Could not save: browser storage is full. Export a backup.', 'error');
    }
  }
  function commit() {
    save();
    listeners.forEach((fn) => fn());
  }
  function onChange(fn) { listeners.push(fn); }
  function replaceAll(data) {
    if (!data || !Array.isArray(data.transactions) || !Array.isArray(data.accounts)) throw new Error('This is not a valid backup file.');
    state = migrate(data);
    commit();
  }
  function reset() { state = defaults(); commit(); }
  function exportJSON() { return JSON.stringify(state, null, 2); }
  function bytesUsed() { try { return (localStorage.getItem(KEY) || '').length * 2; } catch (e) { return 0; } }

  // ---------- Lookups ----------
  const get = () => state;
  const account = (id) => state.accounts.find((a) => a.id === id);
  const category = (id) => state.categories.find((c) => c.id === id);
  const categoriesOf = (kind) => state.categories.filter((c) => c.kind === kind).sort((a, b) => a.name.localeCompare(b.name));
  const activeAccounts = () => state.accounts.filter((a) => !a.archived);
  const fallbackCategory = (kind) =>
    state.categories.find((c) => c.kind === kind && /^other/i.test(c.name)) || state.categories.find((c) => c.kind === kind);

  // ---------- Transactions ----------
  function cleanTx(t) {
    const tx = {
      id: t.id || U.uid(),
      date: t.date,
      type: t.type,
      amount: Math.abs(Math.round(t.amount)),
      accountId: t.accountId,
      toAccountId: t.type === 'transfer' ? t.toAccountId : null,
      categoryId: t.type === 'transfer' ? null : t.categoryId || null,
      payee: (t.payee || '').trim(),
      note: (t.note || '').trim(),
      recurringId: t.recurringId || null,
      created: t.created || Date.now(),
    };
    return tx;
  }
  function addTx(t, silent) {
    const tx = cleanTx(t);
    state.transactions.push(tx);
    if (!silent) commit();
    return tx;
  }
  function addTxs(list) { list.forEach((t) => state.transactions.push(cleanTx(t))); commit(); }
  function updateTx(id, patch) {
    const i = state.transactions.findIndex((t) => t.id === id);
    if (i < 0) return;
    state.transactions[i] = cleanTx(Object.assign({}, state.transactions[i], patch, { id }));
    commit();
  }
  function deleteTx(id) { state.transactions = state.transactions.filter((t) => t.id !== id); commit(); }
  const sortedTx = () => state.transactions.slice().sort((a, b) => (b.date === a.date ? b.created - a.created : b.date < a.date ? -1 : 1));

  // Last category used for a payee, to pre-fill the form and categorize imports.
  function guessCategory(payee, type) {
    const p = (payee || '').trim().toLowerCase();
    if (!p) return null;
    let best = null;
    for (const t of state.transactions) {
      if (t.type !== type || !t.categoryId) continue;
      const tp = t.payee.toLowerCase();
      if (tp === p) { if (!best || best.exact === false || t.date > best.date) best = { id: t.categoryId, date: t.date, exact: true }; }
      else if (!best && tp.length >= 4 && (p.includes(tp) || tp.includes(p))) best = { id: t.categoryId, date: t.date, exact: false };
    }
    return best ? best.id : null;
  }
  function payees() {
    const set = new Map();
    for (const t of state.transactions) if (t.payee) set.set(t.payee.toLowerCase(), t.payee);
    return [...set.values()].sort((a, b) => a.localeCompare(b));
  }

  // ---------- Accounts ----------
  function saveAccount(a) {
    const acc = { id: a.id || U.uid(), name: a.name.trim(), type: a.type, opening: Math.round(a.opening || 0), archived: !!a.archived };
    const i = state.accounts.findIndex((x) => x.id === acc.id);
    if (i >= 0) state.accounts[i] = acc; else state.accounts.push(acc);
    commit();
    return acc;
  }
  function accountInUse(id) {
    return state.transactions.some((t) => t.accountId === id || t.toAccountId === id) ||
      state.trades.some((t) => t.accountId === id) || state.recurring.some((r) => r.accountId === id || r.toAccountId === id);
  }
  function deleteAccount(id) {
    if (accountInUse(id)) return false;
    state.accounts = state.accounts.filter((a) => a.id !== id);
    commit();
    return true;
  }

  // ---------- Categories ----------
  function saveCategory(c) {
    const cat = { id: c.id || U.uid(), kind: c.kind, name: c.name.trim(), icon: (c.icon || '').trim() || (c.kind === 'income' ? '➕' : '📦') };
    const i = state.categories.findIndex((x) => x.id === cat.id);
    if (i >= 0) state.categories[i] = cat; else state.categories.push(cat);
    commit();
    return cat;
  }
  function categoryUsage(id) {
    return state.transactions.filter((t) => t.categoryId === id).length + state.recurring.filter((r) => r.categoryId === id).length;
  }
  function deleteCategory(id, moveTo) {
    state.transactions.forEach((t) => { if (t.categoryId === id) t.categoryId = moveTo || null; });
    state.recurring.forEach((r) => { if (r.categoryId === id) r.categoryId = moveTo || null; });
    delete state.budgets[id];
    state.categories = state.categories.filter((c) => c.id !== id);
    commit();
  }

  // ---------- Budgets ----------
  function setBudgets(map) {
    state.budgets = {};
    for (const [k, v] of Object.entries(map)) if (v > 0) state.budgets[k] = Math.round(v);
    commit();
  }

  // ---------- Recurring ----------
  function nextOccurrence(r, from) {
    const d = U.parseDate(from);
    const every = Math.max(1, r.every || 1);
    if (r.freq === 'weekly') { d.setDate(d.getDate() + 7 * every); return U.ymd(d); }
    if (r.freq === 'daily') { d.setDate(d.getDate() + every); return U.ymd(d); }
    let y = d.getFullYear(), m = d.getMonth() + 1;
    if (r.freq === 'yearly') y += every;
    else { m += every; while (m > 12) { m -= 12; y++; } }
    const day = Math.min(r.day || d.getDate(), U.daysInMonth(y, m));
    return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  function saveRecurring(r) {
    const existing = state.recurring.find((x) => x.id === r.id);
    const rule = {
      id: r.id || U.uid(), type: r.type, amount: Math.abs(Math.round(r.amount)), accountId: r.accountId,
      toAccountId: r.type === 'transfer' ? r.toAccountId : null, categoryId: r.type === 'transfer' ? null : r.categoryId,
      payee: (r.payee || '').trim(), note: (r.note || '').trim(), freq: r.freq, every: Math.max(1, Number(r.every) || 1),
      day: Number(r.start.slice(8, 10)), start: r.start, end: r.end || null, active: r.active !== false,
      next: r.start,
    };
    // Keep the schedule position when editing a rule that already produced entries, unless its start moved later.
    if (existing && existing.start === rule.start) rule.next = existing.next;
    const i = state.recurring.findIndex((x) => x.id === rule.id);
    if (i >= 0) state.recurring[i] = rule; else state.recurring.push(rule);
    processRecurring(true);
    commit();
    return rule;
  }
  function deleteRecurring(id) { state.recurring = state.recurring.filter((r) => r.id !== id); commit(); }
  function toggleRecurring(id) {
    const r = state.recurring.find((x) => x.id === id);
    if (!r) return;
    r.active = !r.active;
    if (r.active) {
      // Resuming skips the dates missed while paused.
      const today = U.today();
      let guard = 0;
      while (r.next < today && guard++ < 5000) r.next = nextOccurrence(r, r.next);
      processRecurring(true);
    }
    commit();
  }
  // Post every due occurrence up to today. Returns how many entries were added.
  function processRecurring(silent) {
    const today = U.today();
    let added = 0;
    for (const r of state.recurring) {
      if (!r.active) continue;
      let guard = 0;
      while (r.next <= today && (!r.end || r.next <= r.end) && guard++ < 1000) {
        addTx({ date: r.next, type: r.type, amount: r.amount, accountId: r.accountId, toAccountId: r.toAccountId,
          categoryId: r.categoryId, payee: r.payee, note: r.note, recurringId: r.id }, true);
        added++;
        r.next = nextOccurrence(r, r.next);
      }
    }
    if (added && !silent) commit();
    return added;
  }

  // ---------- Investments ----------
  function cleanTrade(t) {
    return {
      id: t.id || U.uid(), date: t.date, side: t.side, symbol: t.symbol.trim().toUpperCase(),
      qty: Math.abs(Number(t.qty)), price: Math.abs(Number(t.price)), fees: Math.abs(Math.round(t.fees || 0)),
      accountId: t.accountId, note: (t.note || '').trim(), created: t.created || Date.now(),
    };
  }
  function saveTrade(t, asset) {
    const tr = cleanTrade(t);
    const i = state.trades.findIndex((x) => x.id === tr.id);
    if (i >= 0) state.trades[i] = tr; else state.trades.push(tr);
    if (asset) state.assets[tr.symbol] = { name: asset.name || tr.symbol, kind: asset.kind || 'stock' };
    commit();
    return tr;
  }
  function deleteTrade(id) { state.trades = state.trades.filter((t) => t.id !== id); commit(); }
  // Cash moved by a trade, seen from its account: buys spend, sells bring money in.
  const tradeCash = (t) => {
    const gross = Math.round(t.qty * t.price * 100);
    return t.side === 'buy' ? -(gross + t.fees) : gross - t.fees;
  };
  function setPrices(entries, date) {
    for (const [sym, price] of entries) {
      const list = (state.prices[sym] = state.prices[sym] || []);
      const i = list.findIndex((p) => p.date === date);
      if (i >= 0) list[i].price = price; else list.push({ date, price });
      list.sort((a, b) => (a.date < b.date ? -1 : 1));
    }
    commit();
  }
  function saveAsset(sym, asset) { state.assets[sym] = asset; commit(); }
  const sortedTrades = () => state.trades.slice().sort((a, b) => (a.date === b.date ? a.created - b.created : a.date < b.date ? -1 : 1));

  // Latest known price on or before `date`: a manual price, or else the last trade price.
  function priceAt(sym, date) {
    let best = null;
    for (const p of state.prices[sym] || []) if (p.date <= date) best = { price: p.price, date: p.date, source: 'manual' };
    for (const t of state.trades) {
      if (t.symbol === sym && t.date <= date && (!best || t.date > best.date)) best = { price: t.price, date: t.date, source: 'trade' };
    }
    return best;
  }

  // Average-cost holdings as of `date`, optionally for one account. cost and realized are in cents (float until displayed).
  function holdings(date = U.today(), accountId) {
    const map = new Map();
    for (const t of sortedTrades()) {
      if (t.date > date) break;
      if (accountId && t.accountId !== accountId) continue;
      const h = map.get(t.symbol) || { symbol: t.symbol, qty: 0, cost: 0, realized: 0, fees: 0, invested: 0 };
      if (t.side === 'buy') {
        h.qty += t.qty;
        h.cost += t.qty * t.price * 100 + t.fees;
        h.invested += t.qty * t.price * 100 + t.fees;
      } else {
        const q = Math.min(t.qty, h.qty);
        const avg = h.qty > 0 ? h.cost / h.qty : 0;
        h.realized += q * t.price * 100 - t.fees - avg * q;
        h.cost -= avg * q;
        h.qty -= q;
        if (h.qty < 1e-9) { h.qty = 0; h.cost = 0; }
      }
      h.fees += t.fees;
      map.set(t.symbol, h);
    }
    const out = [];
    for (const h of map.values()) {
      const p = priceAt(h.symbol, date);
      h.price = p ? p.price : 0;
      h.priceDate = p ? p.date : null;
      h.priceSource = p ? p.source : null;
      h.value = h.qty * h.price * 100;
      h.unrealized = h.qty > 0 ? h.value - h.cost : 0;
      h.avgCost = h.qty > 0 ? h.cost / h.qty / 100 : 0;
      h.asset = state.assets[h.symbol] || { name: h.symbol, kind: 'other' };
      out.push(h);
    }
    return out;
  }
  function portfolio(date, accountId) {
    const hs = holdings(date, accountId);
    const sum = (k) => hs.reduce((s, h) => s + h[k], 0);
    return { holdings: hs, value: sum('value'), cost: sum('cost'), unrealized: sum('unrealized'), realized: sum('realized') };
  }

  // ---------- Balances & statistics ----------
  // Cash balance of every account at the end of `date` (inclusive).
  function balances(date = '9999-12-31') {
    const b = {};
    for (const a of state.accounts) b[a.id] = a.opening || 0;
    for (const t of state.transactions) {
      if (t.date > date) continue;
      if (t.type === 'income') b[t.accountId] = (b[t.accountId] || 0) + t.amount;
      else if (t.type === 'expense') b[t.accountId] = (b[t.accountId] || 0) - t.amount;
      else if (t.type === 'transfer') {
        b[t.accountId] = (b[t.accountId] || 0) - t.amount;
        b[t.toAccountId] = (b[t.toAccountId] || 0) + t.amount;
      }
    }
    for (const t of state.trades) if (t.date <= date) b[t.accountId] = (b[t.accountId] || 0) + tradeCash(t);
    return b;
  }
  function netWorth(date = U.today()) {
    const b = balances(date);
    const cash = Object.values(b).reduce((s, v) => s + v, 0);
    const invest = portfolio(date).value;
    return { cash, invest, total: cash + invest };
  }
  function monthStats(key) {
    const s = { income: 0, expense: 0, byCategory: {}, count: 0 };
    for (const t of state.transactions) {
      if (t.date.slice(0, 7) !== key || t.type === 'transfer') continue;
      s[t.type] += t.amount;
      s.count++;
      const c = t.categoryId || '_none_' + t.type;
      s.byCategory[c] = (s.byCategory[c] || 0) + t.amount;
    }
    return s;
  }
  function firstMonth() {
    let min = U.thisMonth();
    for (const t of state.transactions) if (t.date.slice(0, 7) < min) min = t.date.slice(0, 7);
    for (const t of state.trades) if (t.date.slice(0, 7) < min) min = t.date.slice(0, 7);
    return min;
  }

  return {
    ACCOUNT_TYPES, ASSET_KINDS, load, save, onChange, replaceAll, reset, exportJSON, bytesUsed, get, commit,
    account, category, categoriesOf, activeAccounts, fallbackCategory,
    addTx, addTxs, updateTx, deleteTx, sortedTx, guessCategory, payees,
    saveAccount, deleteAccount, accountInUse,
    saveCategory, deleteCategory, categoryUsage,
    setBudgets,
    saveRecurring, deleteRecurring, toggleRecurring, processRecurring, nextOccurrence,
    saveTrade, deleteTrade, tradeCash, setPrices, saveAsset, sortedTrades, priceAt, holdings, portfolio,
    balances, netWorth, monthStats, firstMonth,
  };
})();
