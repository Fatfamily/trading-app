
// Client logic
const API = location.origin.includes('http') ? '' : 'http://localhost:10000';
const POLL_MS = 1200; // 1.2s

const el = (id) => document.getElementById(id);
const state = {
  user: null,
  cash: 100000000, // 1억 초기자산
  watch: [], // {code,name}
  hold: [],  // {code,name,qty,avg}
  current: null, // selected {code,name}
  chart: {
    labels: [],
    data: []
  }
};

// ---- Storage ----
function loadStorage() {
  try {
    const s = JSON.parse(localStorage.getItem('krvx') || '{}');
    Object.assign(state, s);
  } catch {}
}
function saveStorage() {
  localStorage.setItem('krvx', JSON.stringify({
    user: state.user, cash: state.cash, watch: state.watch, hold: state.hold
  }));
}

// ---- UI helpers ----
function formatW(v) {
  return v?.toLocaleString('ko-KR');
}
function setPane(paneId) {
  ['homePane','chartPane','newsPane','helpPane','logPane'].forEach(id => {
    el(id).classList.toggle('hidden', id !== paneId);
  });
}
function log(msg) {
  const li = document.createElement('li');
  li.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el('logList').prepend(li);
}

// ---- Login (local mock) ----
function updateLoginUI() {
  const logged = !!state.user;
  el('btnLogin').classList.toggle('hidden', logged);
  el('btnLogout').classList.toggle('hidden', !logged);
  el('loginId').classList.toggle('hidden', logged);
  el('loginPw').classList.toggle('hidden', logged);
}
el('btnLogin').onclick = () => {
  const id = el('loginId').value.trim();
  const pw = el('loginPw').value.trim();
  if (!id || !pw) { alert('아이디/비밀번호 입력'); return; }
  state.user = { id };
  saveStorage();
  updateLoginUI();
  log(`로그인: ${id}`);
};
el('btnLogout').onclick = () => {
  log(`로그아웃: ${state.user?.id}`);
  state.user = null;
  saveStorage();
  updateLoginUI();
};

// ---- Search ----
async function searchStocks() {
  const q = el('searchInput').value.trim();
  if (!q) return;
  const r = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`).then(r => r.json());
  const box = el('searchResults');
  box.innerHTML = '';
  if (!r || !r.length) {
    box.innerHTML = '<div style="padding:8px;opacity:.7">검색 결과 없음</div>';
    return;
  }
  r.forEach(item => {
    const div = document.createElement('div');
    div.className = 'sr';
    div.textContent = `${item.name} (${item.code})`;
    div.onclick = () => {
      selectStock(item);
      setPane('chartPane');
      box.innerHTML = '';
    };
    // context menu hook
    div.oncontextmenu = (ev) => openContextMenu(ev, item);
    box.appendChild(div);
  });
}

// ---- Top10 ----
async function loadTop10() {
  try {
    const r = await fetch(`${API}/api/top10`).then(r => r.json());
    const tbody = el('top10Table').querySelector('tbody');
    tbody.innerHTML = '';
    r.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${row.code}</td><td>${row.name}</td><td>${formatW(row.price)}</td>`;
      tr.onclick = () => selectStock({ code: row.code, name: row.name });
      tr.oncontextmenu = (ev) => openContextMenu(ev, { code: row.code, name: row.name });
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error(e);
  }
}

// ---- Quote & chart ----
let chart;
function ensureChart() {
  if (chart) return chart;
  const ctx = document.getElementById('priceChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: state.chart.labels,
      datasets: [{
        label: '가격',
        data: state.chart.data,
      }]
    },
    options: { responsive: true, animation:false, scales:{ x:{display:false} } }
  });
  return chart;
}
async function pollQuote() {
  if (!state.current) return;
  try {
    const q = await fetch(`${API}/api/quote?code=${state.current.code}`).then(r => r.json());
    if (!q || !q.price) return;
    el('detailBox').innerHTML = `<b>${q.name}</b> (${q.code})<br/>가격: ${formatW(q.price)}원<br/>변동: ${q.change ?? '-'} (${q.rate ?? '-'}%)`;
    // chart
    const nowLabel = new Date().toLocaleTimeString();
    state.chart.labels.push(nowLabel);
    state.chart.data.push(q.price);
    if (state.chart.labels.length > 150) { state.chart.labels.shift(); state.chart.data.shift(); }
    ensureChart().update();
  } catch (e) {
    console.error('pollQuote', e);
  }
}
setInterval(pollQuote, POLL_MS);

// ---- News ----
async function loadNewsFor(code) {
  const list = await fetch(`${API}/api/news?code=${code}`).then(r => r.json()).catch(() => []);
  const ul = el('newsList');
  ul.innerHTML = '';
  list.forEach(n => {
    const li = document.createElement('li');
    li.innerHTML = `<a href="${n.link}" target="_blank">[${n.press}] ${n.title}</a> <span style="opacity:.7">${n.time||''}</span>`;
    ul.appendChild(li);
  });
}

