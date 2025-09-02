let selected = { code: null, name: null };
let liveTimer = null;
let chartData = [];
let auth = { token: localStorage.getItem('token') || null, user: null };

async function api(path, opts={}){
  const headers = opts.headers || {};
  if (auth.token) headers['Authorization'] = 'Bearer ' + auth.token;
  const res = await fetch(path, { credentials:'include', headers, ...opts });
  if(!res.ok) {
    const txt = await res.text();
    try { return JSON.parse(txt); } catch(e) { throw new Error(txt || 'api_error'); }
  }
  const ct = res.headers.get('content-type')||'';
  return ct.includes('application/json') ? res.json() : res.text();
}

async function init(){
  // health
  try {
    const h = await api('/healthz');
    document.getElementById('health').textContent = h.ok ? '정상' : '이상';
  } catch(e) {
    document.getElementById('health').textContent = '오프라인';
  }
  // events
  document.getElementById('searchBtn').addEventListener('click', onSearch);
  document.getElementById('searchInput').addEventListener('keydown', (e)=>{
    if(e.key==='Enter') onSearch();
  });
  document.getElementById('favBtn').addEventListener('click', toggleFavorite);
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  renderAuthArea();
  await fetchMeIfNeeded();
  // load top list
  loadTop();
  // initial chart paint
  drawChart([]);
}

async function fetchMeIfNeeded(){
  if (!auth.token) return;
  try {
    const me = await api('/api/me');
    auth.user = me;
    renderAuthArea();
  } catch(e) {
    auth = { token: null, user: null };
    localStorage.removeItem('token');
    renderAuthArea();
  }
}

function renderAuthArea(){
  const out = document.getElementById('authArea');
  out.innerHTML = '';
  if (auth.user) {
    const el = document.createElement('div');
    el.textContent = auth.user.email;
    const logout = document.createElement('button');
    logout.textContent = '로그아웃';
    logout.addEventListener('click', ()=>{ auth = { token: null, user: null }; localStorage.removeItem('token'); renderAuthArea(); });
    el.style.display='flex'; el.style.gap='8px'; el.style.alignItems='center';
    el.appendChild(logout);
    out.appendChild(el);
  } else {
    const loginBtn = document.createElement('button'); loginBtn.textContent='로그인'; loginBtn.addEventListener('click', ()=> openLogin());
    const regBtn = document.createElement('button'); regBtn.textContent='회원가입'; regBtn.addEventListener('click', ()=> openRegister());
    out.appendChild(loginBtn); out.appendChild(regBtn);
  }
}

function openModal(title, innerHtml){
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = innerHtml;
  document.getElementById('modal').style.display = 'flex';
}

function closeModal(){ document.getElementById('modal').style.display='none'; }

