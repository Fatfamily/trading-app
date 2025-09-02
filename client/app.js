/* Kiwoom-style client: right-click menu, shortcuts, login/register, 1s polling, favorites, chart. */
const API = {
  top: '/api/top',
  search: (q) => `/api/search?q=${encodeURIComponent(q)}`,
  quote: (code) => `/api/quote?code=${encodeURIComponent(code)}`,
  news: (code) => `/api/news?code=${encodeURIComponent(code)}`,
  register: '/api/register',
  login: '/api/login',
  me: '/api/me',
  favorites: '/api/favorites',
};

const state = {
  token: localStorage.getItem('token') || null,
  user: null,
  selected: null, // { code, name }
  polling: null,
  chartPoints: [], // [{t, price}]
  baseBalance: 100_000_000,
  cash: 100_000_000,
  contextTarget: null, // {code, name}
};

// -------- Utils --------
function fmtWon(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  return '₩' + n.toLocaleString('ko-KR');
}
function qs(sel) { return document.querySelector(sel); }
function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of children) e.append(c);
  return e;
}
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const res = await fetch(path, { ...opts, headers, credentials: 'include' });
  if (!res.ok) throw new Error(`API ${path} ${res.status}`);
  return res.json();
}
function setCash(n) {
  state.cash = Math.max(0, Math.round(n));
  qs('#cashBalance').textContent = fmtWon(state.cash);
}
function setUser(user) {
  state.user = user;
  qs('#userEmail').textContent = user ? user.email : '비로그인';
  qs('#loginBtn').classList.toggle('hidden', !!user);
  qs('#logoutBtn').classList.toggle('hidden', !user);
  loadFavorites().catch(()=>{});
}

// -------- Auth Modal --------
function openAuth() { qs('#authModal').classList.remove('hidden'); qs('#loginEmail').focus(); }
function closeAuth() { qs('#authModal').classList.add('hidden'); }
function bindAuth() {
  // tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const name = tab.dataset.tab;
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      qs(`#${name === 'login' ? 'loginForm' : 'registerForm'}`).classList.add('active');
    });
  });
  qs('#authClose').addEventListener('click', closeAuth);

  qs('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const email = qs('#loginEmail').value.trim();
      const password = qs('#loginPassword').value;
      const data = await api(API.login, { method: 'POST', body: JSON.stringify({ email, password }) });
      state.token = data.token; localStorage.setItem('token', state.token);
      setUser(data.user); closeAuth();
    } catch (err) {
      alert('로그인 실패: ' + err.message);
    }
  });

  qs('#registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const email = qs('#regEmail').value.trim();
      const password = qs('#regPassword').value;
      const data = await api(API.register, { method: 'POST', body: JSON.stringify({ email, password }) });
      state.token = data.token; localStorage.setItem('token', state.token);
      setUser(data.user); closeAuth();
    } catch (err) {
      alert('회원가입 실패: ' + err.message);
    }
  });

  qs('#loginBtn').addEventListener('click', openAuth);
  qs('#logoutBtn').addEventListener('click', () => {
    state.token = null; localStorage.removeItem('token'); setUser(null);
  });
}

// -------- Search / Favorites --------
function liItem(item, onClick) {
  const li = el('li', { class: 'list-item', 'data-code': item.code, 'data-name': item.name });
  li.append(
    el('div', {}, el('div', { class: 'name' }, item.name), el('div', { class: 'code' }, item.code)),
    el('div', { class: 'code' }, '⋮')
  );
  li.addEventListener('click', () => onClick(item));
  li.addEventListener('contextmenu', (ev) => showContext(ev, item));
  return li;
}

let searchTimer = null;
function bindSearch() {
  const input = qs('#searchInput');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const v = input.value.trim();
      if (!v) return;
      doSearch(v);
    }
  });
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const v = input.value.trim();
      if (!v) return;
      doSearch(v);
    }, 250);
  });
}
async function doSearch(q) {
  try {
    const list = await api(API.search(q));
    const ul = qs('#searchResults');
    ul.innerHTML = '';
    list.forEach(item => ul.append(liItem(item, selectCode)));
  } catch (err) {
    console.error(err);
  }
}
async function loadFavorites() {
  const ul = qs('#favList');
  ul.innerHTML = '';
  if (!state.user) { ul.innerHTML = '<li class="list-item"><div class="code">로그인 필요</div></li>'; return; }
  try {
    const rows = await api(API.favorites);
    rows.forEach(r => ul.append(liItem({ code: r.code, name: r.name || r.code }, selectCode)));
  } catch (e) {
    ul.innerHTML = '<li class="list-item"><div class="code">불러오기 실패</div></li>';
  }
}
async function toggleFavorite(item) {
  if (!state.user) { openAuth(); return; }
  try {
    await api(API.favorites, { method: 'POST', body: JSON.stringify(item) });
    await loadFavorites();
  } catch (e) {
    alert('관심종목 처리 실패');
  }
}

