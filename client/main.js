
const $ = sel => document.querySelector(sel);
const api = (p, opt={}) => fetch(p, { credentials:'include', headers:{'Content-Type':'application/json'}, ...opt }).then(r=>r.json());

let state = { token:null, user:null, symbol:null, name:null, series:[] };
let chart, chartData = { labels:[], datasets:[{ label:'가격', data:[] }] };

function fmt(n){ return Number(n).toLocaleString('ko-KR'); }
function badge(el, txt){ el.textContent = txt; }

function ensureChart(){
  if (chart) return chart;
  const ctx = $('#chart');
  chart = new Chart(ctx, { type:'line', data: chartData, options: { animation:false, scales:{ x:{ display:false } } } });
  return chart;
}

async function refreshMe(){
  try {
    const me = await api('/api/me');
    if (me.user){
      state.user = me.user; badge($('#cash'), `현금 ${fmt(me.cash)}원`);
      const tbody = $('#hold'); tbody.innerHTML='';
      me.holdings.forEach(h=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${h.name}</td><td align="right">${fmt(h.qty)}</td><td align="right">${fmt(h.avg_price)}</td>`;
        tbody.appendChild(tr);
      });
      const fav = $('#fav'); fav.innerHTML='';
      me.watch.forEach(w=>{
        const div = document.createElement('div');
        div.className='item'; div.textContent = `${w.name} (${w.symbol})`; div.onclick=()=>select(w.symbol,w.name);
        fav.appendChild(div);
      });
    }
  } catch{}
}

async function select(symbol, name){
  state.symbol = symbol; state.name = name || symbol;
  $('#title').textContent = `${state.name} (${symbol})`;
  chartData.labels.length=0; chartData.datasets[0].data.length=0;
  ensureChart().update();
  await pulse(); // first fetch
  loadNews();
}

async function pulse(){
  if (!state.symbol) return;
  try {
    const q = await api(`/api/quote/${state.symbol}`);
    const price = q.price||0, prev=q.prevClose||0;
    badge($('#now'), `현재가 ${fmt(price)}원`);
    const diff = price - prev; const rate = prev? (diff/prev*100) : 0;
    badge($('#chg'), `${diff>=0?'+':''}${fmt(diff)} (${rate.toFixed(2)}%)`);
    // push to chart
    const t = new Date(q.time||Date.now());
    chartData.labels.push(t.toLocaleTimeString()); chartData.datasets[0].data.push(price);
    if (chartData.labels.length>180) { chartData.labels.shift(); chartData.datasets[0].data.shift(); }
    ensureChart().update();
  } catch(e){ console.warn('pulse fail', e); }
}

async function loadTop(){
  const el = $('#list'); el.innerHTML='';
  badge($('#polling'),'업데이트 중…');
  const arr = await api('/api/top');
  arr.forEach(it=>{
    const div = document.createElement('div'); div.className='item';
    const rate = it.changeRate||0;
    div.innerHTML = `<span>${it.name} (${it.symbol})</span><span class="price ${rate>=0?'up':'down'}">${fmt(it.price)} (${rate.toFixed(2)}%)</span>`;
    div.onclick=()=>select(it.symbol, it.name);
    el.appendChild(div);
  });
  badge($('#polling'),'완료');
}

async function loadNews(){
  const el = $('#news'); el.innerHTML='로딩중…';
  try {
    const arr = await api(`/api/news/${state.symbol}`);
    el.innerHTML='';
    arr.forEach(n=>{
      const a = document.createElement('a'); a.href=n.link; a.target='_blank';
      a.textContent = `${n.title} · ${n.publisher}`;
      el.appendChild(a);
    });
  } catch{ el.textContent='뉴스가 없습니다.'; }
}

async function toggleWatch(){
  if (!state.symbol) return alert('먼저 종목을 선택하세요');
  const r = await api('/api/watch/toggle',{ method:'POST', body: JSON.stringify({ symbol: state.symbol, name: state.name })});
  await refreshMe();
  alert(r.watched ? '관심등록' : '관심해제');
}

async function order(side){
  if (!state.symbol) return alert('먼저 종목을 선택하세요');
  const q = prompt(`${side==='BUY'?'매수':'매도'} 수량 입력`, '1'); if (!q) return;
  const quote = await api(`/api/quote/${state.symbol}`);
  const price = quote.price;
  const r = await api('/api/order',{ method:'POST', body: JSON.stringify({ symbol: state.symbol, name: state.name, side, qty:Number(q), price }) });
  if (r.error){ alert(r.error); } else { await refreshMe(); alert('처리 완료'); }
}

function bind(){
  $('#btnSearch').onclick=async ()=>{
    const q = $('#q').value.trim(); if (!q) return;
    const res = await api(`/api/search?q=${encodeURIComponent(q)}`);
    if (!res.length) return alert('검색 결과 없음');
    const s = res[0]; select(s.symbol, s.name);
  };
  $('#btnJoin').onclick=async ()=>{
    const email=$('#email').value.trim(), pw=$('#pw').value.trim(); if(!email||!pw) return alert('입력');
    const r = await api('/api/auth/register',{ method:'POST', body: JSON.stringify({ email, password: pw })});
    if (r.error) alert(r.error); else { alert('가입/로그인 완료'); refreshMe(); }
  };
  $('#btnLogin').onclick=async ()=>{
    const email=$('#email').value.trim(), pw=$('#pw').value.trim(); if(!email||!pw) return alert('입력');
    const r = await api('/api/auth/login',{ method:'POST', body: JSON.stringify({ email, password: pw })});
    if (r.error) alert(r.error); else { alert('로그인 완료'); refreshMe(); }
  };
  $('#btnWatch').onclick=toggleWatch;
  $('#btnBuy').onclick=()=>order('BUY');
  $('#btnBuyAll').onclick=async ()=>{ const q=prompt('풀매수: 수량 입력(전액 자동은 곧 추가)',''); if(!q)return; order('BUY'); };
  $('#btnSell').onclick=()=>order('SELL');
  $('#btnSellAll').onclick=async ()=>{ const q=prompt('풀매도 수량 입력',''); if(!q)return; order('SELL'); };

  // shortcuts
  window.addEventListener('keydown',e=>{
    if (e.altKey){
      if (e.key==='1'){ window.scrollTo({top:0,behavior:'smooth'}); }
      if (e.key==='2'){ document.querySelector('#chart').scrollIntoView({behavior:'smooth'}); }
      if (e.key==='3'){ document.querySelector('#fav').scrollIntoView({behavior:'smooth'}); }
      if (e.key==='4'){ document.querySelector('#hold').scrollIntoView({behavior:'smooth'}); }
      if (e.key==='5'){ document.querySelector('#news').scrollIntoView({behavior:'smooth'}); }
    }
  });
}

async function boot(){
  bind();
  await refreshMe();
  await loadTop();
  // auto select first
  const first = document.querySelector('#list .item'); if (first) first.click();
  setInterval(pulse, 1200);
}

boot();
