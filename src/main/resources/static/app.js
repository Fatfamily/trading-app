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
let chart = null;

function renderWatch(){
  wlBody.innerHTML = '';
  [...watch].forEach(c=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${c}</td><td id="p_${c}">-</td>`;
    tr.onclick = ()=>{ selectedCode = c; titleEl.textContent = '차트 '+c; fetchNews(); };
    wlBody.appendChild(tr);
  });
}
renderWatch();

codeInput.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter'){
    const v = codeInput.value.trim();
    if(v.match(/^\d{6}$/)) { watch.add(v); renderWatch(); codeInput.value=''; }
  }
});

async function pullPrices(){
  const codes = [...watch].join(',');
  if(!codes) return;
  try{
    const r = await fetch('/api/price/batch?codes='+encodeURIComponent(codes));
    const j = await r.json();
    Object.keys(j).forEach(code=>{
      const p = j[code].price;
      const el = document.getElementById('p_'+code);
      if(el) el.textContent = p;
    });
    // update chart value label
    const cur = j[selectedCode] ? j[selectedCode].price : null;
    if(cur) updateChart(Number(cur));
  }catch(e){
    console.error(e);
  }
}

function updateChart(val){
  // very small chart: push last values into chart dataset
  if(!chart){
    const ctx = chartEl.getContext('2d');
    chart = new Chart(ctx, {type:'line', data:{labels:[], datasets:[{label:selectedCode, data:[]}]}, options:{responsive:true, maintainAspectRatio:false}});
  }
  const ds = chart.data.datasets[0];
  if(chart.data.labels.length > 30){
    chart.data.labels.shift(); ds.data.shift();
  }
  chart.data.labels.push(new Date().toLocaleTimeString());
  ds.data.push(val);
  chart.update();
}

async function fetchNews(){
  try{
    const r = await fetch('/api/news/'+selectedCode);
    const j = await r.json();
    newsEl.innerHTML = j.map(x=> '<div>'+x.title+'</div>').join('');
  }catch(e){
    newsEl.innerHTML = '(뉴스 로딩 실패)';
  }
}

async function placeOrder(){
  const qty = Number(qtyEl.value);
  const side = sideEl.value;
  const body = {code: selectedCode, side, qty};
  try{
    const r = await fetch('/api/sim/market',{method:'POST',headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
    const j = await r.json();
    if(r.ok){
      log('주문 체결: '+JSON.stringify(j));
      refreshPF();
    } else {
      log('주문 실패: '+JSON.stringify(j));
    }
  }catch(e){
    log('에러: '+e);
  }
}

async function refreshPF(){
  try{
    const r = await fetch('/api/sim/portfolio');
    if(!r.ok){ pfEl.textContent = '로그인 필요'; return; }
    const j = await r.json();
    pfEl.textContent = JSON.stringify(j, null, 2);
  }catch(e){
    pfEl.textContent = '에러';
  }
}

function log(t){
  const now = new Date().toLocaleTimeString();
  logEl.textContent = `[${now}] ${t}\n` + logEl.textContent;
}

async function logout(){
  await fetch('/api/auth/logout',{method:'POST'}).catch(()=>{});
  window.location.href = '/login.html';
}

// loops
setInterval(pullPrices, 2000);
setInterval(refreshPF, 3000);
fetchNews();
refreshPF();
