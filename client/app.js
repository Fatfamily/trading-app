let selected = { code: null, name: null };
let liveTimer = null;

async function api(path, opts={}){
  const res = await fetch(path, { credentials:'include', ...opts });
  if(!res.ok) throw new Error(await res.text());
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

  // top list
  loadTop();

  // search
  document.getElementById('searchBtn').addEventListener('click', onSearch);
  document.getElementById('searchInput').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter') onSearch();
  });

  // live interval change
  document.getElementById('liveInterval').addEventListener('change', onChangeLive);
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
    // auto select first
    if(data[0]) selectSymbol(data[0].code, data[0].name);
  } catch(e) {
    box.textContent = '불러오기 실패: ' + e.message;
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
    data.forEach(item => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<div><strong>${item.name}</strong> <span class="code">${item.code}</span></div>`;
      row.addEventListener('click', ()=> selectSymbol(item.code, item.name));
      box.appendChild(row);
    });
    if(!data.length){ box.textContent = '검색 결과가 없습니다.'; }
  }catch(e){
    box.textContent = '검색 실패: ' + e.message;
  }
}

async function selectSymbol(code, name){
  selected = { code, name };
  await Promise.all([ showQuote(code, name), loadCandles(code), loadNews(code) ]);
  setupLive(); // apply current interval
}

function onChangeLive(e){
  setupLive();
}

function setupLive(){
  const ms = Number(document.getElementById('liveInterval').value);
  if(liveTimer){ clearInterval(liveTimer); liveTimer = null; }
  if(ms > 0 && selected.code){
    liveTimer = setInterval(async ()=>{
      try {
        await showQuote(selected.code, selected.name, /*silent*/ true);
      } catch(e){ /* ignore */ }
    }, ms);
  }
}

async function showQuote(code, name, silent=false){
  const box = document.getElementById('quoteBox');
  if(!silent) box.textContent = '불러오는 중…';
  try{
    const q = await api('/api/quote/' + code);
    const lines = [];
    lines.push(`${name} (${code})`);
    lines.push(`가격: ${fmtn(q.price)}`);
    lines.push(`전일대비: ${q.change ?? '-'} (${q.changeRate ?? '-'})`);
    lines.push(`거래량: ${fmtn(q.volume)}`);
    lines.push(`고가/저가: ${fmtn(q.high)} / ${fmtn(q.low)}`);
    box.textContent = lines.join('\n');
    document.title = `${name} ${fmtn(q.price)} - KR Trading`;
  }catch(e){
    if(!silent) box.textContent = '불러오기 실패: ' + e.message;
  }
}

async function loadCandles(code){
  const data = await api('/api/candles/' + code + '?count=120');
  const closes = data.map(d => Number(d.c));
  const labels = data.map(d => normalizeTime(d.t));
  drawLineChart('chartCanvas', labels, closes);
}

async function loadNews(code){
  const box = document.getElementById('newsList');
  box.textContent = '뉴스 불러오는 중…';
  try{
    const list = await api('/api/news/' + code);
    box.innerHTML = '';
    list.slice(0,10).forEach(n => {
      const a = document.createElement('a');
      a.className = 'row';
      a.href = n.link;
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.innerHTML = `<div>${escapeHTML(n.title)}</div><div class="code">${n.date || ''}</div>`;
      box.appendChild(a);
    });
    if(!list.length) box.textContent = '뉴스가 없습니다.';
  }catch(e){
    box.textContent = '뉴스 불러오기 실패: ' + e.message;
  }
}

// === Chart ===
// Minimal canvas line chart (no external libs)
function drawLineChart(canvasId, labels, values){
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  // Clear
  ctx.clearRect(0,0,w,h);
  // Padding
  const pad = { l: 60, r: 20, t: 20, b: 30 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;
  // Scales
  const min = Math.min(...values);
  const max = Math.max(...values);
  const yMin = min === max ? min - 1 : min;
  const yMax = min === max ? max + 1 : max;
  const N = values.length;
  function x(i){ return pad.l + (i/(N-1))*cw; }
  function y(v){ return pad.t + (1 - (v - yMin)/(yMax - yMin)) * ch; }
  // Grid
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for(let i=0;i<=4;i++){
    const gy = pad.t + (i/4)*ch;
    ctx.moveTo(pad.l, gy); ctx.lineTo(pad.l+cw, gy);
  }
  ctx.stroke();
  // Axes
  ctx.strokeStyle = '#2b3245';
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t+ch);
  ctx.moveTo(pad.l, pad.t+ch); ctx.lineTo(pad.l+cw, pad.t+ch);
  ctx.stroke();
  // Y ticks
  ctx.fillStyle = '#9aa4b2';
  ctx.font = '12px ui-sans-serif';
  for(let i=0;i<=4;i++){
    const vy = yMin + (i/4)*(yMax - yMin);
    const gy = pad.t + (1 - (i/4)) * ch;
    ctx.fillText(fmtn(vy), 6, gy+4);
  }
  // Line
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#6ba4ff';
  ctx.beginPath();
  values.forEach((v,i)=>{
    const px = x(i), py = y(v);
    if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
  });
  ctx.stroke();
}

function normalizeTime(t){
  // t can be "YYYY-MM-DD" or epoch ms
  if(typeof t === 'string') return t;
  try{
    const d = new Date(Number(t));
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }catch(e){ return String(t); }
}

function fmtn(v){
  if(v === null || v === undefined || isNaN(v)) return '-';
  return Number(v).toLocaleString();
}

function escapeHTML(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

init();
