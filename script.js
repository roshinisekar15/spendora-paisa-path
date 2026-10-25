/* Spendora - Personal Expense Tracker – Personal Expense Tracker
   Data is saved in the browser (localStorage). Each user has a separate record,
   so one user can never see another user's expenses. */
const $ = id => document.getElementById(id);
const DEFAULT_CATS = ['Food', 'Travel', 'Shopping', 'Bills', 'Health', 'Education', 'Entertainment'];
const PER_PAGE = 5;

let db = JSON.parse(localStorage.getItem('pp_db') || '{"users":{},"data":{}}');
let me = localStorage.getItem('pp_me');
let signupMode = false, page = 1, editing = null;

const today = () => new Date().toLocaleDateString('en-CA');          // YYYY-MM-DD
const thisMonth = () => today().slice(0, 7);                          // YYYY-MM
const save = () => localStorage.setItem('pp_db', JSON.stringify(db));
const D = () => db.data[me];
const money = n => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hash = s => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h.toString(36); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ---------- Login / Sign up ---------- */
function setAuthMode(isSignup) {
  signupMode = isSignup;
  $('authTitle').textContent = isSignup ? 'Create your account' : 'Welcome back';
  $('authBtn').textContent = isSignup ? 'Sign up' : 'Log in';
  $('authSwitch').textContent = isSignup ? 'Already have an account? Log in' : 'New here? Create an account';
  $('nameRow').hidden = !isSignup; $('authErr').textContent = '';
}
$('authSwitch').onclick = () => setAuthMode(!signupMode);

$('authForm').onsubmit = e => {
  e.preventDefault();
  const name = $('aName').value.trim(), email = $('aEmail').value.trim().toLowerCase(), pass = $('aPass').value;
  const err = m => $('authErr').textContent = m;
  if (!/^\S+@\S+\.\S+$/.test(email)) return err('Enter a valid email address.');
  if (pass.length < 6) return err('Password must have at least 6 characters.');
  if (signupMode) {
    if (!name) return err('Enter your name.');
    if (db.users[email]) return err('This email is already registered. Please log in.');
    db.users[email] = { name, h: hash(pass) };
    db.data[email] = { expenses: [], cats: [...DEFAULT_CATS], budgets: {} };
    save();
  } else if (!db.users[email] || db.users[email].h !== hash(pass)) {
    return err('Email or password is wrong. Check and try again.');
  }
  me = email; localStorage.setItem('pp_me', me);
  $('authForm').reset(); enterApp();
};

$('logout').onclick = () => { localStorage.removeItem('pp_me'); me = null; location.reload(); };

function enterApp() {
  $('auth').hidden = true; $('app').hidden = false;
  $('who').textContent = db.users[me].name;
  $('month').value = $('bMonth').value = thisMonth();
  $('eDate').value = today();
  go('dash');
}

/* ---------- Navigation ---------- */
function go(v) {
  document.querySelectorAll('.view').forEach(s => s.hidden = s.id !== 'v-' + v);
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  fillCats(); renderAll();
}
$('nav').onclick = e => { if (e.target.dataset.v) go(e.target.dataset.v); };

function renderAll() { renderAlerts(); renderDash(); renderExtras(); renderExpenses(); renderCats(); renderBudgets(); }

/* ---------- Helpers: spending and budgets ---------- */
const spent = (month, cat) => D().expenses
  .filter(x => x.date.startsWith(month) && (!cat || x.category === cat))
  .reduce((s, x) => s + x.amount, 0);
const budgetOf = (month, cat) => (D().budgets[month] || {})[cat] || 0;
const level = (s, b) => !b ? '' : s > b ? 'bad' : s >= b * 0.8 ? 'warn' : '';

