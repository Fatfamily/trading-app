const wlBody = document.querySelector('#wl tbody');
const codeInput = document.getElementById('codeInput');
const chartEl = document.getElementById('chart');
const newsEl = document.getElementById('news');
const pfEl = document.getElementById('pf');
const logEl = document.getElementById('log');
const titleEl = document.getElementById('title');
const qtyEl = document.getElementById('qty');
const sideEl = document.getElementById('side');
let selectedCode = '005930';
let watch = new Set(['005930','000660','035420']);
let showNews = true;

document.addEventListener('keydown', (e)=>{
  if(e.key === '/'){ e.preventDefault(); codeInput.focus(); }
  if(e.key.toLowerCase() === 'b'){ sideEl.value = 'BUY'; placeOrder(); }
  if(e.key.toLowerCase() === 's'){ sideEl.value = 'SELL'; placeOrder(); }
  if(e.key.toLowerCase() === 'n'){ toggleNews(); }
});

codeInput.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter'){
    const v = codeInput.value.trim();
    if(/^\d{6}$/.test(v)){ watch.add(v); selectedCode = v; codeInput.value=''; paintWL(); fetchNews(); }
  }
});

function logout(){ fetch('/api/auth/logout',{method:'POST'}).then(()=>location.href='/login.html'); }

function paintWL(){
  wlBody.innerHTML = '';
  [...watch].forEach(c=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${c}</td><td id="p_${c}">-</td><td id="h_${c}">-</td>`;
    tr.onclick = ()=>{ selectedCode = c; titleEl.textContent = '차트 ' + c; fetchNews(); };
    wlBody.appendChild(tr);
  });
}
paintWL();

// Chart
let line;
const ctx = chartEl.getContext('2d');
line = new Chart(ctx, {
  type: 'line',
  data: { labels: [], datasets: [{ label: '가격', data: [] }]},
  options: { animation:false, responsive:true, maintainAspectRatio:false, scales:{x:{display:false}} }
});

function pushPrice(px){
  const ds = line.data.datasets[0];
  line.data.labels.push('');
  ds.data.push(px);
  if(ds.data.length>240) { ds.data.shift(); line.data.labels.shift(); }
  line.update('none');
}

async function pullPrices(){
  const codes = [...watch].join(',');
  const r = await fetch('/api/price/batch?codes='+codes);
  const j = await r.json();
  Object.keys(j).forEach(c=>{
    const px = j[c].price;
    const el = document.getElementById('p_'+c);
    if(el){ el.textContent = Number(px).toLocaleString(); }
    if(selectedCode === c){ pushPrice(px); }
  });
}

async function fetchNews(){
  if(!showNews) return;
  newsEl.innerHTML = '로딩...';
  try{
    const r = await fetch('/api/news/'+selectedCode);
    const j = await r.json();
    newsEl.innerHTML = j.map(n=>`<div class="news-item"><a target="_blank" href="${n.url}">${n.title}</a> <span class="badge">${n.press||''}</span></div>`).join('');
  } catch(e){
    newsEl.innerHTML = '뉴스 로드 실패';
  }
}

async function refreshPF(){
  try{
    const r = await fetch('/api/sim/portfolio');
    if(!r.ok){ location.href='/login.html'; return; }
    const j = await r.json();
    pfEl.innerHTML = `
      <div>현금: <b>${Number(j.cash).toLocaleString()}</b></div>
      <div>평가액: <b>${Number(j.equity).toLocaleString()}</b></div>
      <div>PnL: <b>${Number(j.pnl).toLocaleString()}</b></div>
    `;
  }catch(e){ /* ignore */ }
}

async function placeOrder(){
  const qty = parseInt(qtyEl.value||'0',10);
  if(!/^\d{6}$/.test(selectedCode) || qty<=0) return;
  try{
    const r = await fetch('/api/sim/order',{method:'POST',headers:{'Content-Type':'application/json'},
      body: JSON.stringify({code:selectedCode, side: sideEl.value, qty})});
    const j = await r.json();
    if(j.ok){ log(`체결 ${sideEl.value} ${selectedCode} x ${qty}`); refreshPF(); }
    else{ log('주문 실패: '+j.msg); }
  }catch(e){ log('에러: '+e.message); }
}

function log(t){
  const now = new Date().toLocaleTimeString();
  logEl.textContent = `[${now}] ${t}\n` + logEl.textContent;
}

function toggleNews(){ showNews = !showNews; if(showNews) fetchNews(); else newsEl.innerHTML='(숨김)'; }

// Loops
setInterval(pullPrices, 1200);
setInterval(refreshPF, 2000);
fetchNews();
refreshPF();
titleEl.textContent = '차트 ' + selectedCode;


// === Enhancements: F-keys, context menu, watchlist ops ===
const ctx = document.getElementById('ctx');
function openCtx(x, y){
  ctx.style.left = x+'px'; ctx.style.top = y+'px'; ctx.style.display='block';
}
function closeCtx(){ ctx.style.display='none'; }
document.addEventListener('click', closeCtx);

function openOrder(){ document.getElementById('qty').focus(); }
function addToWatch(code){ if(!code) return; watch.add(code); renderWatch(); closeCtx(); log(code+' 관심 추가'); }
function removeFromWatch(code){ if(!code) return; watch.delete(code); renderWatch(); closeCtx(); log(code+' 관심 삭제'); }

document.addEventListener('contextmenu', (e)=>{
  const row = e.target.closest('#wl tr');
  if(row){
    e.preventDefault();
    const code = row.dataset.code;
    if(code){ selectedCode = code; titleEl.textContent = '차트 ' + selectedCode; }
    openCtx(e.pageX, e.pageY);
  }
});

document.addEventListener('keydown', (e)=>{
  if(e.key === 'F1'){ e.preventDefault(); openOrder(); }
  if(e.key === 'F6'){ e.preventDefault(); addToWatch(selectedCode); }
  if(e.key === 'F8'){ e.preventDefault(); toggleNews(); }
  if(e.key === 'Delete'){ e.preventDefault(); removeFromWatch(selectedCode); }
});

function renderWatch(){
  wlBody.innerHTML = '';
  for(const code of Array.from(watch)){
    const tr = document.createElement('tr'); tr.dataset.code = code;
    tr.innerHTML = `<td>${code}</td><td id="p_${code}">-</td><td id="q_${code}">-</td>`;
    tr.addEventListener('click', ()=>{ selectedCode=code; titleEl.textContent='차트 '+code; });
    wlBody.appendChild(tr);
  }
}
renderWatch();
