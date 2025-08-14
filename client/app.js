const API = {
  async getTop(){ return (await fetch('/api/top')).json(); },
  async search(q){ return (await fetch('/api/search?q='+encodeURIComponent(q))).json(); },
  async quotes(symbols){ return (await fetch('/api/quotes?symbols='+symbols.join(','))).json(); },
  async news(symbol){ return (await fetch('/api/news/'+symbol)).json(); },
  async register(email,password,displayName){
    const r = await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,displayName})});
    return r.json();
  },
  async login(email,password){
    const r = await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    return r.json();
  },
  async reset(token){
    const r = await fetch('/api/account/reset',{method:'POST',headers:{'Authorization':'Bearer '+token}});
    return r.json();
  },
  async watchlist(token){
    const r = await fetch('/api/watchlist',{headers:{'Authorization':'Bearer '+token}});
    return r.json();
  },
  async addWatch(token, symbol, name_kr){
    const r = await fetch('/api/watchlist',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({symbol,name_kr})});
    return r.json();
  },
  async delWatch(token, symbol){
    const r = await fetch('/api/watchlist/'+symbol,{method:'DELETE',headers:{'Authorization':'Bearer '+token}});
    return r.json();
  },
  async portfolio(token){
    const r = await fetch('/api/portfolio',{headers:{'Authorization':'Bearer '+token}});
    return r.json();
  },
  async order(token, payload){
    const r = await fetch('/api/order',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(payload)});
    return r.json();
  }
};