function renderAlerts() {
  const m = thisMonth(); let html = '';
  D().cats.forEach(c => {
    const s = spent(m, c), b = budgetOf(m, c), l = level(s, b);
    if (l === 'bad') html += `<div class="alert bad">Alert: ${esc(c)} budget exceeded. You spent ${money(s)} of ${money(b)}.</div>`;
    if (l === 'warn') html += `<div class="alert warn">Warning: ${esc(c)} has used ${Math.round(s / b * 100)}% of its ${money(b)} budget.</div>`;
  });
  $('alerts').innerHTML = html;
}

/* ---------- Dashboard ---------- */
function renderDash() {
  const m = $('month').value || thisMonth();
  const rows = D().cats.map(c => ({ c, s: spent(m, c), b: budgetOf(m, c) }));
  const totalS = rows.reduce((a, r) => a + r.s, 0), totalB = rows.reduce((a, r) => a + r.b, 0);
  $('sSpent').textContent = money(totalS); $('sBudget').textContent = money(totalB);
  $('sLeft').textContent = totalB ? money(totalB - totalS) : '–';

  const max = Math.max(1, ...rows.map(r => r.b || r.s));
  const shown = rows.filter(r => r.s || r.b);
  $('chart').innerHTML = shown.length ? shown.map(r => {
    const w = Math.min(100, r.s / (r.b || max) * 100);
    return `<div class="bar"><span>${esc(r.c)}</span><div class="track"><div class="fill ${level(r.s, r.b)}" style="width:${w}%"></div></div><b class="num">${money(r.s)}</b></div>`;
  }).join('') : '<p class="hint">No spending in this month yet. Add an expense to see your chart.</p>';

  $('sumTable').innerHTML = '<tr><th>Category</th><th class="num">Spent</th><th class="num">Budget</th><th>Status</th></tr>' +
    shown.map(r => {
      const l = level(r.s, r.b);
      const st = !r.b ? 'No budget' : l === 'bad' ? 'Exceeded' : l === 'warn' ? 'Near limit' : 'On track';
      return `<tr><td>${esc(r.c)}</td><td class="num">${money(r.s)}</td><td class="num">${r.b ? money(r.b) : '–'}</td><td>${st}</td></tr>`;
    }).join('');
}
$('month').onchange = () => { renderDash(); renderExtras(); };

/* ---------- Categories ---------- */
function fillCats() {
  const opts = D().cats.map(c => `<option>${esc(c)}</option>`).join('');
  const keepE = $('eCat').value, keepF = $('fCat').value;
  $('eCat').innerHTML = opts;
  $('fCat').innerHTML = '<option value="">All</option>' + opts;
  if (D().cats.includes(keepE)) $('eCat').value = keepE;
  if (D().cats.includes(keepF)) $('fCat').value = keepF;
}
function renderCats() {
  $('catList').innerHTML = D().cats.map(c => DEFAULT_CATS.includes(c)
    ? `<li>${esc(c)}</li>`
    : `<li>${esc(c)}<button data-c="${esc(c)}" aria-label="Delete ${esc(c)}">×</button></li>`).join('');
}
$('catForm').onsubmit = e => {
  e.preventDefault();
  const name = $('cName').value.trim().replace(/\s+/g, ' '), err = $('cErr');
  if (!name) return err.textContent = 'Category name cannot be empty.';
  if (D().cats.some(c => c.toLowerCase() === name.toLowerCase())) return err.textContent = 'This category already exists.';
  D().cats.push(name); save(); err.textContent = ''; $('cName').value = '';
  fillCats(); renderAll(); toast('Category added');
};
$('catList').onclick = e => {
  const c = e.target.dataset.c; if (!c) return;
  if (D().expenses.some(x => x.category === c)) return $('cErr').textContent = `"${c}" has expenses, so it cannot be deleted.`;
  D().cats = D().cats.filter(x => x !== c); delete_budgets(c); save(); $('cErr').textContent = '';
  fillCats(); renderAll();
};
function delete_budgets(c) { Object.values(D().budgets).forEach(b => delete b[c]); }