function openLogin(){
  openModal('로그인', `
    <input id="f_email" placeholder="이메일" />
    <input id="f_password" placeholder="비밀번호" type="password" />
    <div style="margin-top:8px; display:flex; gap:8px;"><button id="doLogin">로그인</button><button id="doClose">닫기</button></div>
  `);
  document.getElementById('doLogin').addEventListener('click', async ()=>{
    const email = document.getElementById('f_email').value.trim();
    const password = document.getElementById('f_password').value;
    try {
      const res = await api('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) });
      if (res.token) {
        auth.token = res.token; localStorage.setItem('token', res.token); await fetchMeIfNeeded(); closeModal();
      } else {
        alert('로그인 실패');
      }
    } catch(e){ alert('로그인 실패: ' + (e.message || e)); }
  });
  document.getElementById('doClose').addEventListener('click', closeModal);
}

function openRegister(){
  openModal('회원가입', `
    <input id="f_email" placeholder="이메일" />
    <input id="f_password" placeholder="비밀번호" type="password" />
    <div style="margin-top:8px; display:flex; gap:8px;"><button id="doReg">회원가입</button><button id="doClose2">닫기</button></div>
  `);
  document.getElementById('doReg').addEventListener('click', async ()=>{
    const email = document.getElementById('f_email').value.trim();
    const password = document.getElementById('f_password').value;
    try {
      const res = await api('/api/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) });
      if (res.token) { auth.token = res.token; localStorage.setItem('token', res.token); await fetchMeIfNeeded(); closeModal(); }
      else alert('회원가입 실패');
    } catch(e){ alert('회원가입 실패: ' + (e.message || e)); }
  });
  document.getElementById('doClose2').addEventListener('click', closeModal);
}

async function loadTop(){
  const box = document.getElementById('topList');
  box.innerHTML = '불러오는 중…';
  try {
    const data = await api('/api/top');
    box.innerHTML = '';
    data.forEach(item => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<div><strong>${item.name}</strong> <span class="code">${item.code}</span></div>
                       <div><span class="badge">${item.price?.toLocaleString?.() ?? '-'}</span></div>`;
      row.addEventListener('click', ()=> selectSymbol(item.code, item.name));
      box.appendChild(row);
    });
    if(data[0]) selectSymbol(data[0].code, data[0].name);
  } catch(e) {
    box.textContent = '불러오기 실패: ' + (e.message || e);
  }
}

async function onSearch(){
  const q = document.getElementById('searchInput').value.trim();
  if(!q) return;
  const box = document.getElementById('topList');
  box.innerHTML = '검색 중…';
  try{
    const params = new URLSearchParams({ q });
    const data = await api('/api/search?' + params.toString());
    box.innerHTML = '';
    if (data.length === 0) {
      box.textContent = '검색 결과 없음';
      return;
    }
    data.forEach(item => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<div><strong>${item.name}</strong> <span class="code">${item.code}</span></div>`;
      row.addEventListener('click', ()=> selectSymbol(item.code, item.name));
      box.appendChild(row);
    });
  } catch(e) {
    box.textContent = '검색 실패: ' + (e.message || e);
  }
}

function startLive(){
  stopLive();
  document.getElementById('liveText').textContent = '실시간 업데이트 중';
  liveTimer = setInterval(async () => {
    if (!selected.code) return;
    try {
      const data = await api('/api/quote?code=' + selected.code);
      updateQuote(data);
      chartData.push({ t: Date.now(), p: data.price||0 });
      if (chartData.length > 600) chartData.shift(); // keep last 10min @ 1s
      drawChart(chartData);
    } catch(e) {
      console.warn('live update failed', e);
    }
  }, 1000); // every 1s
}

function stopLive(){
  document.getElementById('liveText').textContent = '실시간 대기 중';
  if (liveTimer) clearInterval(liveTimer);
  liveTimer = null;
}

async function selectSymbol(code, name){
  selected = { code, name };
  document.getElementById('symbolTitle').textContent = `${name} (${code})`;
  document.getElementById('quoteBox').textContent = '시세 불러오는 중…';
  chartData = [];
  drawChart(chartData);
  stopLive();
  try {
    const data = await api('/api/quote?code=' + code);
    updateQuote(data);
    chartData.push({ t: Date.now(), p: data.price||0 });
    drawChart(chartData);
  } catch(e) {
    document.getElementById('quoteBox').textContent = '시세 불러오기 실패: ' + (e.message || e);
  }
  loadNews(code);
  startLive();
  updateFavButton();
}

function updateQuote(data){
  const box = document.getElementById('quoteBox');
  const price = data.price?.toLocaleString?.() ?? '-';
  box.textContent = `${data.name} 현재가: ${price}원`;
}

async function loadNews(code){
  const box = document.getElementById('newsList');
  box.innerHTML = '뉴스 불러오는 중…';
  try {
    const data = await api('/api/news?code=' + code);
    box.innerHTML = '';
    data.forEach(n => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<div style="display:flex;flex-direction:column;gap:4px;">
        <a href="${n.url}" target="_blank" rel="noopener">${n.title}</a>
        <span class="muted">${n.source || ''} • ${n.time_text || n.time || ''}</span>
      </div>`;
      box.appendChild(row);
    });
    if (data.length === 0) box.textContent = '관련 뉴스 없음';
  } catch(e) {
    box.textContent = '뉴스 불러오기 실패: ' + (e.message || e);
  }
}

async function updateFavButton(){
  const btn = document.getElementById('favBtn');
  if (!auth.user) { btn.textContent = '로그인 후 즐겨찾기 가능'; return; }
  try {
    const favs = await api('/api/favorites');
    const found = favs.find(f=>f.code===selected.code);
    btn.textContent = found ? '즐겨찾기 제거' : '즐겨찾기 추가';
  } catch(e){
    btn.textContent = '즐겨찾기';
  }
}

async function toggleFavorite(){
  if (!auth.user) return openLogin();
  const code = selected.code;
  if (!code) return;
  try {
    const favs = await api('/api/favorites');
    const found = favs.find(f=>f.code===code);
    if (found) {
      await api('/api/favorites?code=' + code, { method: 'DELETE' });
      alert('즐겨찾기에서 제거했습니다.');
    } else {
      await api('/api/favorites', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code, name: selected.name }) });
      alert('즐겨찾기에 추가했습니다.');
    }
    updateFavButton();
  } catch(e){ alert('즐겨찾기 실패: ' + (e.message||e)); }
}

// very simple canvas line chart
function drawChart(points){
  const canvas = document.getElementById('chartCanvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);

  // axes
  ctx.strokeStyle = '#22304d';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 10);
  ctx.lineTo(40, h-30);
  ctx.lineTo(w-10, h-30);
  ctx.stroke();

  if (!points || points.length < 2) return;

  const ys = points.map(p=>p.p);
  const min = Math.min(...ys), max = Math.max(...ys);
  const pad = (max - min) * 0.1 || Math.max(1, Math.abs(max)*0.05);
  const ymin = min - pad, ymax = max + pad;

  function x(i){ return 40 + (i/(points.length-1))*(w-60); }
  function y(v){ return (h-30) - ( (v - ymin) / (ymax - ymin) ) * (h-50); }

  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#6aa2ff';
  points.forEach((p,i)=>{
    const xx = x(i), yy = y(p.p);
    if(i===0) ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy);
  });
  ctx.stroke();
}

window.addEventListener('DOMContentLoaded', init);
