'use strict';
// Small dependency-free SVG charts: grouped columns, a line with crosshair, and bar lists.
// Colors come from CSS custom properties (--series-1 ...), so light/dark is handled by the stylesheet.
App.charts = (function () {
  const U = App.util;
  const NS = 'http://www.w3.org/2000/svg';
  const M = { top: 14, right: 12, bottom: 28, left: 52 };

  function svgEl(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    if (parent) parent.appendChild(el);
    return el;
  }

  function niceScale(min, max, ticks = 4) {
    if (min === max) { max = min + 100; }
    const rough = (max - min) / ticks;
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const n = rough / mag;
    const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
    return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step, step };
  }

  // ---------- Tooltip (one shared element) ----------
  let tip;
  function tooltip() {
    if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip'; tip.setAttribute('role', 'status'); document.body.appendChild(tip); }
    return tip;
  }
  function showTip(evt, title, rows) {
    const t = tooltip();
    t.replaceChildren();
    const h = document.createElement('div'); h.className = 'chart-tip-title'; h.textContent = title; t.appendChild(h);
    for (const r of rows) {
      const row = document.createElement('div'); row.className = 'chart-tip-row';
      const key = document.createElement('span'); key.className = 'chart-tip-key'; key.style.background = `var(${r.color})`;
      const val = document.createElement('strong'); val.textContent = r.value;
      const name = document.createElement('span'); name.className = 'muted'; name.textContent = r.name;
      row.append(key, val, name);
      t.appendChild(row);
    }
    t.style.display = 'block';
    const rect = evt.target.getBoundingClientRect();
    const x = evt.clientX != null && evt.clientX !== 0 ? evt.clientX : rect.left + rect.width / 2;
    const y = evt.clientY != null && evt.clientY !== 0 ? evt.clientY : rect.top;
    const w = t.offsetWidth, hgt = t.offsetHeight;
    let left = x + 14, top = y - hgt - 10;
    if (left + w > window.innerWidth - 8) left = x - w - 14;
    if (top < 8) top = y + 16;
    t.style.left = Math.max(8, left) + 'px';
    t.style.top = top + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }
  window.addEventListener('scroll', hideTip, true);

  // ---------- Legend + table toggle ----------
  function header(container, series, kind, tableRows) {
    const head = document.createElement('div');
    head.className = 'chart-head';
    const legend = document.createElement('div');
    legend.className = 'legend';
    if (series.length > 1) {
      for (const s of series) {
        const item = document.createElement('span'); item.className = 'legend-item';
        const sw = document.createElement('span'); sw.className = 'legend-swatch ' + kind; sw.style.background = `var(${s.color})`;
        const label = document.createElement('span'); label.textContent = s.name;
        item.append(sw, label);
        legend.appendChild(item);
      }
    }
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'link-btn'; btn.textContent = 'Table';
    head.append(legend, btn);
    container.appendChild(head);
    const body = document.createElement('div'); body.className = 'chart-body';
    container.appendChild(body);
    const table = document.createElement('div'); table.className = 'chart-table'; table.hidden = true;
    table.innerHTML = tableRows;
    container.appendChild(table);
    btn.addEventListener('click', () => {
      const showTable = table.hidden;
      table.hidden = !showTable; body.hidden = showTable;
      btn.textContent = showTable ? 'Chart' : 'Table';
    });
    return body;
  }
  function tableHTML(labels, series, fmt) {
    return `<table class="table compact"><thead><tr><th></th>${series.map((s) => `<th class="num">${U.esc(s.name)}</th>`).join('')}</tr></thead><tbody>` +
      labels.map((l, i) => `<tr><td>${U.esc(l)}</td>${series.map((s) => `<td class="num">${fmt(s.values[i])}</td>`).join('')}</tr>`).join('') +
      '</tbody></table>';
  }

  // Bar with a 4px rounded data end and a square baseline end.
  function barPath(x, y0, y1, w) {
    const h = Math.abs(y1 - y0);
    const r = Math.min(4, h, w / 2);
    if (h < 0.5) return '';
    if (y1 < y0) { // grows upward
      return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
    }
    return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
  }

  function axes(svg, scale, y, w, h) {
    const g = svgEl('g', { class: 'axis' }, svg);
    for (let v = scale.min; v <= scale.max + 1e-6; v += scale.step) {
      const yy = Math.round(y(v)) + 0.5;
      svgEl('line', { x1: M.left, x2: w - M.right, y1: yy, y2: yy, class: v === 0 ? 'baseline' : 'gridline' }, g);
      const t = svgEl('text', { x: M.left - 8, y: yy + 4, 'text-anchor': 'end', class: 'tick' }, g);
      t.textContent = U.compact(v);
    }
  }

  // ---------- Grouped columns ----------
  // opts: {labels, series: [{name, color: '--series-1', values: [cents]}], height}
  function columns(container, opts) {
    container.replaceChildren();
    const fmt = opts.format || U.money0;
    const body = header(container, opts.series, 'rect', tableHTML(opts.labels, opts.series, fmt));
    const w = Math.max(280, body.clientWidth || container.clientWidth || 600);
    const h = opts.height || 240;
    const all = opts.series.flatMap((s) => s.values);
    const scale = niceScale(Math.min(0, ...all), Math.max(0, ...all));
    const y = (v) => M.top + (h - M.top - M.bottom) * (1 - (v - scale.min) / (scale.max - scale.min));
    const svg = svgEl('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, class: 'chart', role: 'img', 'aria-label': opts.title || 'Column chart' });
    axes(svg, scale, y, w, h);

    const n = opts.labels.length, k = opts.series.length;
    const band = (w - M.left - M.right) / n;
    const barW = Math.max(3, Math.min(24, (band * 0.72 - (k - 1) * 2) / k));
    const groupW = barW * k + (k - 1) * 2;
    const labelEvery = band < 30 ? 3 : band < 42 ? 2 : 1;
    const y0 = y(0);

    opts.labels.forEach((label, i) => {
      const gx = M.left + band * i + (band - groupW) / 2;
      const g = svgEl('g', { class: 'col-group' }, svg);
      const hl = svgEl('rect', { x: M.left + band * i, y: M.top, width: band, height: h - M.top - M.bottom, class: 'band-hl' }, g);
      opts.series.forEach((s, j) => {
        const d = barPath(gx + j * (barW + 2), y0, y(s.values[i]), barW);
        if (d) svgEl('path', { d, style: `fill: var(${s.color})`, class: 'mark' }, g);
      });
      if (i % labelEvery === 0 || i === n - 1) {
        const t = svgEl('text', { x: M.left + band * i + band / 2, y: h - 8, 'text-anchor': 'middle', class: 'tick' }, g);
        t.textContent = label;
      }
      hl.setAttribute('tabindex', '0');
      const show = (e) => { g.classList.add('hover'); showTip(e, opts.tipLabels ? opts.tipLabels[i] : label, opts.series.map((s) => ({ name: s.name, value: fmt(s.values[i]), color: s.color }))); };
      const hide = () => { g.classList.remove('hover'); hideTip(); };
      hl.addEventListener('pointermove', show); hl.addEventListener('focus', show);
      hl.addEventListener('pointerleave', hide); hl.addEventListener('blur', hide);
    });
    body.appendChild(svg);
  }

  // ---------- Line with area wash + crosshair ----------
  // opts: {labels, tipLabels, values: [cents], name, color}
  function line(container, opts) {
    container.replaceChildren();
    const fmt = opts.format || U.money0;
    const color = opts.color || '--series-1';
    const series = [{ name: opts.name, color, values: opts.values }];
    const body = header(container, series, 'line', tableHTML(opts.tipLabels || opts.labels, series, fmt));
    const w = Math.max(280, body.clientWidth || container.clientWidth || 600);
    const h = opts.height || 240;
    const vals = opts.values;
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.1 || Math.abs(hi) * 0.1 || 100;
    const scale = niceScale(lo >= 0 && lo - pad < 0 ? 0 : lo - pad, hi + pad);
    const y = (v) => M.top + (h - M.top - M.bottom) * (1 - (v - scale.min) / (scale.max - scale.min));
    const n = vals.length;
    const right = M.right + 44; // room for the end label
    const x = (i) => M.left + 8 + (n === 1 ? 0 : (i * (w - M.left - right - 8)) / (n - 1));
    const svg = svgEl('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, class: 'chart', role: 'img', 'aria-label': opts.title || 'Line chart' });
    axes(svg, scale, y, w - 44, h);

    const pts = vals.map((v, i) => [x(i), y(v)]);
    const base = y(Math.max(scale.min, Math.min(0, scale.max)));
    svgEl('path', { d: `M${pts[0][0]},${base}` + pts.map((p) => `L${p[0]},${p[1]}`).join('') + `L${pts[n - 1][0]},${base}Z`, class: 'area', style: `fill: var(${color})` }, svg);
    svgEl('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join(''), class: 'line', style: `stroke: var(${color})` }, svg);

    const labelEvery = Math.ceil(n / Math.max(2, Math.floor((w - M.left - right) / 48)));
    opts.labels.forEach((l, i) => {
      if (i % labelEvery !== 0 && i !== n - 1) return;
      svgEl('text', { x: x(i), y: h - 8, 'text-anchor': 'middle', class: 'tick' }, svg).textContent = l;
    });
    const last = pts[n - 1];
    svgEl('circle', { cx: last[0], cy: last[1], r: 4, class: 'dot', style: `fill: var(${color})` }, svg);
    svgEl('text', { x: last[0] + 8, y: last[1] + 4, class: 'end-label' }, svg).textContent = U.compact(vals[n - 1]);

    const cross = svgEl('line', { y1: M.top, y2: h - M.bottom, class: 'crosshair', visibility: 'hidden' }, svg);
    const hdot = svgEl('circle', { r: 4, class: 'dot', style: `fill: var(${color})`, visibility: 'hidden' }, svg);
    const hit = svgEl('rect', { x: M.left, y: M.top, width: w - M.left - M.right, height: h - M.top - M.bottom, class: 'hit', tabindex: 0 }, svg);
    let focusIdx = n - 1;
    const showAt = (i, e) => {
      cross.setAttribute('x1', pts[i][0]); cross.setAttribute('x2', pts[i][0]); cross.setAttribute('visibility', 'visible');
      hdot.setAttribute('cx', pts[i][0]); hdot.setAttribute('cy', pts[i][1]); hdot.setAttribute('visibility', 'visible');
      showTip(e, (opts.tipLabels || opts.labels)[i], [{ name: opts.name, value: fmt(vals[i]), color }]);
    };
    hit.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * w;
      let best = 0;
      pts.forEach((p, i) => { if (Math.abs(p[0] - px) < Math.abs(pts[best][0] - px)) best = i; });
      showAt(best, e);
    });
    hit.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') focusIdx = Math.max(0, focusIdx - 1);
      else if (e.key === 'ArrowRight') focusIdx = Math.min(n - 1, focusIdx + 1);
      else return;
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      showAt(focusIdx, { target: hit, clientX: r.left + (pts[focusIdx][0] / w) * r.width, clientY: r.top + (pts[focusIdx][1] / h) * r.height });
    });
    const hide = () => { cross.setAttribute('visibility', 'hidden'); hdot.setAttribute('visibility', 'hidden'); hideTip(); };
    hit.addEventListener('pointerleave', hide); hit.addEventListener('blur', hide);
    body.appendChild(svg);
  }

  // ---------- Horizontal bar list (HTML) ----------
  // items: [{label, icon, value, sub, href}] — every bar is labeled with its value, so no tooltip is needed.
  function barList(container, items, opts = {}) {
    const fmt = opts.format || U.money;
    if (!items.length) { container.innerHTML = `<p class="empty">${U.esc(opts.empty || 'Nothing to show yet.')}</p>`; return; }
    const max = Math.max(...items.map((i) => i.value), 1);
    container.innerHTML = `<div class="barlist">${items.map((it) => `
      <${it.href ? `a href="${U.esc(it.href)}"` : 'div'} class="barlist-row">
        <span class="barlist-label">${it.icon ? `<span class="cat-icon">${U.esc(it.icon)}</span>` : ''}<span class="truncate">${U.esc(it.label)}</span></span>
        <span class="barlist-track"><span class="barlist-bar" style="width:${Math.max(1, (it.value / max) * 100).toFixed(1)}%"></span></span>
        <span class="barlist-value num">${fmt(it.value)}${it.sub ? `<span class="muted small"> ${U.esc(it.sub)}</span>` : ''}</span>
      </${it.href ? 'a' : 'div'}>`).join('')}</div>`;
  }

  return { columns, line, barList, hideTip };
})();
