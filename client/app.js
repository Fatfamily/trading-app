const api = {
  async search(q){ const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`); return r.json(); },
  async top(market='KOSPI'){ const r = await fetch(`/api/top?market=${market}`); return r.json(); },
  async quote(code){ const r = await fetch(`/api/quote?code=${code}`); return r.json(); },
  async news(code){ const r = await fetch(`/api/news?code=${code}`); return r.json(); },
};

// State (stored in localStorage)
const S = {
  get balance(){ return Number(localStorage.getItem('balance') || 100000000); },
  set balance(v){ localStorage.setItem('balance', String(v)); renderBalance(); },
  get favs(){ try { return JSON.parse(localStorage.getItem('favs')||'[]'); } catch { return []; } },
  set favs(v){ localStorage.setItem('favs', JSON.stringify(v)); renderFavs(); },
  get holds(){ try { return JSON.parse(localStorage.getItem('holds')||'{}'); } catch { return {}; } },
  set holds(v){ localStorage.setItem('holds', JSON.stringify(v)); renderHolds(); },
  get logs(){ try { return JSON.parse(localStorage.getItem('logs')||'[]'); } catch { return []; } },
  set logs(v){ localStorage.setItem('logs', JSON.stringify(v)); renderLogs(); },
  addLog(msg){ const arr = S.logs; arr.unshift(`[${new Date().toLocaleString()}] ${msg}`); S.logs = arr.slice(0,200); },
};

// UI elements
const $search = document.getElementById('search');
const $dropdown = document.getElementById('searchResults');
const $topList = document.getElementById('topList');
const $favList = document.getElementById('favList');
const $holdList = document.getElementById('holdList');
const $selectedInfo = document.getElementById('selectedInfo');
const $balance = document.getElementById('balance');
const $logBox = document.getElementById('logBox');
const $newsList = document.getElementById('newsList');
const $views = {
  home: document.getElementById('homeView'),
  chart: document.getElementById('chartView'),
  news: document.getElementById('newsView'),
};
const $ctx = document.getElementById('ctx');
let ctxTarget = null;
let selected = null;
let chart, chartData = [];

// Renderers
function renderBalance(){ $balance.textContent = '₩ ' + S.balance.toLocaleString(); }
function liHTML(item, extra=''){ return `<li data-code="${item.code}" data-name="${item.name}"><span>${item.name}</span><span class="badge">${item.code}${extra}</span></li>`; }

function renderTop(list){
  $topList.innerHTML = list.map(x=> liHTML(x, x.price? ` · ${x.price?.toLocaleString()}원` : '')).join('');
}
function renderFavs(){
  const arr = S.favs; $favList.innerHTML = arr.map(liHTML).join('');
}
function renderHolds(){
  const holds = S.holds;
  const items = Object.entries(holds).map(([code, v]) => ({code, name:v.name, qty:v.qty}));
  $holdList.innerHTML = items.map(x=> liHTML(x, ` · ${x.qty}주`)).join('');
}
function renderLogs(){ $logBox.innerHTML = (S.logs||[]).map(x=> `<div class="small">${x}</div>`).join(''); }

function showView(name){
  Object.values($views).forEach(v=>v.classList.remove('active'));
  if (name==='chart') $views.chart.classList.add('active');
  else if (name==='news') $views.news.classList.add('active');
  else $views.home.classList.add('active');
}

// Context menu
document.body.addEventListener('contextmenu', (e)=>{
  const li = e.target.closest('li[data-code]');
  if (!li) return;
  e.preventDefault();
  ctxTarget = { code: li.dataset.code, name: li.dataset.name };
  $ctx.style.left = e.pageX+'px'; $ctx.style.top = e.pageY+'px';
  $ctx.style.display = 'block';
});
document.body.addEventListener('click', ()=>{ $ctx.style.display='none'; });

$ctx.addEventListener('click', (e)=>{
  const act = e.target.getAttribute('data-act');
  if (!act || !ctxTarget) return;
  if (act==='fav'){
    const exists = S.favs.find(x=>x.code===ctxTarget.code);
    if (exists) S.favs = S.favs.filter(x=>x.code!==ctxTarget.code);
    else { const newFavs = S.favs; newFavs.push({code:ctxTarget.code, name:ctxTarget.name}); S.favs = newFavs; }
    S.addLog(`${ctxTarget.name} 관심종목 ${exists?'해제':'등록'}`);
  } else if (act==='buy' || act==='buyall' || act==='sell' || act==='sellall'){
    trade(act, ctxTarget);
  }
  $ctx.style.display='none';
});

async function trade(act, item){
  const q = await api.quote(item.code).catch(()=>null);
  if (!q || !q.price){ alert('호가 조회 실패'); return; }
  const price = q.price;
  let qty = 0;
  if (act==='buy'){
    const n = Number(prompt('매수 수량입력', '10')||'0');
    qty = Math.max(0, Math.floor(n));
  } else if (act==='buyall'){
    qty = Math.floor(S.balance / price);
  } else if (act==='sell'){
    const holds = S.holds[item.code]?.qty||0;
    const n = Number(prompt(`매도 수량입력 (보유: ${holds}주)`, String(holds))||'0');
    qty = Math.min(holds, Math.max(0, Math.floor(n)));
  } else if (act==='sellall'){
    qty = S.holds[item.code]?.qty||0;
  }
  if (!qty) return;
  const cost = qty * price;
  const holds = {...S.holds};
  if (act.startsWith('buy')){
    if (S.balance < cost){ alert('잔고 부족'); return; }
    S.balance = S.balance - cost;
    const cur = holds[item.code] || { qty:0, name:item.name, avg:0 };
    const newQty = cur.qty + qty;
    const newAvg = (cur.avg*cur.qty + cost) / newQty;
    holds[item.code] = { name:item.name, qty:newQty, avg: newAvg };
    S.holds = holds;
    S.addLog(`${item.name} ${qty}주 매수 @ ${price.toLocaleString()}원`);
  } else {
    const cur = holds[item.code] || { qty:0, name:item.name, avg:0 };
    if (cur.qty < qty){ alert('보유 수량 부족'); return; }
    const proceeds = qty * price;
    S.balance = S.balance + proceeds;
    const newQty = cur.qty - qty;
    if (newQty === 0) delete holds[item.code];
    else holds[item.code] = { ...cur, qty: newQty };
    S.holds = holds;
    S.addLog(`${item.name} ${qty}주 매도 @ ${price.toLocaleString()}원`);
  }
}

// Select item
async function selectItem(item){
  selected = item;
  showView('home');
  document.getElementById('selectedInfo').innerHTML = `
    <div><b>${item.name}</b> <span class="small">${item.code}</span></div>
    <div id="selPrice" class="price">-</div>
    <div id="selChange" class="small">-</div>
  `;
  loadNews(item.code);
  startQuoteLoop(item.code);
  startChart(item);
}

async function loadTop(){
  const list = await api.top('KOSPI').catch(()=>[]);
  renderTop(list);
}
async function loadNews(code){
  const arr = await api.news(code).catch(()=>[]);
  $newsList.innerHTML = arr.map(n=> `<li><a href="${n.link}" target="_blank">${n.title}</a> <span class="small">${n.date}</span></li>`).join('');
}

function startChart(item){
  const ctx = document.getElementById('chart');
  chartData = [];
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: item.name, data: [] }] },
    options: {
      animation: false,
      responsive: true,
      plugins: { legend: { display:false } },
      scales: { x: { ticks:{ color:'#9bb0d3'} }, y:{ ticks:{ color:'#9bb0d3'} } }
    }
  });
  showView('chart');
}

// Polling per second
let quoteTimer = null;
function startQuoteLoop(code){
  if (quoteTimer) clearInterval(quoteTimer);
  const update = async ()=>{
    const q = await api.quote(code).catch(()=>null);
    if (!q) return;
    const p = document.getElementById('selPrice');
    const c = document.getElementById('selChange');
    if (p) p.textContent = q.price ? q.price.toLocaleString() + '원' : '-';
    if (c) c.textContent = (q.change??0).toLocaleString() + ' ( ' + (q.changePct??0) + ' % )  ' + (q.time||'');
    // chart
    if (chart){
      const now = new Date();
      chart.data.labels.push(now.toLocaleTimeString());
      chart.data.datasets[0].data.push(q.price||null);
      if (chart.data.labels.length > 120){ chart.data.labels.shift(); chart.data.datasets[0].data.shift(); }
      chart.update();
    }
  };
  update();
  quoteTimer = setInterval(update, 1000);
}

// Search box
let searchTimer;
$search.addEventListener('input', async (e)=>{
  const q = e.target.value.trim();
  clearTimeout(searchTimer);
  if (!q){ $dropdown.style.display='none'; return; }
  searchTimer = setTimeout(async ()=>{
    const res = await api.search(q).catch(()=>[]);
    if (!res.length){ $dropdown.style.display='none'; return; }
    $dropdown.innerHTML = res.map(r=> `<div class="item" data-code="${r.code}" data-name="${r.name}">${r.name} <span class="small">(${r.market})</span></div>`).join('');
    $dropdown.style.display='block';
  }, 200);
});
$dropdown.addEventListener('click', (e)=>{
  const item = e.target.closest('.item'); if (!item) return;
  $dropdown.style.display='none';
  selectItem({ code:item.dataset.code, name:item.dataset.name });
});

// Lists click
function listClick(e){
  const li = e.target.closest('li[data-code]'); if (!li) return;
  selectItem({ code: li.dataset.code, name: li.dataset.name });
}
$topList.addEventListener('click', listClick);
$favList.addEventListener('click', listClick);
$holdList.addEventListener('click', listClick);

// F-keys
document.addEventListener('keydown', (e)=>{
  if (e.key==='F1'){ e.preventDefault(); document.getElementById('help').style.display='flex'; }
  if (e.key==='F2'){ showView('home'); }
  if (e.key==='F3' || e.key==='F7'){ showView('chart'); }
  if (e.key==='F4'){ document.getElementById('favList').scrollIntoView({behavior:'smooth'}); }
  if (e.key==='F5'){ document.getElementById('holdList').scrollIntoView({behavior:'smooth'}); }
  if (e.key==='F6'){ document.getElementById('logBox').scrollIntoView({behavior:'smooth'}); }
  if (e.key==='F8'){ showView('news'); }
});
document.getElementById('helpClose').onclick = ()=> document.getElementById('help').style.display='none';

// Initial render
renderBalance(); renderFavs(); renderHolds(); renderLogs();
loadTop();