/* ---------- Expenses: add / edit / delete ---------- */
$('expForm').onsubmit = e => {
  e.preventDefault();
  const amount = parseFloat($('eAmt').value), date = $('eDate').value, err = $('eErr');
  if (!(amount > 0)) return err.textContent = 'Enter an amount greater than 0.';
  if (!date) return err.textContent = 'Choose a date.';
  const item = { id: editing || uid(), amount, date, category: $('eCat').value, mode: $('eMode').value, desc: $('eDesc').value.trim() };
  if (editing) D().expenses = D().expenses.map(x => x.id === editing ? item : x);
  else D().expenses.push(item);
  save(); err.textContent = '';
  const m = date.slice(0, 7), s = spent(m, item.category), b = budgetOf(m, item.category), l = level(s, b);
  toast(l === 'bad' ? `Alert: ${item.category} budget exceeded!` : l === 'warn' ? `Warning: ${item.category} is at ${Math.round(s / b * 100)}% of budget` : editing ? 'Expense updated' : 'Expense added');
  resetExpForm(); renderAll();
};
function resetExpForm() {
  editing = null; $('expForm').reset(); $('eDate').value = today();
  $('eBtn').textContent = 'Add expense'; $('eCancel').hidden = true;
}
$('eCancel').onclick = resetExpForm;

/* ---------- Expense list: filters + pagination ---------- */
function filtered() {
  const f = $('fFrom').value, t = $('fTo').value, c = $('fCat').value, m = $('fMode').value, q = $('fQ').value.trim().toLowerCase();
  return D().expenses.filter(x => (!f || x.date >= f) && (!q || (x.desc || '').toLowerCase().includes(q)) && (!t || x.date <= t) && (!c || x.category === c) && (!m || x.mode === m))
    .sort((a, b) => b.date.localeCompare(a.date));
}
function renderExpenses() {
  const list = filtered(), pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  page = Math.min(page, pages);
  const rows = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  $('expTable').innerHTML = '<tr><th>Date</th><th>Category</th><th>Mode</th><th>Description</th><th class="num">Amount</th><th></th></tr>' +
    (rows.length ? rows.map(x => `<tr><td>${x.date}</td><td>${esc(x.category)}</td><td>${esc(x.mode)}</td><td>${esc(x.desc || '–')}</td>
      <td class="num">${money(x.amount)}</td><td><button data-edit="${x.id}">Edit</button><button class="del" data-del="${x.id}">Delete</button></td></tr>`).join('')
      : '<tr><td colspan="6">No expenses match. Add one above or clear the filters.</td></tr>');
  $('pg').textContent = `Page ${page} of ${pages} · ${list.length} expenses`;
  $('prev').disabled = page <= 1; $('next').disabled = page >= pages;
}
['fFrom', 'fTo', 'fCat', 'fMode'].forEach(id => $(id).onchange = () => { page = 1; renderExpenses(); });
$('fClear').onclick = () => { ['fFrom', 'fTo', 'fCat', 'fMode', 'fQ'].forEach(id => $(id).value = ''); page = 1; renderExpenses(); };
$('prev').onclick = () => { page--; renderExpenses(); };
$('next').onclick = () => { page++; renderExpenses(); };

$('expTable').onclick = e => {
  const ed = e.target.dataset.edit, del = e.target.dataset.del;
  if (ed) {
    const x = D().expenses.find(i => i.id === ed); editing = ed;
    $('eAmt').value = x.amount; $('eDate').value = x.date; $('eCat').value = x.category;
    $('eMode').value = x.mode; $('eDesc').value = x.desc;
    $('eBtn').textContent = 'Save changes'; $('eCancel').hidden = false;
    $('expForm').scrollIntoView({ behavior: 'smooth' });
  }
  if (del && confirm('Delete this expense?')) {
    D().expenses = D().expenses.filter(i => i.id !== del); save(); renderAll(); toast('Expense deleted');
  }
};

