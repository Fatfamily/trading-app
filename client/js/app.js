const api = (path, opts={}) => fetch(`/api${path}`, { credentials:'include', headers:{'Content-Type':'application/json'}, ...opts }).then(r=>r.json());

const qs = (s, r=document)=>r.querySelector(s);
const qsa = (s, r=document)=>Array.from(r.querySelectorAll(s));
const state = {
  user: null,
  watch: new Set(),
  topSymbols: [],
  lastQuotes: {},
};

const tabs = ['help','home','chart','watchlist','positions','logs','asset','news'];
function activate(tab){
  tabs.forEach(t=>qs('#tab-'+t).classList.remove('active'));
  qs('#tab-'+tab).classList.add('active');
}
qsa('.nav').forEach(btn=>btn.addEventListener('click',()=>activate(btn.dataset.tab)));

// Hotkeys
window.addEventListener('keydown', (e)=>{
  const map = {F1:'help',F2:'home',F3:'chart',F4:'watchlist',F5:'positions',F6:'logs',F7:'asset',F8:'news'};
  if (map[e.key]){ e.preventDefault(); activate(map[e.key]); }
});

// Auth
async function ensureAuth(){
  if(state.user) return true;
  const username = prompt('아이디 입력 (새로 입력하면 회원가입)');
  if(!username) return false;
  const password = prompt('비밀번호 입력');
  if(!password) return false;
  // try login
  let res = await api('/auth/login',{method:'POST',body:JSON.stringify({username,password})});
  if(res.error==='INVALID_CREDENTIALS'){
    res = await api('/auth/register',{method:'POST',body:JSON.stringify({username,password})});
  }
  if(res.user){
    state.user = res.user;
    qs('#usernameLabel').textContent = `${state.user.username}`;
    updateBalance();
    return true;
  } else {
    alert('로그인 실패');
    return false;
  }
}
qs('#loginBtn').addEventListener('click', ensureAuth);
qs('#logoutBtn').addEventListener('click', async ()=>{
  await api('/auth/logout',{method:'POST'}); state.user=null; qs('#usernameLabel').textContent='로그아웃 상태'; updateBalance(true);
});
qs('#resetBtn').addEventListener('click', async ()=>{
  if(confirm('정말 초기화(계정삭제) 하시겠습니까?')){
    await api('/auth/reset',{method:'POST'}); state.user=null; location.reload();
  }
});

function updateBalance(clear){ qs('#balanceLabel').textContent = clear? '잔고: -' : `잔고: ${Number(state.user?.balance||0).toLocaleString()}원`; }

