'use strict';
// Demo data: about a year of realistic activity, for trying the app out.
App.demo = (function () {
  const U = App.util, S = App.store, ui = App.ui;

  function seeded(seed) {
    return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  }

  async function load() {
    const st = S.get();
    if (st.transactions.length || st.trades.length) {
      const ok = await ui.confirm('Loading demo data replaces everything currently stored. Continue?', { title: 'Replace with demo data?', okLabel: 'Load demo data' });
      if (!ok) return;
    }
    const keep = st.settings;
    S.reset();
    const s = S.get();
    s.settings = keep;
    const rnd = seeded(42);
    const between = (a, b) => Math.round((a + rnd() * (b - a)) * 100);
    const cat = (name) => s.categories.find((c) => c.name === name).id;

    const [cash, bank] = s.accounts;
    cash.opening = 15000; bank.opening = 320000; bank.name = 'Main bank account';
    const card = { id: U.uid(), name: 'Credit card', type: 'card', opening: 0, archived: false };
    const broker = { id: U.uid(), name: 'Broker', type: 'broker', opening: 0, archived: false };
    s.accounts.push(card, broker);

    const start = U.addMonths(U.thisMonth(), -11);
    const rule = (o) => s.recurring.push(Object.assign({ id: U.uid(), toAccountId: null, note: '', freq: 'monthly', every: 1, end: null, active: true }, o, { day: Number(o.start.slice(8)), next: o.start }));
    rule({ type: 'income', amount: 210000, accountId: bank.id, categoryId: cat('Salary'), payee: 'Employer SA', start: `${start}-01` });
    rule({ type: 'expense', amount: 65000, accountId: bank.id, categoryId: cat('Rent / mortgage'), payee: 'Landlord', start: `${start}-03` });
    rule({ type: 'expense', amount: 3000, accountId: bank.id, categoryId: cat('Utilities & bills'), payee: 'Internet provider', start: `${start}-10` });
    rule({ type: 'expense', amount: 1399, accountId: card.id, categoryId: cat('Subscriptions'), payee: 'Netflix', start: `${start}-14` });
    rule({ type: 'expense', amount: 4000, accountId: bank.id, categoryId: cat('Health'), payee: 'Gym membership', start: `${start}-05` });
    rule({ type: 'transfer', amount: 40000, accountId: bank.id, toAccountId: broker.id, categoryId: null, payee: 'Monthly investing', start: `${start}-06` });

    const today = U.today();
    const add = (o) => { if (o.date <= today) S.addTx(o, true); };
    for (let i = 0; i < 12; i++) {
      const m = U.addMonths(start, i);
      const [y, mm] = m.split('-').map(Number);
      const dim = U.daysInMonth(y, mm);
      const day = (d) => `${m}-${String(Math.min(dim, d)).padStart(2, '0')}`;
      for (let w = 0; w < 4; w++) add({ date: day(2 + w * 7 + Math.floor(rnd() * 3)), type: 'expense', amount: between(45, 95), accountId: rnd() > 0.3 ? card.id : bank.id, categoryId: cat('Groceries'), payee: rnd() > 0.5 ? 'Sklavenitis' : 'AB Vassilopoulos' });
      for (let k = 0; k < 4 + Math.floor(rnd() * 3); k++) add({ date: day(1 + Math.floor(rnd() * dim)), type: 'expense', amount: between(8, 45), accountId: rnd() > 0.5 ? cash.id : card.id, categoryId: cat('Restaurants & cafés'), payee: ['Coffee Island', 'Taverna', 'Souvlaki place', 'Sushi bar'][Math.floor(rnd() * 4)] });
      for (let k = 0; k < 2; k++) add({ date: day(8 + k * 12), type: 'expense', amount: between(45, 70), accountId: card.id, categoryId: cat('Transport & fuel'), payee: 'Shell' });
      add({ date: day(20), type: 'expense', amount: between(55, 95), accountId: bank.id, categoryId: cat('Utilities & bills'), payee: 'Electricity' });
      if (rnd() > 0.35) add({ date: day(12 + Math.floor(rnd() * 10)), type: 'expense', amount: between(25, 180), accountId: card.id, categoryId: cat('Shopping'), payee: ['Zara', 'IKEA', 'Public', 'Amazon'][Math.floor(rnd() * 4)] });
      if (rnd() > 0.5) add({ date: day(16 + Math.floor(rnd() * 8)), type: 'expense', amount: between(10, 40), accountId: cash.id, categoryId: cat('Entertainment'), payee: 'Cinema' });
      if (rnd() > 0.75) add({ date: day(7), type: 'income', amount: between(150, 450), accountId: bank.id, categoryId: cat('Freelance'), payee: 'Side project client' });
      add({ date: day(25), type: 'transfer', amount: between(480, 600) + (i === 7 ? 68000 : 0), accountId: bank.id, toAccountId: card.id, payee: 'Card payment' });
      if (i === 6) add({ date: day(15), type: 'expense', amount: 68000, accountId: card.id, categoryId: cat('Travel'), payee: 'Summer holiday' });
      add({ date: day(4), type: 'transfer', amount: 10000, accountId: bank.id, toAccountId: cash.id, payee: 'ATM withdrawal' });

      // Investments: monthly ETF purchase, occasional stock trades, month-end prices.
      const vwce = 104 + i * 1.6 + (rnd() - 0.5) * 4;
      const aapl = 190 + i * 2.5 + (rnd() - 0.5) * 12;
      const tradeDay = day(7);
      if (tradeDay <= today) {
        s.trades.push({ id: U.uid(), date: tradeDay, side: 'buy', symbol: 'VWCE', qty: 3, price: Math.round(vwce * 100) / 100, fees: 100, accountId: broker.id, note: '', created: Date.now() + i });
        if (i === 1 || i === 5) s.trades.push({ id: U.uid(), date: tradeDay, side: 'buy', symbol: 'AAPL', qty: 2, price: Math.round(aapl * 100) / 100, fees: 200, accountId: broker.id, note: '', created: Date.now() + 100 + i });
        if (i === 9) s.trades.push({ id: U.uid(), date: day(18), side: 'sell', symbol: 'AAPL', qty: 1, price: Math.round(aapl * 100) / 100, fees: 200, accountId: broker.id, note: 'Took some profit', created: Date.now() + 200 });
      }
      const end = m === U.thisMonth() ? today : U.endOfMonth(m);
      for (const [sym, p] of [['VWCE', vwce + 0.8], ['AAPL', aapl + 3]]) (s.prices[sym] = s.prices[sym] || []).push({ date: end, price: Math.round(p * 100) / 100 });
    }
    s.assets = { VWCE: { name: 'Vanguard FTSE All-World UCITS ETF', kind: 'etf' }, AAPL: { name: 'Apple Inc.', kind: 'stock' } };
    s.budgets = { [cat('Groceries')]: 35000, [cat('Restaurants & cafés')]: 15000, [cat('Transport & fuel')]: 13000, [cat('Shopping')]: 15000, [cat('Entertainment')]: 5000 };
    S.processRecurring(true);
    S.commit();
    ui.toast('Demo data loaded');
    location.hash = '#/dashboard';
  }

  return { load };
})();
