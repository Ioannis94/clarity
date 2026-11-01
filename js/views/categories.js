'use strict';
App.views = App.views || {};

App.views.categories = (function () {
  const U = App.util, S = App.store, ui = App.ui;
  const ICON_CHOICES = ['🛒', '🍽️', '☕', '🏠', '💡', '⛽', '🚗', '🚌', '🛍️', '👕', '💊', '🏋️', '🎬', '🎮', '📺', '✈️', '🏖️', '📚', '🎁', '🛡️', '🧾', '🏦', '📱', '🐶', '👶', '💇', '🔧', '📦',
    '💼', '🧑‍💻', '📈', '🪙', '💶', '↩️', '➕', '🏷️'];

  function edit(cat, kind) {
    const editing = !!cat;
    const v = cat || { name: '', icon: kind === 'income' ? '💶' : '📦', kind };
    ui.modal({
      title: editing ? 'Edit category' : `New ${kind} category`,
      body: `
        <div class="field"><label for="c-name">Name</label><input id="c-name" name="name" value="${U.esc(v.name)}" autofocus></div>
        <div class="field"><label for="c-icon">Icon (any emoji)</label><input id="c-icon" name="icon" value="${U.esc(v.icon)}" style="width:80px;font-size:20px;text-align:center">
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${ICON_CHOICES.map((i) => `<button type="button" class="icon-btn" data-icon="${i}" style="font-size:18px">${i}</button>`).join('')}</div></div>`,
      leftButtons: editing ? `<button type="button" class="btn ghost danger-text" data-delete>${ui.icon('trash')} Delete</button>` : '',
      onOpen(form) {
        form.querySelectorAll('[data-icon]').forEach((b) => b.addEventListener('click', () => { form.elements.icon.value = b.dataset.icon; }));
        const del = form.querySelector('[data-delete]');
        if (del) del.addEventListener('click', () => remove(cat));
      },
      onSubmit(form) {
        const name = form.elements.name.value.trim();
        if (!name) return ui.fieldError(form, 'name', 'Enter a name.');
        if (S.get().categories.some((c) => c.kind === v.kind && c.id !== v.id && c.name.toLowerCase() === name.toLowerCase())) return ui.fieldError(form, 'name', 'That category already exists.');
        S.saveCategory({ id: v.id, kind: v.kind, name, icon: form.elements.icon.value });
        ui.toast('Category saved');
      },
    });
  }

  function remove(cat) {
    const others = S.categoriesOf(cat.kind).filter((c) => c.id !== cat.id);
    if (!others.length) { ui.toast('Keep at least one category of each type.', 'error'); return; }
    const used = S.categoryUsage(cat.id);
    const fallback = S.fallbackCategory(cat.kind);
    ui.modal({
      title: `Delete “${cat.name}”?`,
      submitLabel: 'Delete', danger: true,
      body: used ? `<p>${used} entr${used === 1 ? 'y uses' : 'ies use'} this category. Move them to:</p>
        <div class="field"><select name="moveTo">${ui.options(others.map((c) => [c.id, `${c.icon} ${c.name}`]), fallback && fallback.id !== cat.id ? fallback.id : others[0].id)}</select></div>`
        : '<p>This category is not used by any entries.</p>',
      onSubmit(form) {
        S.deleteCategory(cat.id, used ? form.elements.moveTo.value : null);
        ui.toast('Category deleted');
      },
    });
  }

  function section(kind, title) {
    const cats = S.categoriesOf(kind);
    return `<div class="card">
      <div class="card-head"><h2>${title}</h2><button class="btn small" data-new="${kind}">${ui.icon('plus')} Add</button></div>
      ${cats.map((c) => {
        const n = S.categoryUsage(c.id);
        return `<div class="list-item" data-id="${c.id}" style="cursor:pointer">
          <span class="cat-icon">${U.esc(c.icon)}</span>
          <div class="grow"><div class="tx-title">${U.esc(c.name)}</div><div class="tx-sub">${n} entr${n === 1 ? 'y' : 'ies'}${S.get().budgets[c.id] ? ` · budget ${U.money(S.get().budgets[c.id])}/month` : ''}</div></div>
          <button class="icon-btn" aria-label="Edit ${U.esc(c.name)}">${ui.icon('edit')}</button>
        </div>`;
      }).join('')}
    </div>`;
  }

  function render(root) {
    root.innerHTML = `
      <div class="page-head"><h1>Categories</h1></div>
      <div class="grid grid-2">${section('expense', 'Expense categories')}${section('income', 'Income categories')}</div>`;
    root.querySelectorAll('[data-new]').forEach((b) => b.addEventListener('click', () => edit(null, b.dataset.new)));
    root.querySelectorAll('.list-item[data-id]').forEach((el) => el.addEventListener('click', () => edit(S.category(el.dataset.id))));
  }

  return { render };
})();