// Top list
async function loadTop(){
  if(!state.user && !(await ensureAuth())) return;
  const data = await api('/stocks/top');
  const tbody = qs('#topTable tbody'); tbody.innerHTML='';
  state.topSymbols = [];
  const quotes = data.quotes || {};
  Object.keys(quotes).forEach(sym=>{
    const q = quotes[sym];
    state.lastQuotes[sym]=q;
    state.topSymbols.push(sym);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${q.symbol}</td><td>${q.name}</td><td>${q.price ?? '-'}</td><td>${q.currency||''}</td>`;
    tr.addEventListener('click', (ev)=>openMenu(ev, q));
    tbody.appendChild(tr);
  });
}
loadTop();
setInterval(loadTop, 3000);

// Watchlist & context menu
const menu = qs('#contextMenu');
let menuTarget = null;
function openMenu(ev, quote){
  menuTarget = quote;
  menu.style.display='block';
  const x=ev.pageX, y=ev.pageY; menu.style.left=x+'px'; menu.style.top=y+'px';
}
window.addEventListener('click',()=>menu.style.display='none');

qsa('#contextMenu button').forEach(btn=>btn.addEventListener('click', async ()=>{
  if(!menuTarget) return;
  const act = btn.dataset.action;
  if(act==='watch'){
    state.watch.add(menuTarget.symbol);
    renderWatch();
  } else if(act==='buy'){
    const q = Number(prompt('매수 수량?'));
    if(q>0) await placeOrder(menuTarget,'BUY',q);
  } else if(act==='sell'){
    const q = Number(prompt('매도 수량?'));
    if(q>0) await placeOrder(menuTarget,'SELL',q);
  } else if(act==='fullbuy'){
    await placeOrder(menuTarget,'BUY',0,'FULL_BUY');
  } else if(act==='fullsell'){
    await placeOrder(menuTarget,'SELL',0,'FULL_SELL');
  }
}));

async function placeOrder(q,s,qty,mode){
  if(!state.user && !(await ensureAuth())) return;
  const res = await api('/stocks/order',{method:'POST',body:JSON.stringify({symbol:q.symbol,name:q.name,side:s,quantity:qty,mode})});
  if(res.ok){ alert('주문 체결'); refreshPositions(); loadLogs(); } else { alert('실패: '+(res.error||'ERROR')); }
}

// Search
qs('#searchBtn').addEventListener('click', async ()=>{
  const key = qs('#searchInput').value.trim();
  if(!key) return;
  if(!state.user && !(await ensureAuth())) return;
  const data = await api('/stocks/quote?symbols='+encodeURIComponent(key));
  const q = (data.quotes && data.quotes[key]) || Object.values(data.quotes||{})[0];
  if(!q){ alert('종목 없음'); return; }
  state.lastQuotes[q.symbol]=q;
  openMenu({pageX:window.innerWidth/2,pageY:200}, q);
});

// Positions
async function refreshPositions(){
  if(!state.user) return;
  const data = await api('/stocks/positions');
  const tbody = qs('#posTable tbody'); tbody.innerHTML='';
  (data.positions||[]).forEach(p=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.symbol}</td><td>${p.name}</td><td>${p.quantity}</td>`;
    tr.addEventListener('click', (ev)=>openMenu(ev, state.lastQuotes[p.symbol] || {symbol:p.symbol, name:p.name, price:null}));
    tbody.appendChild(tr);
  });
}
setInterval(refreshPositions, 5000);

// Logs
async function loadLogs(){
  if(!state.user) return;
  const data = await api('/stocks/logs');
  const tbody = qs('#logTable tbody'); tbody.innerHTML='';
  (data.logs||[]).forEach(l=>{
    const tr = document.createElement('tr');
    const dt = new Date(l.created_at).toLocaleString();
    tr.innerHTML = `<td>${dt}</td><td>${l.side}</td><td>${l.symbol}</td><td>${l.name}</td><td>${l.price}</td><td>${l.quantity}</td>`;
    tbody.appendChild(tr);
  });
}
setInterval(loadLogs, 5000);

// Watch render
function renderWatch(){
  const ul = qs('#watchList'); ul.innerHTML='';
  Array.from(state.watch).forEach(sym=>{
    const li = document.createElement('li');
    const q = state.lastQuotes[sym];
    li.textContent = q ? `${sym} (${q.name}) - ${q.price}` : sym;
    ul.appendChild(li);
  });
}

// Charts (demo random walk)
function drawChart(canvasId){
  const c = qs('#'+canvasId);
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);
  ctx.beginPath();
  const base = 200; let val = base;
  for(let x=0;x<c.width;x+=5){
    val += (Math.random()-0.5)*5;
    const y = c.height - (val);
    if(x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 2;
  ctx.stroke();
}
setInterval(()=>{ drawChart('chartCanvas'); drawChart('assetCanvas'); }, 2000);

// Init
(async function init(){
  activate('home');
  await ensureAuth();
  updateBalance();
  await loadTop();
  await refreshPositions();
  await loadLogs();
  // News
  const news = await api('/stocks/news');
  const ul = qs('#newsList'); ul.innerHTML='';
  (news.news||[]).forEach(n=>{
    const li = document.createElement('li');
    li.innerHTML = `<a href="${n.link}" target="_blank">${n.title}</a> <small>${n.source||''}</small>`;
    ul.appendChild(li);
  });
})();
