'use strict';
// UI building blocks: icons, modals, confirm dialogs, toasts, shared form controls.
App.ui = (function () {
  const U = App.util;

  // Stroke icons (24x24 grid, drawn with currentColor).
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M16 15h2"/><path d="M6 6V5a2 2 0 0 1 2-2h9"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    swap: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    left: '<path d="M15 18l-6-6 6-6"/>',
    right: '<path d="M9 18l6-6-6-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
    alert: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 10v5M12 18h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
    upload: '<path d="M12 21V9"/><path d="M7 14l5-5 5 5"/><path d="M5 3h14"/>',
  };
  const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  // ---------- Toast ----------
  function toast(msg, kind = 'info') {
    let host = document.getElementById('toasts');
    if (!host) { host = document.createElement('div'); host.id = 'toasts'; document.body.appendChild(host); }
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.innerHTML = icon(kind === 'error' ? 'alert' : 'check');
    const span = document.createElement('span'); span.textContent = msg; t.appendChild(span);
    host.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3600);
  }

  // ---------- Modal ----------
  // modal({title, body (html string), submitLabel, danger, onSubmit(form) -> false to keep open, extraButtons, wide})
  let openModal = null;
  function modal(opts) {
    closeModal('keep-history');
    // A history entry per open dialog lets the phone's back button close it.
    if (!(history.state && history.state.modal)) history.pushState({ modal: true }, '');
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <form class="modal${opts.wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title" novalidate>
        <header class="modal-head">
          <h2 id="modal-title">${U.esc(opts.title)}</h2>
          <button type="button" class="icon-btn" data-close aria-label="Close">${icon('close')}</button>
        </header>
        <div class="modal-body">${opts.body}</div>
        <footer class="modal-foot">
          <div class="modal-foot-left">${opts.leftButtons || ''}</div>
          <button type="button" class="btn ghost" data-close>${U.esc(opts.cancelLabel || 'Cancel')}</button>
          ${opts.submitLabel === null ? '' : `<button type="submit" class="btn ${opts.danger ? 'danger' : 'primary'}">${U.esc(opts.submitLabel || 'Save')}</button>`}
        </footer>
      </form>`;
    document.body.appendChild(wrap);
    document.body.classList.add('modal-open');
    const form = wrap.querySelector('form');
    const prevFocus = document.activeElement;
    openModal = { wrap, prevFocus, onClose: opts.onClose };
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) closeModal(); });
    wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
    form.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closeModal(); } });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(form);
      if (!opts.onSubmit) return closeModal();
      const keep = await opts.onSubmit(form);
      if (keep !== false) closeModal();
    });
    if (opts.onOpen) opts.onOpen(form);
    const first = form.querySelector('[autofocus]') || form.querySelector('.modal-body input, .modal-body select, .modal-body textarea');
    if (first) setTimeout(() => first.focus(), 30);
    return form;
  }
  const closeHooks = [];
  const afterClose = (fn) => closeHooks.push(fn);
  // how: 'keep-history' when another dialog replaces this one, 'popstate' when the back button closed it.
  // Click handlers pass an Event here, which counts as a normal close.
  function closeModal(how) {
    if (!openModal) return;
    const { wrap, prevFocus, onClose } = openModal;
    openModal = null;
    wrap.remove();
    document.body.classList.remove('modal-open');
    if (onClose) onClose();
    if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus();
    // Drop the dialog's history entry, unless a follow-up dialog (e.g. delete -> confirm) reuses it.
    if (how !== 'keep-history' && how !== 'popstate') {
      setTimeout(() => { if (!openModal && history.state && history.state.modal) history.back(); }, 0);
    }
    // A dialog may open another; only run hooks once none is open.
    if (!openModal) closeHooks.forEach((fn) => fn());
  }
  window.addEventListener('popstate', () => { if (openModal) closeModal('popstate'); });
  const isModalOpen = () => !!openModal;

  function confirm(message, { title = 'Are you sure?', okLabel = 'Delete', danger = true } = {}) {
    return new Promise((resolve) => {
      let answered = false;
      modal({
        title, body: `<p>${U.esc(message)}</p>`, submitLabel: okLabel, danger,
        onSubmit: () => { answered = true; resolve(true); },
        onClose: () => { if (!answered) resolve(false); },
      });
    });
  }

  // ---------- Form helpers ----------
  function fieldError(form, name, msg) {
    const input = form.elements[name];
    const field = input && (input.closest ? input.closest('.field') : null) || (input && input[0] && input[0].closest('.field'));
    if (field) {
      field.classList.add('invalid');
      const e = document.createElement('div'); e.className = 'field-error'; e.textContent = msg;
      field.appendChild(e);
    }
    if (input && input.focus) input.focus();
    return false;
  }
  function clearErrors(form) {
    form.querySelectorAll('.field.invalid').forEach((f) => f.classList.remove('invalid'));
    form.querySelectorAll('.field-error').forEach((e) => e.remove());
  }

  const options = (items, selected) => items.map(([v, l]) => `<option value="${U.esc(v)}"${v === selected ? ' selected' : ''}>${U.esc(l)}</option>`).join('');
  const accountOptions = (selected, filter) => options(App.store.activeAccounts().filter(filter || (() => true)).map((a) => [a.id, a.name]), selected);
  function categoryOptions(kind, selected) {
    return options(App.store.categoriesOf(kind).map((c) => [c.id, `${c.icon} ${c.name}`]), selected);
  }
  const catLabel = (id, type) => {
    const c = App.store.category(id);
    if (c) return { icon: c.icon, name: c.name };
    if (type === 'transfer') return { icon: '⇄', name: 'Transfer' };
    return { icon: '❔', name: 'Uncategorized' };
  };

  // Month switcher used by several views. onChange receives the new 'YYYY-MM' key.
  function monthSwitcher(key, onChange) {
    const el = U.html(`
      <div class="month-switch">
        <button type="button" class="icon-btn" data-step="-1" aria-label="Previous month">${icon('left')}</button>
        <span class="month-label">${U.monthLabel(key)}</span>
        <button type="button" class="icon-btn" data-step="1" aria-label="Next month">${icon('right')}</button>
      </div>`);
    el.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => onChange(U.addMonths(key, Number(b.dataset.step)))));
    return el;
  }

  return { icon, toast, modal, closeModal, afterClose, isModalOpen, confirm, fieldError, clearErrors, options, accountOptions, categoryOptions, catLabel, monthSwitcher };
})();
