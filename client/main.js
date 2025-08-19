const API = '';// same-origin
let token = localStorage.getItem('token') || '';

const el = s => document.querySelector(s);
const topList = el('#topList');
const watchList = el('#watchList');
const cashEl = el('#cash');
const holdingsEl = el('#holdings');
const quoteBox = el('#quoteBox');
const newsBox = el('#news');
const searchInput = el('#searchInput');
const searchResults = el('#searchResults');
const ctx = el('#ctx');

let current = null; // {code, name}
let quotesCache = new Map(); // code -> last quote

async function api(path, opts={}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API + path, { credentials:'include', headers, ...opts });
  const data = await res.json().catch(()=>({ ok:false, error:'BAD_JSON'}));
  if (!data.ok) throw new Error(data.error || 'API_ERROR');
  return data.data;
}

// auth
async function register() {
  const email = el('#email').value.trim();
  const password = el('#password').value;
  const data = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password })});
  token = data.token; localStorage.setItem('token', token);
  el('#userEmail').textContent = data.user.email;
  await loadAll();
}
async function login() {
  const email = el('#email').value.trim();
  const password = el('#password').value;
  const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password })});
  token = data.token; localStorage.setItem('token', token);
  el('#userEmail').textContent = data.user.email;
  await loadAll();
}

el('#registerBtn').addEventListener('click', register);
el('#loginBtn').addEventListener('click', login);

// search
let searchTimer = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const q = searchInput.value.trim();
    if (!q) { searchResults.style.display='none'; return; }
    try {
      const list = await api('/api/stocks/search?q=' + encodeURIComponent(q));
      searchResults.innerHTML = '';
      list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item';
        div.textContent = `${item.name} (${item.code})`;
        div.addEventListener('click', () => {
          pickSymbol(item);
          searchResults.style.display='none';
        });
        searchResults.appendChild(div);
      });
      searchResults.style.display = list.length ? 'block' : 'none';
    } catch (e) {
      searchResults.style.display='none';
    }
  }, 250);
});

function pickSymbol(item) {
  current = item;
  updateQuoteBox();
  loadNews(item.code);
}

async function loadTop() {
  const list = await api('/api/stocks/top');
  topList.innerHTML = '';
  list.forEach(item => {
    const li = document.createElement('li');
    li.textContent = `${item.name} ${fmtPrice(item.price)} (${fmtRate(item.changeRate)})`;
    li.dataset.code = item.code;
    li.dataset.name = item.name;
    li.addEventListener('click', () => pickSymbol({code:item.code, name:item.name}));
    attachContext(li);
    topList.appendChild(li);
    if (item.code) quotesCache.set(item.code, item);
  });
}

async function loadWatch() {
  if (!token) { watchList.innerHTML='<li>로그인 필요</li>'; return;}
  const list = await api('/api/watchlist');
  watchList.innerHTML='';
  if (!list.length) watchList.innerHTML='<li>관심종목 없음</li>';
  list.forEach(item => {
    const li = document.createElement('li');
    li.textContent = `${item.name} (${item.code})`;
    li.dataset.code = item.code;
    li.dataset.name = item.name;
    li.addEventListener('click', () => pickSymbol(item));
    attachContext(li);
    watchList.appendChild(li);
  });
}