const els = {
  topList: document.getElementById('topList'),
  watchList: document.getElementById('watchList'),
  portList: document.getElementById('portList'),
  newsList: document.getElementById('newsList'),
  searchInput: document.getElementById('searchInput'),
  searchBtn: document.getElementById('searchBtn'),
  searchResults: document.getElementById('searchResults'),
  chart: document.getElementById('chartArea'),
  buyBtn: document.getElementById('buyBtn'),
  buyAllBtn: document.getElementById('buyAllBtn'),
  sellBtn: document.getElementById('sellBtn'),
  sellAllBtn: document.getElementById('sellAllBtn'),
  loginBtn: document.getElementById('loginBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  userName: document.getElementById('userName'),
  cash: document.getElementById('cash'),
  logList: document.getElementById('logList'),
  ctxMenu: document.getElementById('ctxMenu'),
  loginModal: document.getElementById('loginModal'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  displayName: document.getElementById('displayName'),
  doLogin: document.getElementById('doLogin'),
  doRegister: document.getElementById('doRegister'),
  closeModal: document.getElementById('closeModal')
};

let state = {
  token: null,
  user: null,
  selected: { symbol: '005930', name_kr: '삼성전자' },
  view: 'home', // home, chart, news
  pollHandle: null
};

function setToken(token, user){
  state.token = token;
  state.user = user;
  els.userName.textContent = user ? user.displayName : '로그인 안됨';
  els.loginBtn.style.display = user ? 'none' : 'inline-block';
  els.logoutBtn.style.display = user ? 'inline-block' : 'none';
}

function li(line){
  const el = document.createElement('li');
  el.innerHTML = `<span>${line.left}</span><span>${line.right||''}</span>`;
  el.dataset.symbol = line.symbol || '';
  el.dataset.name = line.name || '';
  return el;
}

function showCtx(x,y, symbol, name){
  const menu = els.ctxMenu;
  menu.style.left = x+'px'; menu.style.top = y+'px';
  menu.style.display = 'block';
  menu.dataset.symbol = symbol;
  menu.dataset.name = name;
}
document.body.addEventListener('click', ()=> els.ctxMenu.style.display = 'none');

// Context menu actions
els.ctxMenu.addEventListener('click', async (e)=>{
  const act = e.target.dataset.action;
  const symbol = els.ctxMenu.dataset.symbol;
  const name = els.ctxMenu.dataset.name;
  if (!act || !symbol) return;
  if (!state.token){ alert('로그인 필요'); return; }
  if (act==='watch-add'){ await API.addWatch(state.token, symbol, name); loadWatch(); }
  if (act==='watch-remove'){ await API.delWatch(state.token, symbol); loadWatch(); }
  if (act==='buy'){ await doOrder('BUY', 1); }
  if (act==='buy-all'){ await doBuyAll(); }
  if (act==='sell'){ await doOrder('SELL', 1); }
  if (act==='sell-all'){ await doSellAll(); }
  els.ctxMenu.style.display='none';
});

// Orders
async function doOrder(side, qty){
  const sel = state.selected;
  const r = await API.order(state.token, { symbol: sel.symbol, name_kr: sel.name_kr, side, quantity: qty });
  if (r.error){ alert(r.error); return; }
  log(`${sel.name_kr} ${side==='BUY'?'매수':'매도'} 체결가 ${r.filledPrice.toLocaleString()}원 x ${qty}`);
  loadPortfolio();
}
async function doBuyAll(){
  const pf = await API.portfolio(state.token);
  const cash = pf.cash || 0;
  const [q] = await API.quotes([state.selected.symbol]);
  if (!q || !q.price) return alert('시세 오류');
  const qty = Math.floor(cash / q.price);
  if (qty<=0) return alert('현금 부족');
  return doOrder('BUY', qty);
}
async function doSellAll(){
  // sell all quantity held
  const pf = await API.portfolio(state.token);
  const pos = (pf.positions||[]).find(p=>p.symbol===state.selected.symbol);
  const qty = Math.floor(Number(pos?.quantity||0));
  if (qty<=0) return alert('보유수량 없음');
  return doOrder('SELL', qty);
}

// Poll Quotes
async function startPolling(){
  if (state.pollHandle) clearInterval(state.pollHandle);
  async function tick(){
    try {
      const top = await API.getTop();
      renderList(els.topList, top);
      if (state.token){
        const wl = await API.watchlist(state.token);
        const syms = wl.map(w=>w.symbol);
        if (syms.length){
          const quotes = await API.quotes(syms);
          renderList(els.watchList, quotes);
        } else {
          els.watchList.innerHTML = '<li>비어있음</li>';
        }
        const pf = await API.portfolio(state.token);
        els.cash.textContent = (pf.cash||0).toLocaleString();
        renderPositions(pf.positions||[]);
      }
      // Update selected chart title
      els.chart.textContent = `${state.selected.name_kr} (${state.selected.symbol}) 실시간 ${new Date().toLocaleTimeString()}`;
      // News refresh
      const news = await API.news(state.selected.symbol);
      renderNews(news);
    } catch (e) {
      console.error(e);
    }
  }
  await tick();
  state.pollHandle = setInterval(tick, 1200);
}

function renderList(container, quotes){
  container.innerHTML = '';
  quotes.forEach(q=>{
    const item = li({ left: `${q.name} (${q.symbol})`, right: q.price? q.price.toLocaleString()+'원' : '-', symbol:q.symbol, name:q.name });
    item.addEventListener('contextmenu', (ev)=>{ ev.preventDefault(); showCtx(ev.pageX, ev.pageY, q.symbol, q.name); });
    item.addEventListener('click', ()=> { state.selected = { symbol:q.symbol, name_kr:q.name }; });
    container.appendChild(item);
  });
}

function renderPositions(positions){
  els.portList.innerHTML = '';
  positions.forEach(p=>{
    const item = li({ left: `${p.name_kr} (${p.symbol})`, right: `${Number(p.quantity)}주 @ ${Number(p.avg_price).toLocaleString()}원`, symbol:p.symbol, name:p.name_kr });
    item.addEventListener('contextmenu', (ev)=>{ ev.preventDefault(); showCtx(ev.pageX, ev.pageY, p.symbol, p.name_kr); });
    item.addEventListener('click', ()=> { state.selected = { symbol:p.symbol, name_kr:p.name_kr }; });
    els.portList.appendChild(item);
  });
}

function renderNews(items){
  els.newsList.innerHTML = '';
  items.forEach(n=>{
    const li = document.createElement('li');
    li.innerHTML = `<a href="${n.link}" target="_blank">${n.title}</a> <span style="color:#9ca3af">(${n.source} · ${n.date})</span>`;
    els.newsList.appendChild(li);
  });
}

function log(msg){
  const li = document.createElement('li');
  li.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  els.logList.prepend(li);
}

// Search
els.searchBtn.addEventListener('click', doSearch);
els.searchInput.addEventListener('keydown', (e)=>{ if (e.key==='Enter') doSearch(); });
els.searchInput.addEventListener('input', async ()=>{
  const q = els.searchInput.value.trim();
  if (!q){ els.searchResults.style.display='none'; return; }
  const r = await API.search(q);
  if (!r.length){ els.searchResults.style.display='none'; return; }
  els.searchResults.innerHTML = '';
  r.forEach(x=>{
    const d = document.createElement('div');
    d.textContent = `${x.name} (${x.symbol})`;
    d.addEventListener('click', ()=>{
      state.selected = { symbol:x.symbol, name_kr:x.name };
      els.searchResults.style.display='none';
    });
    els.searchResults.appendChild(d);
  });
  els.searchResults.style.display='block';
});

function doSearch(){
  const q = els.searchInput.value.trim();
  if (!q) return;
  API.search(q).then(r=>{
    if (!r.length) { alert('검색 결과 없음'); return; }
    const x = r[0];
    state.selected = { symbol:x.symbol, name_kr:x.name };
  });
}

// Auth
els.loginBtn.onclick = ()=> { els.loginModal.classList.remove('hidden'); };
els.closeModal.onclick = ()=> { els.loginModal.classList.add('hidden'); };
els.doRegister.onclick = async ()=>{
  const email = els.email.value.trim(), pw=els.password.value.trim(), dn=els.displayName.value.trim()||'사용자';
  const r = await API.register(email,pw,dn);
  if (r.error) return alert(r.error);
  setToken(r.token, r.user);
  els.loginModal.classList.add('hidden');
  startPolling();
};
els.doLogin.onclick = async ()=>{
  const email = els.email.value.trim(), pw=els.password.value.trim();
  const r = await API.login(email,pw);
  if (r.error) return alert(r.error);
  setToken(r.token, r.user);
  els.loginModal.classList.add('hidden');
  startPolling();
};
els.logoutBtn.onclick = ()=>{
  setToken(null,null);
  if (state.pollHandle) clearInterval(state.pollHandle);
};

// Keyboard shortcuts
window.addEventListener('keydown', (e)=>{
  if (e.key==='F1'){ e.preventDefault(); alert('F1 도움말\n우클릭: 관심등록/해제, 매수/매도/풀매수/풀매도\n로그인 후 자산/보유 관리 가능'); }
  if (e.key==='F2'){ e.preventDefault(); state.view='home'; }
  if (e.key==='F3'){ e.preventDefault(); state.view='chart'; }
  if (e.key==='F4'){ e.preventDefault(); document.getElementById('searchInput').focus(); }
  if (e.key==='F5'){ e.preventDefault(); }
  if (e.key==='F6'){ e.preventDefault(); }
  if (e.key==='F7'){ e.preventDefault(); }
  if (e.key==='F8'){ e.preventDefault(); }
});

// Boot
startPolling();