// -------- Quote / Chart --------
function resetChart() { state.chartPoints = []; drawChart(); }
function addChartPoint(price) {
  state.chartPoints.push({ t: Date.now(), price });
  if (state.chartPoints.length > 600) state.chartPoints.shift(); // ~10분(1s polling)
  drawChart();
}
function drawChart() {
  const canvas = qs('#chart'); const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // grid
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = '#1b2230';
  for (let i=1;i<10;i++) {
    const y = (H/10)*i; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  }
  for (let i=1;i<12;i++) {
    const x = (W/12)*i; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const data = state.chartPoints;
  if (data.length < 2) return;
  const min = Math.min(...data.map(p=>p.price));
  const max = Math.max(...data.map(p=>p.price));
  const pad = (max - min) * 0.1 || 1;
  const lo = min - pad, hi = max + pad;

  ctx.beginPath();
  data.forEach((p,i) => {
    const x = (i/(data.length-1)) * (W-20) + 10;
    const y = H - ((p.price - lo) / (hi - lo)) * (H-20) - 10;
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#4fa3ff';
  ctx.stroke();
}

async function fetchQuote(code) {
  const q = await api(API.quote(code));
  if (!q || q.price == null) throw new Error('no price');
  return q;
}
async function fetchNews(code) {
  const items = await api(API.news(code));
  const ul = qs('#newsList');
  ul.innerHTML = '';
  (items || []).forEach(n => {
    const li = el('li', { class: 'news-item' });
    const a = el('a', { href: n.url, target: '_blank', rel: 'noopener' }, n.title || n.url);
    const meta = el('div', { class: 'meta' }, `${n.source || ''} · ${n.time_text || n.time || ''}`);
    li.append(a, meta); ul.append(li);
  });
}

async function selectCode(item) {
  state.selected = item;
  qs('#quoteName').textContent = `${item.name} (${item.code})`;
  resetChart();
  if (state.polling) clearInterval(state.polling);
  const priceEl = qs('#nowPrice');
  const updatedEl = qs('#updatedAt');

  async function tick() {
    try {
      const q = await fetchQuote(item.code);
      priceEl.textContent = q.price.toLocaleString('ko-KR') + ' 원';
      updatedEl.textContent = new Date().toLocaleTimeString('ko-KR');
      addChartPoint(Number(q.price));
    } catch (e) {
      console.error('quote failed', e);
    }
  }
  await tick();
  state.polling = setInterval(tick, 1000);
  fetchNews(item.code).catch(()=>{});
}

// -------- Context Menu --------
function showContext(ev, item) {
  ev.preventDefault();
  state.contextTarget = item || state.selected;
  const menu = qs('#contextMenu');
  menu.style.left = ev.clientX + 'px';
  menu.style.top = ev.clientY + 'px';
  menu.classList.remove('hidden');
}
function hideContext() { qs('#contextMenu').classList.add('hidden'); }
function bindContextMenu() {
  document.addEventListener('click', hideContext);
  window.addEventListener('blur', hideContext);
  qs('#ctxOpenOrder').addEventListener('click', () => { hideContext(); openOrder(state.contextTarget || state.selected); });
  qs('#ctxToggleFav').addEventListener('click', () => { hideContext(); if (state.contextTarget) toggleFavorite(state.contextTarget); });
}

// -------- Order Modal (simulation) --------
function openOrder(item) {
  if (!item) return;
  const m = qs('#orderModal'); m.classList.remove('hidden');
  qs('#orderCode').value = item.code;
  qs('#orderName').value = item.name;
  qs('#orderPrice').value = qs('#nowPrice').textContent.replace(/[^\d]/g, '') || '';
  qs('#orderQty').focus();
}
function closeOrder() { qs('#orderModal').classList.add('hidden'); }
function bindOrder() {
  qs('#orderClose').addEventListener('click', closeOrder);
  qs('#orderBtn').addEventListener('click', () => openOrder(state.selected));

  function execute(side) {
    const price = Number(qs('#orderPrice').value || '0');
    const qty = Math.max(1, Number(qs('#orderQty').value || '1'));
    const notional = price * qty;
    if (side === 'buy') {
      if (notional > state.cash) { alert('가용 현금 부족'); return; }
      setCash(state.cash - notional);
    } else {
      // 매도는 현금 증가 (보유수량 관리는 생략)
      setCash(state.cash + notional);
    }
    closeOrder();
  }
  qs('#buyBtn').addEventListener('click', () => execute('buy'));
  qs('#sellBtn').addEventListener('click', () => execute('sell'));
}

// -------- Shortcuts --------
function bindShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === '?' || (e.shiftKey && e.key === '/')) { alert('[단축키]\\nL: 로그인/가입\\nS: 검색창 포커스\\nO: 주문창\\nA: 관심종목 토글\\nF: 관심종목 패널로 스크롤\\nN: 뉴스 패널로 스크롤'); return; }
    if (e.key.toLowerCase() === 'l') { openAuth(); }
    if (e.key.toLowerCase() === 's') { qs('#searchInput').focus(); e.preventDefault(); }
    if (e.key.toLowerCase() === 'o') { openOrder(state.selected); }
    if (e.key.toLowerCase() === 'a') { if (state.selected) toggleFavorite(state.selected); }
    if (e.key.toLowerCase() === 'f') { document.querySelector('.sidebar .panel:nth-child(2)').scrollIntoView({behavior:'smooth'}); }
    if (e.key.toLowerCase() === 'n') { document.querySelector('.sidebar.right .panel').scrollIntoView({behavior:'smooth'}); }
    if (e.key === 'Escape') { closeAuth(); closeOrder(); hideContext(); }
  });
}

// -------- Init --------
async function init() {
  // base/cash balances
  qs('#baseBalance').textContent = fmtWon(state.baseBalance);
  setCash(state.cash);

  bindAuth();
  bindSearch();
  bindContextMenu();
  bindOrder();
  bindShortcuts();

  // auto-open auth if no token
  if (!state.token) openAuth();
  else {
    try {
      const me = await api(API.me); setUser(me);
    } catch { setUser(null); }
  }

  // preload top list
  try {
    const top = await api(API.top);
    const ul = qs('#searchResults'); ul.innerHTML='';
    top.forEach(item => ul.append(liItem(item, selectCode)));
    if (top[0]) selectCode(top[0]);
  } catch (e) {
    console.error(e);
  }

  // buttons
  qs('#toggleFavBtn').addEventListener('click', () => { if (state.selected) toggleFavorite(state.selected); });
}
window.addEventListener('DOMContentLoaded', init);
