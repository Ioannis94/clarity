'use strict';
// Shared helpers: formatting, dates, parsing, CSV, downloads.
window.App = window.App || {};
App.VERSION = '1.1 (7 Nov 2026)'; // shown in Settings, so you can tell which version the phone runs

App.util = (function () {
  const U = {};

  U.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // ---------- Money (amounts are stored as integer cents) ----------
  const eur = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
  const eur0 = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  U.money = (cents) => eur.format((cents || 0) / 100);
  U.money0 = (cents) => eur0.format(Math.round((cents || 0) / 100));
  U.signed = (cents) => (cents > 0 ? '+' : cents < 0 ? '−' : '') + U.money(Math.abs(cents));
  U.compact = (cents) => {
    const v = (cents || 0) / 100;
    const a = Math.abs(v);
    const sign = v < 0 ? '−' : '';
    if (a >= 1e6) return sign + '€' + trim(a / 1e6) + 'M';
    if (a >= 1e3) return sign + '€' + trim(a / 1e3) + 'K';
    return sign + '€' + Math.round(a);
  };
  function trim(x) { return (Math.round(x * 10) / 10).toString(); }

  U.num = (n, d = 4) => new Intl.NumberFormat('en-IE', { maximumFractionDigits: d }).format(n || 0);
  U.pct = (x, d = 1) => (isFinite(x) ? (x * 100).toFixed(d) : '0.0') + '%';

  // Parse a user-typed number: accepts "1,234.56", "1.234,56", "12,5", "€ 30".
  U.parseNum = (input, decimal) => {
    if (typeof input === 'number') return input;
    let s = String(input || '').trim().replace(/[€\s ']/g, '');
    if (!s) return NaN;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
    if (s.startsWith('-') || s.startsWith('−')) { neg = true; s = s.slice(1); }
    if (s.startsWith('+')) s = s.slice(1);
    if (decimal === ',') s = s.replace(/\./g, '').replace(',', '.');
    else if (decimal === '.') s = s.replace(/,/g, '');
    else {
      const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
      if (lc > -1 && ld > -1) {
        s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
      } else if (lc > -1) {
        // A lone comma followed by 1-2 digits is a decimal separator, otherwise thousands.
        s = /,\d{1,2}$/.test(s) && s.split(',').length === 2 ? s.replace(',', '.') : s.replace(/,/g, '');
      }
    }
    if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return NaN;
    const v = parseFloat(s);
    return neg ? -v : v;
  };
  U.toCents = (input, decimal) => {
    const v = U.parseNum(input, decimal);
    return isNaN(v) ? NaN : Math.round(v * 100);
  };
  U.centsToInput = (cents) => (cents == null ? '' : (cents / 100).toFixed(2));

  // ---------- Dates (stored as 'YYYY-MM-DD' local strings) ----------
  const pad = (n) => String(n).padStart(2, '0');
  U.ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  U.today = () => U.ymd(new Date());
  U.parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  U.monthKey = (s) => s.slice(0, 7);
  U.thisMonth = () => U.monthKey(U.today());
  U.addMonths = (key, n) => {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };
  U.daysInMonth = (y, m) => new Date(y, m, 0).getDate(); // m is 1-based
  U.endOfMonth = (key) => { const [y, m] = key.split('-').map(Number); return `${key}-${pad(U.daysInMonth(y, m))}`; };
  U.addDays = (s, n) => { const d = U.parseDate(s); d.setDate(d.getDate() + n); return U.ymd(d); };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  U.monthShort = (key) => MONTHS[Number(key.slice(5, 7)) - 1];
  U.monthLabel = (key) => `${MONTHS_LONG[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
  U.fmtDate = (s) => { const d = U.parseDate(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  U.fmtDay = (s) => {
    if (s === U.today()) return 'Today';
    if (s === U.addDays(U.today(), -1)) return 'Yesterday';
    const d = U.parseDate(s);
    return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };
  U.isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(U.parseDate(s));

  // Parse a date from a bank file using an explicit format.
  U.parseDateFmt = (raw, fmt) => {
    const s = String(raw || '').trim().split(/[ T]/)[0];
    const parts = s.split(/[\/.\-]/).map((p) => p.trim());
    if (parts.length !== 3) return null;
    let y, m, d;
    if (fmt === 'YMD') [y, m, d] = parts;
    else if (fmt === 'DMY') [d, m, y] = parts;
    else if (fmt === 'MDY') [m, d, y] = parts;
    y = Number(y); m = Number(m); d = Number(d);
    if (y < 100) y += 2000;
    if (!y || !m || !d || m > 12 || d > U.daysInMonth(y, m)) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
  };

  // ---------- HTML ----------
  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.html = (str) => { const t = document.createElement('template'); t.innerHTML = str.trim(); return t.content.firstElementChild; };

  // ---------- CSV ----------
  U.detectDelimiter = (text) => {
    const sample = text.split(/\r?\n/).slice(0, 5).join('\n');
    const counts = [';', ',', '\t', '|'].map((d) => [d, sample.split(d).length]);
    counts.sort((a, b) => b[1] - a[1]);
    return counts[0][0];
  };
  U.csvParse = (text, delim) => {
    text = text.replace(/^﻿/, '');
    delim = delim || U.detectDelimiter(text);
    const rows = [];
    let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some((f) => f.trim() !== '')) rows.push(row);
        row = [];
      } else field += c;
    }
    row.push(field);
    if (row.some((f) => f.trim() !== '')) rows.push(row);
    return rows;
  };
  U.csvStringify = (rows) => rows.map((r) => r.map((v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\r\n');

  // ---------- Files ----------
  U.download = (filename, text, mime = 'text/plain') => {
    const blob = new Blob([text], { type: mime + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  U.readFile = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });

  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  return U;
})();