/* ---------- Budgets ---------- */
function renderBudgets() {
  const m = $('bMonth').value || thisMonth();
  $('budList').innerHTML = D().cats.map(c => {
    const s = spent(m, c), b = budgetOf(m, c), w = b ? Math.min(100, s / b * 100) : 0;
    return `<div class="bud"><b>${esc(c)}</b>
      <input type="number" min="0" step="100" placeholder="Limit ₹" value="${b || ''}" data-b="${esc(c)}" aria-label="${esc(c)} budget">
      <div><div class="track"><div class="fill ${level(s, b)}" style="width:${w}%"></div></div>
      <small>${money(s)} spent${b ? ' · ' + Math.round(s / b * 100) + '% used' : ' · no budget set'}</small></div></div>`;
  }).join('');
}
$('bMonth').onchange = renderBudgets;
$('budList').onchange = e => {
  const c = e.target.dataset.b; if (!c) return;
  const m = $('bMonth').value, v = parseFloat(e.target.value);
  D().budgets[m] = D().budgets[m] || {};
  if (v > 0) D().budgets[m][c] = v; else delete D().budgets[m][c];
  save(); renderAll(); toast('Budget saved');
};


/* ---------- Extras: donut chart, recent list, 6-month trend, CSV ---------- */
const COLORS = ['#5BA8FF', '#F5D98B', '#7BE0C3', '#F29E6B', '#B79CFF', '#FF7B9C', '#8FD3FF'];
function renderExtras() {
  const m = $('month').value || thisMonth(), [y, mo] = m.split('-').map(Number);
  const rows = D().cats.map(c => ({ c, s: spent(m, c) })).filter(r => r.s > 0);
  const tot = rows.reduce((a, r) => a + r.s, 0); let acc = 0;
  const stops = rows.map((r, i) => { const from = acc / tot * 100; acc += r.s; return `${COLORS[i % 7]} ${from}% ${acc / tot * 100}%`; });
  $('donut').style.background = tot ? `conic-gradient(${stops.join(',')})` : 'rgba(255,255,255,.08)';
  $('dTotal').innerHTML = `<small>Total</small>${money(tot)}`;
  $('legend').innerHTML = rows.map((r, i) => `<li><i style="background:${COLORS[i % 7]}"></i>${esc(r.c)}<b>${Math.round(r.s / tot * 100)}%</b></li>`).join('') || '<li>No data yet</li>';
  const rec = [...D().expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  $('recent').innerHTML = rec.map(x => `<li><div><b>${esc(x.category)}</b><small>${x.date} · ${esc(x.mode)}</small></div><span>−${money(x.amount)}</span></li>`).join('') || '<li>No transactions yet</li>';
  const months = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(y, mo - 1 - i, 1); months.push({ k: d.toLocaleDateString('en-CA').slice(0, 7), l: d.toLocaleString('en', { month: 'short' }) }); }
  const vals = months.map(x => spent(x.k)), mx = Math.max(1, ...vals);
  $('trend').innerHTML = months.map((x, i) => `<div><div class="tbar" style="height:${vals[i] / mx * 100}%" title="${money(vals[i])}"></div><small>${x.l}</small></div>`).join('');
  $('greet').textContent = `Hello, ${db.users[me].name}! Here is your spending for ${new Date(y, mo - 1).toLocaleString('en', { month: 'long', year: 'numeric' })}.`;
}
$('fQ').oninput = () => { page = 1; renderExpenses(); };
$('export').onclick = () => {
  const rows = filtered(); if (!rows.length) return toast('Nothing to export');
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const csv = ['Date,Category,Mode,Description,Amount', ...rows.map(x => [x.date, x.category, x.mode, x.desc, x.amount].map(q).join(','))].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'expenses.csv'; a.click(); toast('CSV downloaded');
};

/* ---------- Start ---------- */
if (me && db.users[me]) enterApp();