async function loadPortfolio() {
  if (!token) { cashEl.textContent='-'; holdingsEl.innerHTML=''; return; }
  const p = await api('/api/portfolio');
  cashEl.textContent = '현금: ' + fmtPrice(p.cash);
  holdingsEl.innerHTML = '';
  (p.holdings || []).forEach(h => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${h.name}</td><td>${h.quantity}</td><td>${fmtPrice(h.avg_price)}</td>`;
    holdingsEl.appendChild(tr);
  });
}

function fmtPrice(v) {
  if (v === undefined || v === null) return '-';
  return Number(v).toLocaleString('ko-KR');
}
function fmtRate(r) {
  if (r === undefined || r === null) return '-';
  const n = Number(r);
  const s = n > 0 ? '+' : '';
  return s + n.toFixed(2) + '%';
}

let chart = null;
function ensureChart() {
  if (chart) return chart;
  const ctx = document.getElementById('chart');
  chart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: '가격', data: [] }] },
    options: { animation:false, scales:{x:{display:false}} }
  });
  return chart;
}

async function updateQuoteBox() {
  if (!current) return;
  const code = current.code;
  const q = await api('/api/stocks/quotes?codes=' + code);
  const d = q[0];
  quotesCache.set(code, d);
  quoteBox.textContent = `${current.name} ${fmtPrice(d.price)} (${fmtRate(d.changeRate)})`;
  // chart push
  const c = ensureChart();
  const now = new Date();
  c.data.labels.push(now.toLocaleTimeString('ko-KR'));
  c.data.datasets[0].data.push(d.price);
  if (c.data.labels.length > 60) { c.data.labels.shift(); c.data.datasets[0].data.shift(); }
  c.update();
}

async function loadNews(code) {
  const list = await api('/api/stocks/news?code=' + code);
  newsBox.innerHTML = list.map(n => `<div class="item"><a target="_blank" href="${n.link}">${n.title}</a> <span style="opacity:.6">${n.press}</span></div>`).join('');
}

// right click context
function attachContext(li) {
  li.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const code = li.dataset.code, name = li.dataset.name;
    current = { code, name };
    showCtx(e.pageX, e.pageY, current);
  });
}
function showCtx(x,y,item) {
  ctx.style.left = x + 'px';
  ctx.style.top  = y + 'px';
  ctx.classList.remove('hidden');
  ctx.dataset.code = item.code;
  ctx.dataset.name = item.name;
}
document.addEventListener('click', () => ctx.classList.add('hidden'));
ctx.addEventListener('click', async (e) => {
  const act = e.target.dataset.act;
  const code = ctx.dataset.code, name = ctx.dataset.name;
  if (!act || !code) return;
  try {
    if (act === 'watch') {
      await api('/api/watchlist', { method:'POST', body: JSON.stringify({ code, name }) });
      await loadWatch();
    } else if (act === 'unwatch') {
      await fetch('/api/watchlist/' + code, { method:'DELETE', headers: token?{ 'Authorization':'Bearer '+token }:{} });
      await loadWatch();
    } else if (act === 'buy' || act === 'sell' || act === 'buyAll' || act === 'sellAll') {
      if (!token) { alert('로그인 필요'); return; }
      let qty = 1;
      if (act === 'buyAll' || act === 'sellAll') {
        // approximate all-in: use cash or holdings
        if (act === 'buyAll') {
          const p = await api('/api/portfolio');
          const q = await api('/api/stocks/quotes?codes=' + code);
          const price = q[0]?.price || 0;
          qty = Math.max(1, Math.floor(p.cash / price));
        } else {
          // sell all
          const p = await api('/api/portfolio');
          const h = (p.holdings || []).find(x => x.code === code);
          qty = h ? Number(h.quantity) : 0;
          if (qty <= 0) return;
        }
      } else {
        const s = prompt('수량 입력', '1');
        qty = Number(s);
        if (!Number.isFinite(qty) || qty <= 0) return;
      }
      const side = (act.startsWith('buy') ? 'BUY' : 'SELL');
      await api('/api/order', { method:'POST', body: JSON.stringify({ code, name, side, quantity: qty }) });
      await loadPortfolio();
      alert('체결 완료');
    }
  } catch (err) {
    alert('오류: ' + err.message);
  } finally {
    ctx.classList.add('hidden');
  }
});

// quote loop (1.2s)
setInterval(async () => {
  try {
    // update selection
    if (current) await updateQuoteBox();
    // refresh top quotes displayed text
    const codes = Array.from(new Set(
      Array.from(topList.querySelectorAll('li')).map(li => li.dataset.code).filter(Boolean)
    ));
    if (codes.length) {
      const list = await api('/api/stocks/quotes?codes=' + codes.join(','));
      const map = new Map(list.map(x => [x.code, x]));
      topList.querySelectorAll('li').forEach(li => {
        const q = map.get(li.dataset.code);
        if (q) li.textContent = `${li.dataset.name} ${fmtPrice(q.price)} (${fmtRate(q.changeRate)})`;
      });
    }
  } catch (_) {}
}, 1200);

// initial
async function loadAll() {
  await loadTop();
  await loadWatch();
  await loadPortfolio();
}
loadAll();
