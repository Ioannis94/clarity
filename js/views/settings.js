'use strict';
App.views = App.views || {};

App.views.settings = (function () {
  const U = App.util, S = App.store, ui = App.ui;
  const pinField = (name, label, autofocus) => `<div class="field"><label for="pin-${name}">${label}</label>
    <input id="pin-${name}" name="${name}" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off"${autofocus ? ' autofocus' : ''}></div>`;

  function pinDialog(mode) {
    const needCurrent = mode !== 'set';
    ui.modal({
      title: mode === 'set' ? 'Set a PIN' : mode === 'change' ? 'Change PIN' : 'Remove PIN',
      submitLabel: mode === 'remove' ? 'Remove PIN' : 'Save PIN',
      danger: mode === 'remove',
      body: (needCurrent ? pinField('current', 'Current PIN', true) : '') +
        (mode !== 'remove' ? pinField('pin', 'New PIN (4–8 digits)', !needCurrent) + pinField('confirm', 'Repeat new PIN') : '') +
        (mode === 'set' ? `<p class="note">The PIN hides the app when it opens and after inactivity. It does not encrypt your data. If you forget it, the only way back in is to clear this site's data in your browser and restore a backup, so keep your backups up to date.</p>` : ''),
      async onSubmit(form) {
        const f = form.elements;
        if (needCurrent && !(await App.pin.check(f.current.value))) return ui.fieldError(form, 'current', 'That PIN is not correct.');
        if (mode === 'remove') { App.pin.clear(); ui.toast('PIN removed'); return; }
        if (!/^\d{4,8}$/.test(f.pin.value)) return ui.fieldError(form, 'pin', 'Use 4 to 8 digits.');
        if (f.pin.value !== f.confirm.value) return ui.fieldError(form, 'confirm', 'The PINs do not match.');
        await App.pin.set(f.pin.value);
        ui.toast('PIN saved');
      },
    });
  }

  function render(root) {
    const st = S.get().settings;
    const hasPin = App.pin.isSet();
    root.innerHTML = `
      <div class="page-head"><h1>Settings</h1></div>
      <div class="grid grid-2">
        <div class="card">
          <div class="card-head"><h2>Appearance</h2></div>
          <div class="field"><span class="field-label">Theme</span>
            <div class="segmented" role="radiogroup" aria-label="Theme">
              ${[['auto', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<label><input type="radio" name="theme" value="${v}"${st.theme === v ? ' checked' : ''}><span>${l}</span></label>`).join('')}
            </div></div>
        </div>
        <div class="card">
          <div class="card-head"><h2>PIN lock</h2><span class="badge">${hasPin ? `${ui.icon('lock')} On` : 'Off'}</span></div>
          <p class="secondary small">Ask for a PIN when the app opens${hasPin ? '' : ' (useful on a shared computer)'}.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
            ${hasPin ? `<button class="btn" data-pin="change">Change PIN</button><button class="btn danger-text" data-pin="remove">Remove PIN</button>`
              : '<button class="btn primary" data-pin="set">Set a PIN</button>'}
          </div>
          <div class="field" ${hasPin ? '' : 'hidden'}><label for="lock-after">Lock automatically after</label>
            <select id="lock-after" data-lockafter>${ui.options([['0', 'Never'], ['1', '1 minute'], ['5', '5 minutes'], ['15', '15 minutes'], ['30', '30 minutes'], ['60', '1 hour']], String(st.lockAfterMin))}</select>
            <span class="hint">Counts time without activity, or with the app in the background.</span></div>
        </div>
        <div class="card span-2">
          <div class="card-head"><h2>About your data</h2></div>
          <p class="secondary small">Everything is saved in this browser's local storage on this device (${(S.bytesUsed() / 1024).toFixed(0)} KB used). Nothing is sent anywhere. Clearing your browser's site data, or using a different browser, means starting empty, so keep a backup from <a href="#/data">Import & export</a>.</p>
          <p class="secondary small">Shortcut: press <span class="kbd">N</span> anywhere to add a transaction.</p>
        </div>
      </div>`;

    root.querySelectorAll('input[name="theme"]').forEach((r) => r.addEventListener('change', () => {
      S.get().settings.theme = r.value;
      S.commit();
      App.applyTheme();
    }));
    root.querySelectorAll('[data-pin]').forEach((b) => b.addEventListener('click', () => pinDialog(b.dataset.pin)));
    root.querySelector('[data-lockafter]').addEventListener('change', (e) => { S.get().settings.lockAfterMin = Number(e.target.value); S.commit(); });
  }

  return { render };
})();