// ---- Select / Watch / Hold ----
function selectStock(item) {
  state.current = item;
  // prepare chart
  state.chart.labels = [];
  state.chart.data = [];
  ensureChart().update();
  loadNewsFor(item.code);
  renderWatch();
  renderHold();
}
function renderWatch() {
  const ul = el('watchList');
  ul.innerHTML = '';
  state.watch.forEach(w => {
    const li = document.createElement('li');
    li.textContent = `${w.name} (${w.code})`;
    li.onclick = () => selectStock(w);
    li.oncontextmenu = (ev) => openContextMenu(ev, w);
    ul.appendChild(li);
  });
  saveStorage();
}
function renderHold() {
  const ul = el('holdingList');
  ul.innerHTML = '';
  state.hold.forEach(h => {
    const li = document.createElement('li');
    li.textContent = `${h.name} (${h.code}) · ${h.qty}주 · 평단 ${formatW(h.avg)}원`;
    li.onclick = () => selectStock(h);
    li.oncontextmenu = (ev) => openContextMenu(ev, h);
    ul.appendChild(li);
  });
  el('cashBalance').textContent = formatW(state.cash);
  saveStorage();
}
function ensureInWatch(item) {
  if (!state.watch.find(x => x.code === item.code)) {
    state.watch.push({ code: item.code, name: item.name });
  }
  renderWatch();
}
function removeFromWatch(item) {
  state.watch = state.watch.filter(x => x.code !== item.code);
  renderWatch();
}
function buy(item, qty, price) {
  qty = Math.max(1, Math.floor(qty));
  const cost = qty * price;
  if (state.cash < cost) { alert('잔고 부족'); return; }
  state.cash -= cost;
  const ex = state.hold.find(x => x.code === item.code);
  if (ex) {
    const totalQty = ex.qty + qty;
    ex.avg = Math.round((ex.avg * ex.qty + price * qty) / totalQty);
    ex.qty = totalQty;
  } else {
    state.hold.push({ code: item.code, name: item.name, qty, avg: price });
  }
  log(`매수 ${item.name} ${qty}주 @ ${formatW(price)}`);
  renderHold();
}
function sell(item, qty, price) {
  const ex = state.hold.find(x => x.code === item.code);
  if (!ex || ex.qty <= 0) { alert('보유 수량 없음'); return; }
  qty = Math.max(1, Math.min(ex.qty, Math.floor(qty)));
  const proceeds = qty * price;
  state.cash += proceeds;
  ex.qty -= qty;
  if (ex.qty === 0) {
    state.hold = state.hold.filter(x => x.code !== item.code);
  }
  log(`매도 ${item.name} ${qty}주 @ ${formatW(price)}`);
  renderHold();
}

// ---- Trading buttons ----
async function currentPrice() {
  if (!state.current) return null;
  const q = await fetch(`${API}/api/quote?code=${state.current.code}`).then(r => r.json()).catch(()=>null);
  return q?.price || null;
}
el('btnBuy').onclick = async () => {
  const p = await currentPrice(); if (!p) return;
  const qty = Number(el('tradeQty').value || 1);
  buy(state.current, qty, p);
};
el('btnBuyAll').onclick = async () => {
  const p = await currentPrice(); if (!p) return;
  const maxQty = Math.max(0, Math.floor(state.cash / p));
  if (maxQty <= 0) { alert('잔고 부족'); return; }
  buy(state.current, maxQty, p);
};
el('btnSell').onclick = async () => {
  const p = await currentPrice(); if (!p) return;
  const qty = Number(el('tradeQty').value || 1);
  sell(state.current, qty, p);
};
el('btnSellAll').onclick = async () => {
  const p = await currentPrice(); if (!p) return;
  const ex = state.hold.find(x => x.code === state.current.code);
  if (!ex) return;
  sell(state.current, ex.qty, p);
};

// ---- Context menu ----
const menu = document.getElementById('stockMenu');
let menuTarget = null;
function openContextMenu(ev, item) {
  ev.preventDefault();
  menuTarget = item;
  menu.style.left = ev.pageX + 'px';
  menu.style.top = ev.pageY + 'px';
  menu.classList.remove('hidden');
}
document.body.addEventListener('click', () => menu.classList.add('hidden'));
menu.addEventListener('click', (e) => {
  const act = e.target.getAttribute('data-act');
  if (!act || !menuTarget) return;
  if (act === 'watchAdd') ensureInWatch(menuTarget);
  if (act === 'watchRemove') removeFromWatch(menuTarget);
  if (['buy','buyAll','sell','sellAll'].includes(act)) {
    selectStock(menuTarget);
    setPane('chartPane');
    (async () => {
      const p = await currentPrice(); if (!p) return;
      if (act === 'buy') buy(menuTarget, Number(el('tradeQty').value || 1), p);
      if (act === 'buyAll') buy(menuTarget, Math.max(1, Math.floor(state.cash / p)), p);
      if (act === 'sell') sell(menuTarget, Number(el('tradeQty').value || 1), p);
      if (act === 'sellAll') {
        const ex = state.hold.find(x => x.code === menuTarget.code);
        if (ex) sell(menuTarget, ex.qty, p);
      }
    })();
  }
  menu.classList.add('hidden');
});

// ---- Shortcuts ----
window.addEventListener('keydown', (e) => {
  if (e.key === 'F1') { e.preventDefault(); setPane('helpPane'); }
  if (e.key === 'F2') { setPane('homePane'); }
  if (e.key === 'F3') { setPane('chartPane'); }
  if (e.key === 'F4') { el('watchList').scrollIntoView({behavior:'smooth'}); }
  if (e.key === 'F5') { el('holdingList').scrollIntoView({behavior:'smooth'}); }
  if (e.key === 'F6') { setPane('logPane'); }
  if (e.key === 'F7') { setPane('chartPane'); }
  if (e.key === 'F8') { setPane('newsPane'); }
});

// ---- Init ----
async function init() {
  loadStorage();
  updateLoginUI();
  renderWatch();
  renderHold();
  await loadTop10();
  setPane('homePane');
}
init();

// events
el('btnSearch').onclick = searchStocks;
el('searchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') searchStocks(); });
