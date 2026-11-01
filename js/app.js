'use strict';
// App shell: navigation, hash router, PIN lock and startup.
(function () {
  const U = App.util, S = App.store, ui = App.ui;

  const NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: 'home' },
    { id: 'transactions', label: 'Transactions', icon: 'list' },
    { id: 'accounts', label: 'Accounts', icon: 'wallet' },
    { id: 'budgets', label: 'Budgets', icon: 'target' },
    { id: 'investments', label: 'Investments', icon: 'trend' },
    { id: 'recurring', label: 'Recurring', icon: 'repeat' },
    { sep: true },
    { id: 'categories', label: 'Categories', icon: 'tag' },
    { id: 'data', label: 'Import & export', icon: 'swap' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];
  const TABS = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'transactions', label: 'Activity', icon: 'list' },
    { id: 'budgets', label: 'Budgets', icon: 'target' },
    { id: 'investments', label: 'Invest', icon: 'trend' },
    { id: 'more', label: 'More', icon: 'more' },
  ];
  const MORE_ROUTES = ['more', 'accounts', 'recurring', 'categories', 'data', 'settings'];

  // "More" page for phones, listing the screens that don't fit in the tab bar.
  App.views.more = {
    render(root) {
      root.innerHTML = `<div class="page-head"><h1>More</h1></div>
        <div class="card flush">${NAV.filter((n) => n.id && !TABS.some((t) => t.id === n.id)).map((n) => `
          <a class="tx-row" href="#/${n.id}" style="grid-template-columns:36px 1fr auto"><span class="cat-icon">${ui.icon(n.icon)}</span><span class="tx-title">${n.label}</span>${ui.icon('right', 'muted')}</a>`).join('')}
        </div>`;
    },
  };

  function route() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, query] = raw.split('?');
    const params = Object.fromEntries(new URLSearchParams(query || ''));
    const name = App.views[path] ? path : 'dashboard';
    return { name, params };
  }

  let lastRoute = null;
  function render() {
    if (!unlocked) return;
    const { name, params } = route();
    const main = document.getElementById('main');
    const same = lastRoute === location.hash;
    const scroll = window.scrollY;
    App.charts.hideTip();
    main.replaceChildren();
    try {
      App.views[name].render(main, params);
    } catch (e) {
      console.error(e);
      main.innerHTML = `<div class="card"><h2>Something went wrong</h2><p class="muted">${U.esc(e.message)}</p></div>`;
    }
    if (same) window.scrollTo(0, scroll); else { window.scrollTo(0, 0); lastRoute = location.hash; }
    document.querySelectorAll('[data-route]').forEach((a) => {
      const r = a.dataset.route;
      a.classList.toggle('active', r === name || (r === 'more' && MORE_ROUTES.includes(name) && !TABS.some((t) => t.id === name)));
    });
    // Home-screen shortcut "Add transaction" opens with ?add=1.
    if (params.add) {
      history.replaceState(history.state, '', '#/' + name);
      lastRoute = location.hash;
      App.forms.transaction();
    }
    const item = NAV.find((n) => n.id === name);
    document.title = (item ? item.label + ' · ' : '') + 'Clarity';
  }
  App.render = render;

  function buildShell() {
    document.getElementById('nav').innerHTML = NAV.map((n) => n.sep ? '<div class="nav-sep"></div>' :
      `<a class="nav-item" data-route="${n.id}" href="#/${n.id}">${ui.icon(n.icon)}<span>${n.label}</span></a>`).join('');
    document.getElementById('tabbar').innerHTML = TABS.map((t) =>
      `<a data-route="${t.id}" href="#/${t.id}">${ui.icon(t.icon)}<span>${t.label}</span></a>`).join('');
    const fab = document.getElementById('fab');
    fab.innerHTML = ui.icon('plus');
    fab.addEventListener('click', () => (route().name === 'investments' ? App.forms.trade() : App.forms.transaction()));
    const lockBtn = document.getElementById('lock-now');
    lockBtn.innerHTML = `${ui.icon('lock')}<span>Lock now</span>`;
    lockBtn.addEventListener('click', lock);
  }

  // ---------- PIN lock ----------
  // The PIN only hides the screen; data in browser storage is not encrypted.
  let unlocked = false;
  async function hashPin(pin, salt) {
    const text = salt + ':' + pin;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 2166136261; // FNV-1a fallback for browsers without SubtleCrypto
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'f' + (h >>> 0).toString(16);
  }
  App.pin = {
    async set(pin) {
      const salt = U.uid();
      S.get().settings.pin = { salt, hash: await hashPin(pin, salt), len: pin.length };
      S.commit();
    },
    async check(pin) {
      const p = S.get().settings.pin;
      return !p || (await hashPin(pin, p.salt)) === p.hash;
    },
    clear() { S.get().settings.pin = null; S.commit(); },
    isSet: () => !!S.get().settings.pin,
  };

  function lock() {
    if (!App.pin.isSet()) return;
    unlocked = false;
    ui.closeModal();
    App.charts.hideTip();
    document.getElementById('shell').hidden = true;
    document.getElementById('main').replaceChildren();
    showLock();
  }

  function showLock() {
    const el = document.getElementById('lock');
    el.hidden = false;
    let entry = '', fails = 0, blockedUntil = 0;
    el.innerHTML = `
      <div class="lock-box">
        <span class="brand-mark"></span>
        <h1>Enter PIN</h1>
        <div class="lock-dots" aria-hidden="true"></div>
        <div class="lock-msg" role="alert"></div>
        <div class="keypad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-k="${n}">${n}</button>`).join('')}
          <span></span><button type="button" data-k="0">0</button><button type="button" class="text" data-k="del">Delete</button>
        </div>
      </div>`;
    const box = el.querySelector('.lock-box');
    const dots = el.querySelector('.lock-dots');
    const msg = el.querySelector('.lock-msg');
    const len = S.get().settings.pin.len || 0;
    const draw = () => { dots.innerHTML = Array.from({ length: Math.max(4, entry.length) }, (_, i) => `<span class="${i < entry.length ? 'on' : ''}"></span>`).join(''); };
    const tryUnlock = async () => {
      if (await App.pin.check(entry)) {
        unlocked = true;
        el.hidden = true;
        el.innerHTML = '';
        document.removeEventListener('keydown', onKey);
        document.getElementById('shell').hidden = false;
        touch();
        render();
      } else if (len ? entry.length >= len : entry.length >= 8) {
        fail();
      }
    };
    const fail = () => {
      fails++;
      entry = '';
      draw();
      box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
      if (fails >= 5) { blockedUntil = Date.now() + 30000; msg.textContent = 'Too many attempts. Try again in 30 seconds.'; }
      else msg.textContent = 'Wrong PIN';
    };
    const press = (k) => {
      if (Date.now() < blockedUntil) return;
      if (fails >= 5) { fails = 0; msg.textContent = ''; }
      if (k === 'del') entry = entry.slice(0, -1);
      else if (k === 'enter') { if (entry.length >= 4) { App.pin.check(entry).then((ok) => (ok ? tryUnlock() : fail())); } return; }
      else if (entry.length < 8) entry += k;
      draw();
      if (k !== 'del' && entry.length >= 4) tryUnlock();
    };
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Enter') press('enter');
    };
    el.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => press(b.dataset.k)));
    document.addEventListener('keydown', onKey);
    draw();
  }

  // Auto-lock after inactivity or after the app was in the background.
  let lastActive = Date.now(), hiddenAt = 0;
  const touch = () => { lastActive = Date.now(); };
  const lockAfter = () => (S.get().settings.lockAfterMin || 0) * 60000;
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => document.addEventListener(ev, touch, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (unlocked && App.pin.isSet() && lockAfter() && Date.now() - hiddenAt > lockAfter()) lock();
  });
  setInterval(() => { if (unlocked && App.pin.isSet() && lockAfter() && Date.now() - lastActive > lockAfter()) lock(); }, 15000);

  // ---------- Startup ----------
  function applyTheme() {
    const t = S.get().settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
  }
  App.applyTheme = applyTheme;

  function start() {
    S.load();
    applyTheme();
    buildShell();
    const added = S.processRecurring();
    S.onChange(() => {
      document.getElementById('lock-now').hidden = !App.pin.isSet();
      if (!ui.isModalOpen()) render();
      else pendingRender = true;
    });
    window.addEventListener('hashchange', render);
    let lastW = window.innerWidth;
    window.addEventListener('resize', U.debounce(() => { if (window.innerWidth !== lastW) { lastW = window.innerWidth; render(); } }, 200));
    document.addEventListener('keydown', (e) => {
      if (!unlocked || ui.isModalOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); App.forms.transaction(); }
    });
    document.getElementById('lock-now').hidden = !App.pin.isSet();
    if (App.pin.isSet()) { showLock(); }
    else { unlocked = true; document.getElementById('shell').hidden = false; render(); }
    if (added) ui.toast(`Added ${added} recurring entr${added === 1 ? 'y' : 'ies'}`);

    // On a phone the app can stay open for days; post recurring entries that fell due meanwhile.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      const n = S.processRecurring();
      if (n) ui.toast(`Added ${n} recurring entr${n === 1 ? 'y' : 'ies'}`);
    });
    // Ask the browser not to clear our storage when the phone is low on space.
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Offline support unavailable', e));
    }
  }
  // Data changes made while a dialog is open are drawn once it closes.
  let pendingRender = false;
  ui.afterClose(() => { if (pendingRender) { pendingRender = false; render(); } });

  start();
})();
