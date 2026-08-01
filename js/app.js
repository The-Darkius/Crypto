/* =====================================================================
   Robot Or — version SIMPLE pour débutants
   - 3 profils de risque (Prudent / Equilibre / Agressif)
   - ZERO jargon dans l'UI par defaut, mode expert repliable
   - Flux multi-sources : Bybit WS -> Binance PAXG WS -> Simulateur
   - Moteur canvas + indicateurs + trading manuel + bot
   ===================================================================== */

window.addEventListener('error', (ev) => {
  const msg = 'ERREUR: ' + (ev.message || ev.error || 'inconnue') + (ev.filename?' ('+ev.filename.split('/').pop()+':'+ev.lineno+')':'');
  console.error(msg, ev);
  try {
    const el=document.createElement('div');
    el.style.cssText='position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#421622;color:#ffb4c1;border:2px solid #ff4f6b;padding:12px 18px;border-radius:8px;z-index:99999;font-family:monospace;font-size:13px;max-width:90%;box-shadow:0 10px 40px rgba(0,0,0,.8);word-break:break-word;';
    el.textContent=msg;
    document.body.appendChild(el);
    setTimeout(()=>{el.style.transition='opacity .5s';el.style.opacity='0';setTimeout(()=>el.remove(),500);}, 20000);
  } catch(e){}
});
window.addEventListener('unhandledrejection', (ev) => { console.error('Promise error:', ev.reason); });

const CFG = window.__CONFIG || { baseUrl: '', csrf: '' };
const SIMPLE = window.__SIMPLE_MODE__ === true;
const API = {
  async post(path, data = {}) {
    try {
      const r = await fetch(CFG.baseUrl + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CFG.csrf },
        body: JSON.stringify({ ...data, csrf: CFG.csrf }),
      });
      return await r.json().catch(() => ({ok:false}));
    } catch(e) { return {ok:false,error:String(e)}; }
  },
  async get(path) {
    try {
      const r = await fetch(CFG.baseUrl + path, { credentials: 'same-origin' });
      return await r.json().catch(() => ({ok:false}));
    } catch(e) { return {ok:false,error:String(e)}; }
  }
};

const $  = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));
const fmt = (n, d = 2) => (Number.isFinite(n) ? (+n).toFixed(d) : '--');
function toast(msg, kind='info', ttl=2400) {
  try {
    const el = document.createElement('div');
    el.className = 'toast ' + kind; el.textContent = msg;
    const root = document.getElementById('toasts') || document.body;
    root.appendChild(el);
    setTimeout(() => { el.style.opacity='0'; el.style.transform='translateX(20px)'; setTimeout(()=>el.remove(),250); }, ttl);
  } catch(e){}
}
function log(msg, kind='info') {
  try { API.post('/api/log.php', { source:'manual', kind, msg: String(msg).replace(/<[^>]+>/g,'') }).catch(()=>{}); } catch(e){}
}
function appendBotLog(msg, kind='info'){
  try{
    const ul=$('#botLog'); if(!ul) return;
    const li=document.createElement('li');
    li.className=kind;
    const d=new Date();
    li.innerHTML='<span class="t">'+d.toLocaleTimeString().slice(-8)+'</span>'+msg;
    ul.prepend(li);
    while(ul.children.length>80) ul.lastChild.remove();
  }catch(e){}
}

const RISK_PRESETS = {
  safe: { name:'Prudent', emoji:'vert',
    size:0.03, slPips:6,  tpPips:9,  trail:3, cooldownSec:8,  maxPos:1, lev:5,  useSqueeze:false },
  normal:{ name:'Equilibre', emoji:'jaune',
    size:0.08, slPips:8,  tpPips:14, trail:3, cooldownSec:3,  maxPos:1, lev:10, useSqueeze:false },
  agro:  { name:'Agressif', emoji:'rouge',
    size:0.20, slPips:12, tpPips:22, trail:5, cooldownSec:2,  maxPos:2, lev:20, useSqueeze:false },
};
let currentRisk = 'normal';

const PIP=0.01;
const DPR=Math.min(window.devicePixelRatio||1,2);
const S = {
  symbol:'XAUUSDT',tf:5,grouping:0.01,
  mid:0,bid:0,ask:0,prevMid:0,
  tickCount:0,latency:0,lastTickTs:0,src:'boot',
  side:'buy',orderType:'market',
  size:0.10,lev:10,slPips:10,tpPips:20,trailPips:0,rr:2,
  riskUsdt:100,
  startBal:10000,balance:10000,equity:10000,
  positions:[],book:{bids:[],asks:[],spread:0.02},
  candlesTF:{},candles:[],canvas:{},hover:{x:-1,y:-1},
  srLevels:new Map(),equityCurve:[10000],seed:{peak:10000,maxDD:0},
  ind:{},lastIndCalc:0,
  bot:{status:'off',balance:10000,positions:[],wins:0,losses:0,nTrades:0,
    config:{size:0.08,slPips:8,tpPips:14,trail:3,cooldownSec:5,maxPos:1,lev:10,useSqueeze:true,
            emaFast:9,emaSlow:21,rsiLen:14,bbLen:20,bbMult:2,rr:1.75},
    lastSignal:'-',lastSignalReason:'',lastTradeAt:0,peakEq:10000,maxDD:0,_loaded:false,_busy:false},
};

function seedHistory(startPrice){
  const now=Date.now();
  const tfList=[1,5,15,30,60,300];
  const nSeed={1:300,5:240,15:180,30:140,60:120,300:90};
  for(const tf of tfList){
    const arr=[]; let px=startPrice;
    for(let i=nSeed[tf];i>=1;i--){
      const ts=Math.floor((now-i*tf*1000)/(tf*1000))*tf*1000;
      const drift=(Math.random()-0.5)*0.3;
      const o=px; const c=+(px+drift).toFixed(2);
      const h=+Math.max(o,c)+Math.random()*0.4+0.02;
      const l=+Math.min(o,c)-Math.random()*0.4-0.02;
      const v=3+Math.floor(Math.random()*10);
      const buys=Math.floor(v*Math.random());
      arr.push({t:ts,o:+o.toFixed(2),h:+h.toFixed(2),l:+l.toFixed(2),c:+c.toFixed(2),v,buys,sells:v-buys});
      px=c;
    }
    S.candlesTF[tf]=arr;
  }
  S.candles=S.candlesTF[S.tf];
  S.mid=startPrice; S.prevMid=startPrice;
  S.openRef=S.candlesTF[S.tf][0].o;
}

function buildBookFromMid(mid, levelsCents=2) {
  const sp = Math.max(0.02, levelsCents*0.01);
  const bid=+(mid-sp/2).toFixed(2), ask=+(mid+sp/2).toFixed(2);
  const bids=[], asks=[];
  let bq=2+Math.random()*8,aq=2+Math.random()*8;
  for (let i=0;i<12;i++){
    bids.push([+(bid-i*0.01-Math.random()*0.005).toFixed(2), +(bq+=Math.random()*5-1).toFixed(2)]);
    asks.push([+(ask+i*0.01+Math.random()*0.005).toFixed(2), +(aq+=Math.random()*5-1).toFixed(2)]);
    if (bids[i][1]<0.1)bids[i][1]=0.3; if(asks[i][1]<0.1)asks[i][1]=0.3;
  }
  return {bid,ask,bids,asks,spread:sp};
}
function gauss(){let u=0,v=0;while(u===0)u=Math.random();while(v===0)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
let _simHandle = null;
const SIM_START=4050.00;
function reseedAroundPrice(price){ seedHistory(price); S.openRef=price; S._liveAligned=true; }
function startSim() {
  if (_simHandle) return;
  if(!S.mid || S.tickCount===0) seedHistory(SIM_START);
  _simHandle = setInterval(() => {
    try {
      const dt=0.15/1000, sigmaAnnual=0.12;
      const sigma=sigmaAnnual*Math.sqrt(dt/(252*6.5*3600));
      S.mid *= Math.exp(-0.5*sigma*sigma*dt + sigma*gauss() + (Math.random()<0.004?gauss()*0.0003:0));
      S.mid = Math.max(1500,Math.min(5000,S.mid));
      const bk = buildBookFromMid(S.mid,2+Math.random()*2);
      onTick({mid:S.mid,bid:bk.bid,ask:bk.ask,book:bk,ts:Date.now(),src:'sim'});
    } catch(e) { console.error('tick error',e); }
  },150);
  S.src='sim';
}
function stopSim(){ if(_simHandle){ clearInterval(_simHandle); _simHandle=null; } }

setTimeout(() => {
  try { if (S.tickCount === 0) startSim(); } catch(e){}
  try { safeInitCanvas(); } catch(e){}
}, 50);

let ctx,octx,rsiCtx,chartCanvas,overlayCanvas,rsiCanvas;
function safeInitCanvas() {
  chartCanvas=document.getElementById('chart');
  overlayCanvas=document.getElementById('overlayChart');
  rsiCanvas=document.getElementById('rsiChart');
  if(!chartCanvas||!overlayCanvas||!rsiCanvas) return false;
  ctx=chartCanvas.getContext('2d'); octx=overlayCanvas.getContext('2d'); rsiCtx=rsiCanvas.getContext('2d');
  return !!(ctx && octx && rsiCtx);
}
function resizeCanvases(){
  try {
    if(!ctx && !safeInitCanvas()) return;
    const cp=chartCanvas.parentElement;
    if (cp) cp.style.position = 'relative';
    const r=cp.getBoundingClientRect();
    const headH=$('.chart-head')?.offsetHeight || 42;
    const hasRsi = $('.rsi-panel')?.classList.contains('show');
    const rsiH=hasRsi?90:0;
    let ch=r.height-headH-rsiH-8, cw=r.width;
    if(ch<100)ch=300; if(cw<100)cw=500;
    for(const c of[chartCanvas,overlayCanvas]){
      c.width=cw*DPR;c.height=ch*DPR;
      c.style.width=cw+'px';c.style.height=ch+'px';
      c.style.left='0'; c.style.top=headH+'px';
    }
    overlayCanvas.style.pointerEvents='auto';
    ctx.setTransform(DPR,0,0,DPR,0,0); octx.setTransform(DPR,0,0,DPR,0,0);
    S.canvas.w=cw;S.canvas.h=ch;
    if(hasRsi){
      const rp=rsiCanvas.parentElement.getBoundingClientRect();
      const rw=Math.max(50,rp.width), rh=Math.max(50,rp.height);
      rsiCanvas.width=rw*DPR; rsiCanvas.height=rh*DPR;
      rsiCanvas.style.width=rw+'px'; rsiCanvas.style.height=rh+'px';
      rsiCtx.setTransform(DPR,0,0,DPR,0,0);
    }
    computeIndicators(); draw();
  } catch(e){ console.error('resize err',e); }
}

const FEEDS={active:'sim',sockets:[],lastTickTs:0,liveOk:false,tried:{bybit:false,binance:false}};
function killAllSockets(){for(const ws of FEEDS.sockets){try{ws.close();}catch(e){}}FEEDS.sockets=[];}
function activateFeed(name, refPrice){
  if(FEEDS.active===name)return;
  if(name==='bybit-ws'||name==='binance-ws'){
    FEEDS.liveOk=true;FEEDS.active=name;stopSim();
    S.symbol=(name==='bybit-ws')?'XAUUSDT':'PAXGUSDT';
    const label=name==='bybit-ws'?'Bybit (or direct)':'Binance (or)';
    if(refPrice && !S._liveAligned) reseedAroundPrice(refPrice);
    toast('Connecte au prix reel : '+label,'ok');
    if(refPrice) sayBot('Connecte au prix reel de l\'or', 'good');
  } else if(name==='sim' && FEEDS.active!=='sim'){
    startSim();
    sayBot('Mode demo (prix simule)', 'warn');
  }
  FEEDS.active=name;S.src=name;renderSrc(name);
}
function connectBybitWS(){
  if(FEEDS.tried.bybit)return;FEEDS.tried.bybit=true;let gotTick=false,ws;
  const t=setTimeout(()=>{if(!gotTick){try{ws.close();}catch(e){}connectBinanceWS();}},3000);
  try{ws=new WebSocket('wss://stream.bybit.com/v5/public/linear');}catch(e){clearTimeout(t);connectBinanceWS();return;}
  FEEDS.sockets.push(ws);
  ws.onopen=()=>{try{ws.send(JSON.stringify({op:'subscribe',args:['tickers.XAUUSDT']}));}catch(e){}ws._p=setInterval(()=>{if(ws.readyState===1)ws.send(JSON.stringify({op:'ping'}));},25000);};
  ws.onmessage=(ev)=>{let m;try{m=JSON.parse(ev.data);}catch(e){return;}
    if(m.op==='pong'||m.success===false)return;
    if(m.topic==='tickers.XAUUSDT'&&m.data){const d=Array.isArray(m.data)?m.data[0]:m.data;
      const bid=parseFloat(d.bid1Price),ask=parseFloat(d.ask1Price);if(!bid||!ask||bid<1000)return;
      gotTick=true;clearTimeout(t);
      const mid0=(bid+ask)/2;
      if(FEEDS.active!=='bybit-ws')activateFeed('bybit-ws',mid0);
      FEEDS.lastTickTs=Date.now();
      const sp=+(ask-bid).toFixed(2);
      const book=buildBookFromMid(mid0,Math.max(2,sp/0.01));
      book.bid=bid;book.ask=ask;book.bids[0]=[bid,parseFloat(d.bid1Size)||5];book.asks[0]=[ask,parseFloat(d.ask1Size)||5];
      onTick({mid:mid0,bid,ask,book,ts:Date.now(),src:'bybit-ws'});
    }};
  ws.onclose=()=>{clearTimeout(t);try{clearInterval(ws._p);}catch(e){}if(!gotTick)connectBinanceWS();if(FEEDS.active==='bybit-ws'){FEEDS.active='sim';startSim();FEEDS.tried.bybit=false;setTimeout(connectBybitWS,15000);}};
  ws.onerror=()=>{clearTimeout(t);};
}
function connectBinanceWS(){
  if(FEEDS.tried.binance)return;FEEDS.tried.binance=true;let gotTick=false,ws;
  const t=setTimeout(()=>{if(!gotTick)try{ws.close();}catch(e){}},5000);
  try{ws=new WebSocket('wss://stream.binance.com:9443/ws/paxgusdt@bookTicker/paxgusdt@aggTrade');}catch(e){clearTimeout(t);return;}
  FEEDS.sockets.push(ws);const pending={bid:null,ask:null,last:null};
  ws.onmessage=(ev)=>{let m;try{m=JSON.parse(ev.data);}catch(e){return;}
    if(m.b&&m.a){pending.bid=parseFloat(m.b);pending.ask=parseFloat(m.a);pending.last=pending.last||(pending.bid+pending.ask)/2;}
    else if(m.p){pending.last=parseFloat(m.p);}
    if(!pending.bid||!pending.ask||pending.bid<1000)return;
    gotTick=true;clearTimeout(t);
    const mid0=(pending.bid+pending.ask)/2;
    if(FEEDS.active!=='binance-ws'){activateFeed('binance-ws',mid0);}
    FEEDS.lastTickTs=Date.now();
    const sp=+(pending.ask-pending.bid).toFixed(2);
    const book=buildBookFromMid(mid0,Math.max(2,sp/0.01));
    book.bid=pending.bid;book.ask=pending.ask;book.bids[0]=[pending.bid,3+Math.random()*5];book.asks[0]=[pending.ask,3+Math.random()*5];
    onTick({mid:pending.last||mid0,bid:pending.bid,ask:pending.ask,book,ts:Date.now(),src:'binance-ws'});
  };
  ws.onclose=()=>{clearTimeout(t);if(FEEDS.active==='binance-ws'){FEEDS.active='sim';startSim();FEEDS.tried.binance=false;setTimeout(connectBinanceWS,15000);}};
  ws.onerror=()=>{clearTimeout(t);};
}

const tapeBuf=[];
function candleFromTick(tick,tfSec){
  const tsb=Math.floor(tick.ts/(tfSec*1000))*tfSec*1000;
  const s=S.candlesTF[tfSec]||(S.candlesTF[tfSec]=[]);
  const l=s[s.length-1];
  if(!l||l.t!==tsb){
    s.push({t:tsb,o:tick.mid,h:tick.mid,l:tick.mid,c:tick.mid,v:1,buys:tick.mid>=tick.prevMid?1:0,sells:tick.mid<tick.prevMid?1:0});
    if(s.length>1500)s.shift();
  }else{
    l.c=tick.mid;
    if(tick.mid>l.h)l.h=tick.mid;
    if(tick.mid<l.l)l.l=tick.mid;
    l.v++;
    if(tick.mid>=tick.prevMid)l.buys++; else l.sells++;
  }
}
function onTick(t){
  try{
    S.tickCount++;
    S.prevMid = S.mid || t.mid;
    S.mid=t.mid; S.bid=t.bid; S.ask=t.ask; S.book=t.book; S.lastTickTs=t.ts||Date.now();
    if(!S.openRef) S.openRef=t.mid;
    if(t.src) S.src=t.src;
    for(const tf of[1,5,15,30,60,300]) candleFromTick(t,tf);
    S.candles=S.candlesTF[S.tf]||[];
    const side=t.mid>=S.prevMid?'buy':'sell';
    tapeBuf.push({t:t.ts,px:t.mid,sz:(0.05+Math.random()*0.8).toFixed(2),side});
    if(tapeBuf.length>120) tapeBuf.shift();
    renderPrices(); renderBook();
    updateManualPositions(t);
    try{ botOnTick(t); }catch(e){console.error('bot err',e);}
    if(!S.lastIndCalc || Date.now()-S.lastIndCalc>300){
      try{ computeIndicators(); }catch(e){}
      S.lastIndCalc=Date.now();
    }
    if(!onTick._r) onTick._r=requestAnimationFrame(()=>{
      try{ renderTape(); }catch(e){}
      try{ if(!(S.tickCount%4)){ renderPositions(); renderBot(); updateAccount(); updateRiskDisplay(); } }catch(e){}
      onTick._r=null;
    });
  }catch(e){console.error('onTick err',e);}
}

function renderSrc(src){
  const el=document.getElementById('srcPill'); if(!el)return;
  if(src==='bybit-ws'){el.textContent='EN DIRECT (Bybit)';el.className='src-pill live';}
  else if(src==='binance-ws'){el.textContent='EN DIRECT (Binance)';el.className='src-pill live';}
  else if(src==='sim'){el.textContent='MODE DEMO (prix simule)';el.className='src-pill sim';}
  else{el.textContent='Connexion...';el.className='src-pill';}
}
function renderTape(){
  const ul=document.getElementById('tape');if(!ul)return;
  ul.innerHTML=tapeBuf.slice(-30).reverse().map(t=>{const d=new Date(t.t);return '<li class="'+t.side+'"><span class="t">'+d.toLocaleTimeString().slice(-8)+'</span><span class="px">'+fmt(t.px)+'</span><span class="sz">'+t.sz+'</span></li>';}).join('');
}
function renderPrices(){
  try{
  const bidEl=$('#bidPx'),askEl=$('#askPx'),midEl=$('#midPx');
  if(!bidEl||!askEl||!midEl) return;
  const ob=bidEl.textContent,oa=askEl.textContent,om=midEl.textContent;
  bidEl.textContent=fmt(S.bid);askEl.textContent=fmt(S.ask);midEl.textContent=fmt(S.mid);
  if(+ob&&+ob!==S.bid){bidEl.classList.remove('flash-up','flash-down');void bidEl.offsetWidth;bidEl.classList.add(S.bid>+ob?'flash-up':'flash-down');}
  if(+oa&&+oa!==S.ask){askEl.classList.remove('flash-up','flash-down');void askEl.offsetWidth;askEl.classList.add(S.ask>+oa?'flash-up':'flash-down');}
  if(+om&&+om!==S.mid){midEl.classList.remove('flash-up','flash-down');void midEl.offsetWidth;midEl.classList.add(S.mid>+om?'flash-up':'flash-down');}
  const chg=S.mid-(S.openRef||S.mid),chgPct=S.openRef?(chg/S.openRef)*100:0;
  const ce=document.getElementById('chg');
  if(ce){
    ce.textContent=chg>=0?'+'+fmt(chg)+' ('+chgPct.toFixed(2)+'%)':fmt(chg)+' ('+chgPct.toFixed(2)+'%)';
    ce.style.color=chg>=0?'var(--up)':'var(--down)';
  }
  const sp=(S.ask&&S.bid)?(S.ask-S.bid):0;
  const s2=$('#spreadLine');
  if(s2)s2.textContent='Ecart : '+sp.toFixed(2)+'$ · prix '+fmt(S.mid);
  }catch(e){}
}
function renderBook(){
  try{
  if(!S.book.bids.length) return;
  const group=S.grouping;
  const agg=levels=>{
    const m=new Map();
    for(const[p,q]of levels){
      if(!isFinite(p)||!isFinite(q)) continue;
      const pg=(Math.round(p/group)*group).toFixed(2);
      m.set(pg,(m.get(pg)||0)+q);
    }
    return Array.from(m.entries()).slice(0,10).map(([p,q])=>[+p,q]);
  };
  const bids=agg(S.book.bids).sort((a,b)=>b[0]-a[0]),asks=agg(S.book.asks).sort((a,b)=>a[0]-b[0]);
  const maxQty=Math.max(1,...bids.map(r=>r[1]),...asks.map(r=>r[1]));
  const rows=(arr,cls)=>arr.map(([p,q])=>{const w=(q/maxQty)*100;return '<div class="book-row '+cls+'"><span class="p">'+fmt(p)+'</span><span>'+q.toFixed(1)+'</span><span>'+q.toFixed(1)+'</span><span class="bar" style="width:'+w+'%"></span></div>';}).join('');
  const bd=$('#bids'),ak=$('#asks');if(bd)bd.innerHTML=rows(bids,'bid');if(ak)ak.innerHTML=rows(asks,'ask');
  }catch(e){}
}

function ema(a,l,k='c'){const o=new Array(a.length).fill(null);if(a.length<l)return o;const kk=2/(l+1);let v=0;for(let i=0;i<l;i++)v+=a[i][k];v/=l;o[l-1]=v;for(let i=l;i<a.length;i++){v=a[i][k]*kk+v*(1-kk);o[i]=v;}return o;}
function sma(a,l,k='c'){const o=new Array(a.length).fill(null);let s=0;for(let i=0;i<a.length;i++){s+=a[i][k];if(i>=l)s-=a[i-l][k];if(i>=l-1)o[i]=s/l;}return o;}
function stdev(a,l,m,k='c'){const o=new Array(a.length).fill(null);for(let i=l-1;i<a.length;i++){const mm=m[i];let s=0;for(let j=i-l+1;j<=i;j++)s+=(a[j][k]-mm)**2;o[i]=Math.sqrt(s/l);}return o;}
function rsi(a,l=14,k='c'){const o=new Array(a.length).fill(null);if(a.length<l+1)return o;let g=0,lo=0;for(let i=1;i<=l;i++){const d=a[i][k]-a[i-1][k];if(d>=0)g+=d;else lo-=d;}let ag=g/l,al=lo/l;o[l]=al===0?100:100-100/(1+ag/al);for(let i=l+1;i<a.length;i++){const d=a[i][k]-a[i-1][k];const gu=d>0?d:0,lv=d<0?-d:0;ag=(ag*(l-1)+gu)/l;al=(al*(l-1)+lv)/l;o[i]=al===0?100:100-100/(1+ag/al);}return o;}
function vwap(a){const o=new Array(a.length).fill(null);let cp=0,cv=0,cd=-1;for(let i=0;i<a.length;i++){const d=new Date(a[i].t).getDay();if(d!==cd){cp=0;cv=0;cd=d;}const tp=(a[i].h+a[i].l+a[i].c)/3;cp+=tp*a[i].v;cv+=a[i].v;o[i]=cv?cp/cv:null;}return o;}
function pivots(a){const lv=new Map();const n=a.length,lk=Math.min(120,n);if(n<5)return lv;for(let i=n-lk;i<n-2;i++){if(i<2)continue;const c=a[i];if(c.h>a[i-1].h&&c.h>a[i-2].h&&c.h>a[i+1].h&&c.h>a[i+2].h){const k=+c.h.toFixed(1);lv.set(k,(lv.get(k)||0)+1);}if(c.l<a[i-1].l&&c.l<a[i-2].l&&c.l<a[i+1].l&&c.l<a[i+2].l){const k=+c.l.toFixed(1);lv.set(k,(lv.get(k)||0)+1);}}return lv;}
function computeIndicators(){
  try{
    const cs=S.candles; if(!cs||!cs.length) return;
    S.ind.ema9=ema(cs,9);S.ind.ema21=ema(cs,21);S.ind.ema50=ema(cs,50);
    const mi=sma(cs,20);const sd=stdev(cs,20,mi);
    S.ind.bbUp=mi.map((m,i)=>m==null?null:m+2*sd[i]);
    S.ind.bbDn=mi.map((m,i)=>m==null?null:m-2*sd[i]);
    S.ind.vwap=vwap(cs);
    S.ind.rsi=rsi(cs,14);
    S.srLevels=pivots(cs);
  }catch(e){console.error('indic err',e);}
}

const CH={rightPad:70,leftPad:10,topPad:10,botPad:26,volH:46};
function draw(){try{
  if(!ctx){if(!safeInitCanvas())return;}
  const cs=S.candles,w=S.canvas.w,h=S.canvas.h;
  ctx.clearRect(0,0,w,h);
  if(!cs||!cs.length||w<30||h<30){
    ctx.fillStyle='#151823';ctx.fillRect(0,0,Math.max(w,600),Math.max(h,300));
    ctx.fillStyle='#8a93ac';ctx.font='14px Inter, sans-serif';ctx.textAlign='center';
    ctx.fillText('Chargement du graphique...',(w||600)/2,(h||300)/2);ctx.textAlign='start';
    if(rsiCtx){rsiCtx.clearRect(0,0,(rsiCanvas?.width||0)/DPR,(rsiCanvas?.height||0)/DPR);}
    return;}
  const n=cs.length,vN=Math.min(n,Math.max(40,Math.floor((w-CH.leftPad-CH.rightPad)/5)));
  const st=Math.max(0,n-vN),v=cs.slice(st,n);
  let hi=-Infinity,lo=Infinity;
  for(const c of v){if(c.h>hi)hi=c.h;if(c.l<lo)lo=c.l;}
  const indChk=(a,id)=>{try{if(!document.getElementById(id)?.checked)return;if(!a)return;for(let i=st;i<n;i++){const vv=a[i];if(vv==null||!isFinite(vv))continue;if(vv>hi)hi=vv;if(vv<lo)lo=vv;}}catch(e){}};
  indChk(S.ind.ema9,'iEMA9');indChk(S.ind.ema21,'iEMA21');indChk(S.ind.ema50,'iEMA50');
  indChk(S.ind.bbUp,'iBB');indChk(S.ind.bbDn,'iBB');indChk(S.ind.vwap,'iVWAP');
  for(const p of S.positions.filter(x=>x.source==='manual')){
    if(p.entry>hi)hi=p.entry;if(p.entry<lo)lo=p.entry;
    if(p.sl!=null){if(p.sl>hi)hi=p.sl;if(p.sl<lo)lo=p.sl;}
    if(p.tp!=null){if(p.tp>hi)hi=p.tp;if(p.tp<lo)lo=p.tp;}
  }
  if(hi-lo<0.05){hi+=0.1;lo-=0.1;}
  const pad=(hi-lo)*0.10;hi+=pad;lo-=pad;
  const pW=w-CH.leftPad-CH.rightPad,pH=h-CH.topPad-CH.botPad-CH.volH;
  const y=px=>CH.topPad+(1-(px-lo)/(hi-lo))*pH;
  const x=i=>CH.leftPad+((i+0.5)/v.length)*pW;
  const cw=Math.max(1.5,pW/v.length-1);
  ctx.strokeStyle='#1a1f30';ctx.lineWidth=1;ctx.font='10px JetBrains Mono, monospace';ctx.fillStyle='#8a93ac';
  for(let i=0;i<=6;i++){const yy=CH.topPad+(i/6)*pH;ctx.beginPath();ctx.moveTo(CH.leftPad,yy);ctx.lineTo(CH.leftPad+pW,yy);ctx.stroke();const pr=lo+(1-i/6)*(hi-lo);ctx.fillText(pr.toFixed(2),CH.leftPad+pW+6,yy+3);}
  const step=Math.max(1,Math.floor(v.length/7));
  for(let i=0;i<v.length;i+=step){
    const t=new Date(v[i].t);
    const lbl=(S.tf>=60)?String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0')
                       :String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0')+':'+String(t.getSeconds()).padStart(2,'0');
    ctx.fillText(lbl,Math.max(2,x(i)-20),h-CH.botPad+14);
  }
  if(S.mid){
    const yM=y(S.mid);
    ctx.setLineDash([5,4]);ctx.strokeStyle='rgba(245,200,66,.8)';ctx.lineWidth=1.4;
    ctx.beginPath();ctx.moveTo(CH.leftPad,yM);ctx.lineTo(CH.leftPad+pW,yM);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#f5c842';ctx.fillRect(CH.leftPad+pW,yM-9,CH.rightPad-4,18);ctx.fillStyle='#0a0b10';ctx.font='bold 11px JetBrains Mono, monospace';ctx.fillText(fmt(S.mid),CH.leftPad+pW+6,yM+4);
  }
  try{
    if(document.getElementById('iSR')?.checked){
      for(const[lv,ht]of S.srLevels){
        if(ht<2)continue;const yy=y(lv);if(yy<CH.topPad||yy>CH.topPad+pH)continue;
        ctx.strokeStyle='rgba(181,123,255,.35)';ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(CH.leftPad,yy);ctx.lineTo(CH.leftPad+pW,yy);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle='rgba(181,123,255,.8)';ctx.font='9px JetBrains Mono, monospace';ctx.fillText(lv.toFixed(1),CH.leftPad+2,yy-3);
      }
    }
  }catch(e){}
  const vM=Math.max(1,...v.map(c=>c.v)),vT=CH.topPad+pH+6;
  for(let i=0;i<v.length;i++){
    const c=v[i];const up=c.c>=c.o;const vh=(c.v/vM)*(CH.volH-10);
    ctx.fillStyle=up?'rgba(34,209,122,.45)':'rgba(255,79,107,.45)';
    ctx.fillRect(x(i)-cw/2,vT+CH.volH-12-vh,cw,vh);
  }
  ctx.strokeStyle='#1a1f30';ctx.beginPath();ctx.moveTo(CH.leftPad,vT);ctx.lineTo(CH.leftPad+pW,vT);ctx.stroke();
  const pL=(arr,col,wi=1.2)=>{
    if(!arr)return;ctx.strokeStyle=col;ctx.lineWidth=wi;ctx.beginPath();let stk=false;
    for(let i=0;i<v.length;i++){const vv=arr[st+i];if(vv==null||!isFinite(vv)){stk=false;continue;}const xx=x(i),yy=y(vv);if(!stk){ctx.moveTo(xx,yy);stk=true;}else ctx.lineTo(xx,yy);}
    ctx.stroke();
  };
  if(document.getElementById('iBB')?.checked){pL(S.ind.bbUp.slice(st),'rgba(91,163,255,.4)',1);pL(S.ind.bbDn.slice(st),'rgba(91,163,255,.4)',1);}
  if(document.getElementById('iVWAP')?.checked)pL(S.ind.vwap.slice(st),'rgba(245,200,66,.9)',1.2);
  if(document.getElementById('iEMA9')?.checked)pL(S.ind.ema9.slice(st),'rgba(34,209,122,.8)',1.2);
  if(document.getElementById('iEMA21')?.checked)pL(S.ind.ema21.slice(st),'rgba(91,163,255,.8)',1.2);
  if(document.getElementById('iEMA50')?.checked)pL(S.ind.ema50.slice(st),'rgba(181,123,255,.8)',1.2);
  for(let i=0;i<v.length;i++){
    const c=v[i];const up=c.c>=c.o;const col=up?'#22d17a':'#ff4f6b';
    ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=1;
    const x0=x(i);ctx.beginPath();ctx.moveTo(x0,y(c.h));ctx.lineTo(x0,y(c.l));ctx.stroke();
    const bt=y(Math.max(c.o,c.c)),bb=y(Math.min(c.o,c.c));
    ctx.fillRect(x0-cw/2,bt,cw,Math.max(1,bb-bt));
  }
  for(const p of S.positions.filter(pp=>pp.source==='manual')){
    const col=p.side==='L'?'#22d17a':'#ff4f6b';
    const ye=y(p.entry),ys=p.sl!=null?y(p.sl):null,yt=p.tp!=null?y(p.tp):null;
    ctx.strokeStyle=col;ctx.setLineDash([3,3]);ctx.lineWidth=1;
    if(ys){ctx.beginPath();ctx.moveTo(CH.leftPad,ys);ctx.lineTo(CH.leftPad+pW,ys);ctx.stroke();}
    if(yt){ctx.beginPath();ctx.moveTo(CH.leftPad,yt);ctx.lineTo(CH.leftPad+pW,yt);ctx.stroke();}
    ctx.setLineDash([]);ctx.fillStyle=col;ctx.fillRect(CH.leftPad,ye-7,6,14);ctx.fillStyle='#0a0b10';ctx.font='bold 10px JetBrains Mono, monospace';ctx.fillText((p.side==='L'?'A':'V')+' '+fmt(p.entry),CH.leftPad+8,ye+3);
  }
  if(v.length){const vl=document.getElementById('vL'),vh=document.getElementById('vH');if(vl)vl.textContent=fmt(v[v.length-1].l);if(vh)vh.textContent=fmt(v[v.length-1].h);}
  drawOverlay(hi,lo,v,x,y,pW,pH);drawRSI();
}catch(e){console.error('draw err',e);}}
function drawOverlay(hi,lo,v,x,y,pW,pH){try{
  const w=S.canvas.w,h=S.canvas.h;octx.clearRect(0,0,w,h);
  if(S.hover.x<0||!v||!v.length) return;
  const i=Math.max(0,Math.min(v.length-1,Math.floor(((S.hover.x-CH.leftPad)/pW)*v.length)));
  const c=v[i];if(!c)return;
  octx.strokeStyle='rgba(255,255,255,.18)';octx.setLineDash([4,4]);octx.lineWidth=1;
  octx.beginPath();octx.moveTo(x(i),CH.topPad);octx.lineTo(x(i),CH.topPad+pH+CH.volH-4);octx.stroke();
  if(S.hover.y>=CH.topPad && S.hover.y<=CH.topPad+pH){
    octx.beginPath();octx.moveTo(CH.leftPad,S.hover.y);octx.lineTo(CH.leftPad+pW,S.hover.y);octx.stroke();
  }
  octx.setLineDash([]);
  if(S.hover.y>=CH.topPad && S.hover.y<=CH.topPad+pH){
    const pr=lo+(1-(S.hover.y-CH.topPad)/pH)*(hi-lo);
    octx.fillStyle='rgba(245,200,66,.9)';octx.fillRect(CH.leftPad+pW,S.hover.y-8,CH.rightPad-4,16);octx.fillStyle='#0a0b10';octx.font='bold 10px JetBrains Mono, monospace';octx.fillText(pr.toFixed(2),CH.leftPad+pW+6,S.hover.y+3);
  }
  octx.fillStyle='rgba(20,24,36,.95)';
  octx.fillRect(x(i)-58,CH.topPad+6,116,64);
  octx.strokeStyle='rgba(245,200,66,.4)';octx.strokeRect(x(i)-58,CH.topPad+6,116,64);
  octx.fillStyle='#eef1f8';octx.font='10px JetBrains Mono, monospace';
  const tt=new Date(c.t);
  octx.fillText(tt.toLocaleTimeString(),x(i)-52,CH.topPad+20);
  octx.fillStyle=c.c>=c.o?'#22d17a':'#ff4f6b';
  octx.fillText('O '+fmt(c.o)+'  C '+fmt(c.c),x(i)-52,CH.topPad+34);
  octx.fillText('H '+fmt(c.h)+'  L '+fmt(c.l),x(i)-52,CH.topPad+48);
  octx.fillStyle='#8a93ac';octx.fillText('V '+c.v,x(i)-52,CH.topPad+62);
}catch(e){}}
function drawRSI(){try{
  if(!rsiCtx)return;
  const w=rsiCanvas.width/DPR,h=rsiCanvas.height/DPR;
  rsiCtx.clearRect(0,0,w,h);
  const r=S.ind.rsi; if(!r||!r.length) return;
  const pad=24,pW=w-pad-8,pH=h-20;
  const n=S.candles.length,vN=Math.min(n,Math.max(40,Math.floor(pW/4))),st=Math.max(0,n-vN);
  rsiCtx.fillStyle='rgba(255,79,107,.08)';rsiCtx.fillRect(pad,2,pW,(30/80)*pH);
  rsiCtx.fillStyle='rgba(34,209,122,.08)';rsiCtx.fillRect(pad,2+pH-(30/80)*pH,pW,(30/80)*pH);
  rsiCtx.strokeStyle='#2a3145';rsiCtx.lineWidth=1;
  for(const lv of[30,50,70]){
    const yy=2+(1-lv/100)*pH;rsiCtx.beginPath();rsiCtx.moveTo(pad,yy);rsiCtx.lineTo(pad+pW,yy);rsiCtx.stroke();
    rsiCtx.fillStyle='#8a93ac';rsiCtx.font='9px JetBrains Mono, monospace';rsiCtx.fillText(String(lv),4,yy+3);
  }
  rsiCtx.strokeStyle='#b57bff';rsiCtx.lineWidth=1.4;rsiCtx.beginPath();
  let started=false;
  for(let i=st;i<n;i++){const v=r[i];if(v==null||!isFinite(v)){started=false;continue;}
    const xx=pad+((i-st+0.5)/vN)*pW,yy=2+(1-Math.max(0,Math.min(100,v))/100)*pH;
    if(!started){rsiCtx.moveTo(xx,yy);started=true;}else rsiCtx.lineTo(xx,yy);
  }
  rsiCtx.stroke();
}catch(e){}}

function openManual(side,size,opts={}){
  if(size<=0||!isFinite(size))return toast('Mise invalide','bad');
  if(!S.bid||!S.ask)return toast('Prix pas encore pret, attends 2 secondes','bad');
  const price=opts.price||(side==='L'?S.ask:S.bid);
  const dir=side==='L'?1:-1;
  const sl=opts.sl!=null?opts.sl:+(price-dir*S.slPips*PIP).toFixed(2);
  const tp=opts.tp!=null?opts.tp:+(price+dir*S.tpPips*PIP).toFixed(2);
  const pos={id:'M'+Math.random().toString(36).slice(2,7).toUpperCase(),source:'manual',side,size,entry:price,sl,tp,lev:S.lev,trail:S.trailPips*PIP,peak:price,openedAt:Date.now()};
  S.positions.push(pos);
  API.post('/api/position_open.php',{source:'manual',side,size,entry:price,sl,tp,lev:S.lev,trail:S.trailPips});
  toast(side==='L'?'ACHAT effectue !':'VENTE effectuee !','ok',1800);
}
function closeManual(id,reason='manual',price=null){
  const idx=S.positions.findIndex(p=>p.id===id);if(idx<0)return;
  const p=S.positions[idx];
  const px=price||(p.side==='L'?S.bid:S.ask);
  if(!px)return;
  const dir=p.side==='L'?1:-1;const pnl=+((px-p.entry)*dir*p.size).toFixed(2);
  S.positions.splice(idx,1);
  API.post('/api/position_close.php',{id,reason,exit:px});
  S.balance += pnl;
  toast('Trade ferme : '+(pnl>=0?'+':'')+pnl.toFixed(2)+'$',pnl>=0?'ok':'bad');
}
function updateManualPositions(t){
  try{
    for(const p of[...S.positions]){
      if(p.source!=='manual')continue;
      const dir=p.side==='L'?1:-1;
      const mark=p.side==='L'?t.bid:t.ask;
      p.upnl=(mark-p.entry)*dir*p.size;
      if(p.trail>0){
        if(dir===1&&mark>p.peak)p.peak=mark;
        if(dir===-1&&mark<p.peak)p.peak=mark;
        const tp2=p.peak-dir*p.trail;
        if(dir===1)p.sl=Math.max(p.sl,+tp2.toFixed(2));
        else p.sl=Math.min(p.sl,+tp2.toFixed(2));
      }
      if((dir===1&&mark<=p.sl)||(dir===-1&&mark>=p.sl)){closeManual(p.id,'Stop',p.sl);continue;}
      if((dir===1&&mark>=p.tp)||(dir===-1&&mark<=p.tp)){closeManual(p.id,'Gain',p.tp);continue;}
    }
  }catch(e){console.error('pos err',e);}
}
function updateAccount(){
  try{
    let u=0;
    for(const p of S.positions.filter(x=>x.source==='manual'))u+=p.upnl||0;
    S.equity=S.balance+u;
    if(S.equity>S.seed.peak)S.seed.peak=S.equity;
    S.seed.maxDD=Math.max(S.seed.maxDD,(S.seed.peak-S.equity)/S.seed.peak*100);
    const bal=$('#balance'),pnl=$('#pnl'),pnlWrap=$('#pnlWrap');
    if(bal)bal.textContent=S.balance.toFixed(0);
    if(pnl){const tot=S.equity-S.startBal;pnl.textContent=(tot>=0?'+':'')+tot.toFixed(2)+' $';pnl.className=tot>=0?'up':'down';}
    if(pnlWrap){const tot=S.equity-S.startBal;pnlWrap.classList.toggle('good',tot>=0);pnlWrap.classList.toggle('bad',tot<0);}
  }catch(e){}
}
function updateRiskDisplay(){
  try{
    const r=S.slPips*PIP*S.size;
    const el=$('#riskTrade');
    if(el) el.textContent='~'+Math.max(1,Math.round(r))+' $';
  }catch(e){}
}
function renderPositions(){
  try{
    const tbody=$('#positions');
    const empty=$('#positionsEmpty');
    if(!tbody)return;
    const manual=S.positions.filter(p=>p.source==='manual');
    tbody.innerHTML=manual.map(p=>{
      const dir=p.side==='L'?1:-1;const mark=p.side==='L'?S.bid:S.ask;
      const pnl=(mark-p.entry)*dir*p.size;
      const dur=Math.round((Date.now()-p.openedAt)/1000)+'s';
      return '<tr><td class="side-'+p.side+'">'+(p.side==='L'?'ACHAT':'VENTE')+' '+(p.lev||S.lev)+'x</td><td>'+p.size.toFixed(2)+'</td><td>'+fmt(p.entry)+'</td><td>'+fmt(mark)+'</td><td>'+fmt(p.sl)+'</td><td>'+fmt(p.tp)+'</td><td class="'+(pnl>=0?'up':'down')+'">'+(pnl>=0?'+':'')+pnl.toFixed(2)+'</td><td>'+dur+'</td><td class="x" data-id="'+p.id+'">X</td></tr>';
    }).join('');
    $$('#positions .x').forEach(el=>el.onclick=()=>closeManual(el.dataset.id,'manual'));
    if(empty) empty.classList.toggle('show', manual.length===0);
  }catch(e){}
}

function sizeFromUsdt(usdt){
  const risk = Math.max(5, Math.min(500, usdt));
  const sl = S.slPips || 10;
  return Math.max(0.01, +(risk/(sl*PIP)).toFixed(3));
}
function applyRiskUsdt(usdt){
  S.riskUsdt = usdt;
  S.size = sizeFromUsdt(usdt);
  const sz=$('#size'); if(sz) sz.value=S.size;
  updateRiskDisplay();
}

function applyRiskPreset(key){
  currentRisk = key;
  const p = RISK_PRESETS[key];
  Object.assign(S.bot.config, {
    size:p.size, slPips:p.sl, tpPips:p.tp, trail:p.trail,
    cooldownSec:p.cooldownSec, maxPos:p.maxPos, lev:p.lev, useSqueeze:p.useSqueeze,
  });
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
  set('botSize',p.size); set('botLev',p.lev); set('botSl',p.sl); set('botTp',p.tp);
  set('botTrail',p.trail); set('botCd',p.cooldownSec); set('botMax',p.maxPos);
  const sq=$('#botSqueeze'); if(sq) sq.checked=p.useSqueeze;
  API.post('/api/bot.php',{action:'config',config:S.bot.config});
}
function botCfgUI(){
  return{
    size:+$('#botSize')?.value||0.08,lev:+$('#botLev')?.value||10,
    slPips:+$('#botSl')?.value||8,tpPips:+$('#botTp')?.value||14,
    trail:+$('#botTrail')?.value||0,cooldownSec:+$('#botCd')?.value||5,
    maxPos:+$('#botMax')?.value||1,useSqueeze:$('#botSqueeze')?.checked!==false,
    emaFast:S.bot.config.emaFast,emaSlow:S.bot.config.emaSlow,
    rsiLen:S.bot.config.rsiLen,bbLen:S.bot.config.bbLen,bbMult:S.bot.config.bbMult,rr:S.bot.config.rr
  };
}
async function botSend(act,extra={}){
  if(S.bot._busy) return {ok:false};
  S.bot._busy=true;
  let r={ok:false};
  try{
    const optimisticStatus = act==='start'?'on':act==='pause'?'pause':act==='stop'?'off':S.bot.status;
    S.bot.status=optimisticStatus;
    renderBot();
    r=await API.post('/api/bot.php',{action:act,config:(act==='start'||act==='config')?S.bot.config:undefined,...extra});
    if(r&&r.ok&&r.bot) syncBot(r.bot);
    else if(r&&!r.ok) toast('Oups, le robot a un probleme : '+(r.error||''),'bad');
  }catch(e){console.error(e);}
  finally{ setTimeout(()=>{S.bot._busy=false;}, 300); renderBot(); }
  return r;
}
function syncBot(b){
  if(!b) return;
  if(!(S.bot._busy && S.bot.status==='on' && b.status==='off')) S.bot.status=b.status;
  S.bot.balance=+(b.balance??S.bot.balance);
  S.bot.wins=+(b.wins??S.bot.wins);
  S.bot.losses=+(b.losses??S.bot.losses);
  if(b.config) Object.assign(S.bot.config,b.config);
  if(b.positions && !S.bot._loaded){
    S.bot.positions=b.positions.map(p=>({...p,peak:p.peak??p.entry,openedAt:p.openedAt||Date.now(),trail:+p.trail||0}));
    S.bot._loaded=true;
  }
  if(b.nTrades!=null) S.bot.nTrades=+b.nTrades;
}
function botOpen(side,reason){
  const c=S.bot.config;const price=side==='L'?S.ask:S.bid;if(!price) return;
  const dir=side==='L'?1:-1;
  const sl=+(price-dir*c.slPips*PIP).toFixed(2),tp=+(price+dir*c.tpPips*PIP).toFixed(2);
  const pos={id:'B'+Math.random().toString(36).slice(2,6).toUpperCase(),side,entry:price,sl,tp,size:c.size,openedAt:Date.now(),peak:price,trail:c.trail>0?c.trail*PIP:0,lev:c.lev};
  S.bot.positions.push(pos);S.bot.lastTradeAt=Date.now();
  S.bot.lastSignal=(side==='L'?'ACHAT':'VENTE')+' @ '+price.toFixed(2);
  S.bot.lastSignalReason=reason;
  API.post('/api/position_open.php',{source:'bot',side,size:c.size,entry:price,sl,tp,lev:c.lev,trail:c.trail});
  appendBotLog((side==='L'?'ACHAT':'VENTE')+' '+c.size+'oz @ '+fmt(price)+' ('+reason+')', side==='L'?'ok':'bad');
  sayBot('Le robot '+(side==='L'?'achete':'vend')+' ! Raison : '+reason, side==='L'?'good':'bad');
  toast('Robot : '+(side==='L'?'ACHAT':'VENTE')+' ouvert', 'info', 1400);
}
function botClose(p,reason,price){
  const dir=p.side==='L'?1:-1;const pnl=+((price-p.entry)*dir*p.size).toFixed(2);
  S.bot.positions=S.bot.positions.filter(x=>x.id!==p.id);
  S.bot.balance=+(S.bot.balance+pnl).toFixed(2);
  if(S.bot.balance>S.bot.peakEq)S.bot.peakEq=S.bot.balance;
  S.bot.maxDD=Math.max(S.bot.maxDD,(S.bot.peakEq-S.bot.balance)/S.bot.peakEq*100);
  API.post('/api/position_close.php',{id:p.id,reason,exit:price,source:'bot'});
  API.post('/api/bot.php',{action:'state',balance:S.bot.balance,maxDD:S.bot.maxDD}).catch(()=>{});
  appendBotLog('Fermeture '+p.side+' #'+p.id+' @ '+fmt(price)+' -> '+(pnl>=0?'+':'')+pnl.toFixed(2)+' ('+reason+')',pnl>=0?'ok':'bad');
  if(reason==='SL'||reason==='TP'){
    const msg = pnl>=0?'Gain de '+pnl.toFixed(2)+'$ !':'Perte de '+Math.abs(pnl).toFixed(2)+'$ (stop de protection)';
    sayBot(msg, pnl>=0?'good':'bad');
    toast(msg, pnl>=0?'ok':'bad', 1800);
  }
}
function botInd(cs,c){
  const need=Math.max(c.emaSlow,c.rsiLen,c.bbLen)+2;
  if(!cs||cs.length<need) return null;
  const eV=(a,l)=>{const k=2/(l+1);let v=0;for(let i=a.length-1-l;i<a.length-1;i++)v+=a[i].c;v/=l;for(let i=a.length-l;i<a.length;i++)v=a[i].c*k+v*(1-k);return v;};
  const rV=(a,l)=>{let g=0,lo=0;for(let i=a.length-l;i<a.length;i++){const d=a[i].c-a[i-1].c;if(d>=0)g+=d;else lo-=d;}if(l<=0)return 50;const ag=g/l,al=lo/l;if(al===0)return 100;return 100-100/(1+ag/al);};
  const bV=(a,l,m)=>{let s=0;for(let i=a.length-l;i<a.length;i++)s+=a[i].c;const mm=s/l;let v=0;for(let i=a.length-l;i<a.length;i++)v+=(a[i].c-mm)**2;const sd=Math.sqrt(v/l);return{mid:mm,up:mm+m*sd,dn:mm-m*sd,width:sd/mm};};
  return{ef:eV(cs,c.emaFast),es:eV(cs,c.emaSlow),rs:rV(cs,c.rsiLen),bb:bV(cs,c.bbLen,c.bbMult)};
}
function botOnTick(t){
  try{
    if(S.bot.status!=='on'){
      if(S.bot.status==='pause'){for(const p of[...S.bot.positions])botMg(p,t);}
      return;
    }
    const cs=S.candlesTF[1]||[];
    const c=S.bot.config;
    const i=botInd(cs,c);
    for(const p of[...S.bot.positions]) botMg(p,t);
    if(!i){
      const need=Math.max(c.emaSlow,c.rsiLen,c.bbLen)+2;
      S.bot.lastSignal='Observation...';
      S.bot.lastSignalReason='Chargement '+cs.length+'/'+need+' bougies';
      return;
    }
    if(S.bot.positions.length>=c.maxPos){S.bot.lastSignal='Trade en cours';return;}
    if(Date.now()-S.bot.lastTradeAt<c.cooldownSec*1000){
      S.bot.lastSignal='Attente...';
      S.bot.lastSignalReason='Pause '+Math.ceil((c.cooldownSec*1000-(Date.now()-S.bot.lastTradeAt))/1000)+'s';
      return;
    }
    let sq=true;
    if(c.useSqueeze&&cs.length>=c.bbLen+15){
      let w=0,n=0,lb=Math.min(30,cs.length-c.bbLen);
      for(let k=cs.length-lb;k<cs.length;k++){const bi=botInd(cs.slice(0,k+1),c);if(bi){w+=bi.bb.width;n++;}}
      if(n) sq=i.bb.width<=(w/n)*1.05; else sq=true;
    }
    const mom=Math.abs(i.ef-i.es)/Math.max(i.es,1);
    const bW=i.bb.width*t.mid;
    const dist=t.mid-i.bb.mid;
    const up=i.ef>i.es, dn=i.ef<i.es;
    // Zone de pullback : dans la moitie inferieure/superieure des BB
    const inBullZone = dist >= -bW*0.5 && dist <= bW*0.6;
    const inBearZone = dist <=  bW*0.5 && dist >= -bW*0.6;
    if(up && i.rs<72 && i.rs>28 && inBullZone && (sq||mom>0.000003)){ botOpen('L','Tendance haussiere, RSI '+i.rs.toFixed(0)); return; }
    if(dn && i.rs>28 && i.rs<72 && inBearZone && (sq||mom>0.000003)){ botOpen('S','Tendance baissiere, RSI '+i.rs.toFixed(0)); return; }
    S.bot.lastSignal=up?'Ca monte...':dn?'Ca descend...':'Pas de tendance';
  }catch(e){console.error('bot tick err',e);}
}
function botMg(p,t){
  try{
    if(!t.bid||!t.ask) return;
    const dir=p.side==='L'?1:-1;
    const mk=p.side==='L'?t.bid:t.ask;
    p.upnl=(mk-p.entry)*dir*p.size;
    if(p.trail>0){
      if(dir===1&&mk>p.peak)p.peak=mk;
      if(dir===-1&&mk<p.peak)p.peak=mk;
      const tr=p.peak-dir*p.trail;
      if(dir===1)p.sl=Math.max(p.sl,+tr.toFixed(2));
      else p.sl=Math.min(p.sl,+tr.toFixed(2));
    }
    if((dir===1&&mk<=p.sl)||(dir===-1&&mk>=p.sl)){ botClose(p,'SL',p.sl); return; }
    if((dir===1&&mk>=p.tp)||(dir===-1&&mk<=p.tp)){ botClose(p,'TP',p.tp); return; }
  }catch(e){}
}
function sayBot(txt, kind=''){
  try{
    const box=$('#botSay'); if(!box) return;
    const emojiMatch = txt.match(/^(\p{Extended_Pictographic}\s*)/u);
    let emoji='\uD83E\uDD16', rest=txt;
    if(emojiMatch){ emoji=emojiMatch[1].trim(); rest=txt.slice(emojiMatch[0].length); }
    box.className='bot-say '+(kind||'');
    box.innerHTML='<span class="bot-say-emoji">'+emoji+'</span><span>'+rest+'</span>';
  }catch(e){}
}
function renderBot(){
  try{
    const b=S.bot;
    const startBtn=$('#botStart');
    if(startBtn){
      startBtn.classList.toggle('running', b.status==='on');
      startBtn.classList.toggle('paused', b.status==='pause');
      startBtn.querySelector('.big-emoji').textContent = b.status==='on'?'\u23F9':(b.status==='pause'?'\u23F8':'\u25B6');
      startBtn.querySelector('.btn-lbl').textContent = b.status==='on'?'ARRETER le robot':(b.status==='pause'?'Continuer':'Démarrer le robot');
      startBtn.querySelector('.btn-sub').textContent = b.status==='on'?'Le robot joue en ce moment !':(b.status==='pause'?'En pause, clique pour reprendre':'Clique pour lancer !');
    }
    const pauseBtn=$('#botPause');
    if(pauseBtn){
      pauseBtn.textContent = b.status==='pause'?'Reprendre':'Pause';
      pauseBtn.disabled = (b.status==='off');
    }
    if(b.status==='off') sayBot('Robot en pause. Choisis ton risque puis demarre !','');
    else if(b.status==='pause') sayBot('En pause. Les trades en cours sont toujours geres.','warn');
    else if(b.status==='on' && !b.lastSignalReason) sayBot('En route ! Je surveille le marche...','good');
    $$('.risk-btn').forEach(btn=>{ btn.classList.toggle('active', btn.dataset.risk===currentRisk); });
    const pnl=b.balance-10000;const pe=$('#botPnl');
    const kpiPnl=pe?.parentElement;
    if(pe){pe.textContent=(pnl>=0?'+':'')+pnl.toFixed(2)+' $';pe.style.color=pnl>=0?'var(--up)':'var(--down)';}
    if(kpiPnl){kpiPnl.classList.toggle('bad',pnl<0);}
    const bb=$('#botBal'),bn=$('#botN'),bw=$('#botWR'),dd=$('#botDD');
    if(bb)bb.textContent=b.balance.toFixed(0);
    if(bn)bn.textContent=b.nTrades;
    const tot=b.wins+b.losses;
    if(bw)bw.textContent=tot?Math.round((b.wins/tot)*100)+'%':'0%';
    if(dd)dd.textContent=Math.round(b.maxDD||0)+'%';
    const ul=$('#botPosList');
    if(ul){
      ul.innerHTML=b.positions.length?b.positions.map(p=>{
        const dir=p.side==='L'?1:-1;const mk=p.side==='L'?S.bid:S.ask;
        const u=(mk-p.entry)*dir*p.size;
        return '<li><span class="'+p.side+'">'+(p.side==='L'?'\uD83D\uDFE2':'\uD83D\uDD34')+'</span><span>'+p.size.toFixed(2)+'oz @ '+fmt(p.entry)+'</span><span class="pnl '+(u>=0?'up':'down')+'">'+(u>=0?'+':'')+u.toFixed(2)+'</span></li>';
      }).join(''):'<li class="muted">aucun trade pour l\'instant</li>';
    }
  }catch(e){}
}

function toggleExpert(panelId, btnId){
  const p=$('#'+panelId), b=$('#'+btnId);
  if(!p)return;
  p.classList.toggle('show');
  const on=p.classList.contains('show');
  if(b) b.textContent = on ? 'Masquer les options' : (btnId==='botExpertToggle'?'Voir les parametres experts':'Options avancees');
  if(panelId==='botExpertPanel'||btnId==='toggleExpert') setTimeout(resizeCanvases,50);
}

function bindUI(){try{
  const wc=$('#welcomeClose'); if(wc) wc.onclick=()=>$('#welcome')?.classList.add('hidden');
  $$('.tf button').forEach(b=>b.onclick=()=>{
    $$('.tf button').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    S.tf=+b.dataset.tf;S.candles=S.candlesTF[S.tf]||[];
    computeIndicators();draw();
  });
  $$('.indic input').forEach(i=>i.onchange=()=>{computeIndicators();draw();});
  const tglExp=$('#toggleExpert');
  if(tglExp) tglExp.onclick=()=>{
    document.querySelectorAll('.expert-only').forEach(el=>el.classList.toggle('show'));
    const anyOn=document.querySelector('.expert-only.show');
    tglExp.textContent = anyOn?'Masquer experts':'Options experts';
    setTimeout(resizeCanvases,50);
  };
  if(overlayCanvas){
    overlayCanvas.addEventListener('mousemove',e=>{const r=overlayCanvas.getBoundingClientRect();S.hover.x=e.clientX-r.left;S.hover.y=e.clientY-r.top;});
    overlayCanvas.addEventListener('mouseleave',()=>{S.hover.x=-1;S.hover.y=-1;draw();});
  }
  window.addEventListener('keydown',e=>{
    if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
    if(e.key==='F1'){e.preventDefault();openManual('L',S.size);}
    else if(e.key==='F2'){e.preventDefault();openManual('S',S.size);}
    else if(e.key==='F3'){e.preventDefault();const p=S.positions.find(x=>x.source==='manual');if(p)closeManual(p.id,'hotkey');}
  });
  let _rszT;
  window.addEventListener('resize',()=>{clearTimeout(_rszT);_rszT=setTimeout(resizeCanvases,120);});

  $$('.risk-btn').forEach(btn=>btn.onclick=()=>{
    applyRiskPreset(btn.dataset.risk);
    toast('Niveau choisi : '+RISK_PRESETS[btn.dataset.risk].name,'info',1500);
    sayBot('Mode '+RISK_PRESETS[btn.dataset.risk].name+' selectionne. Clique sur Demarrer !','');
    renderBot();
  });
  const bs=$('#botStart');
  if(bs)bs.onclick=async()=>{ if(S.bot.status==='on') await botSend('stop'); else await botSend('start'); };
  const bp=$('#botPause');
  if(bp)bp.onclick=async()=>{ if(S.bot.status==='pause') await botSend('start'); else if(S.bot.status==='on') await botSend('pause'); };
  const br=$('#botReset');
  if(br)br.onclick=async()=>{
    if(!confirm('Es-tu sur de vouloir tout effacer et repartir a zero ?')) return;
    S.bot.positions=[];S.bot.balance=10000;S.bot.wins=0;S.bot.losses=0;S.bot.nTrades=0;S.bot.maxDD=0;S.bot.peakEq=10000;S.bot.lastSignal='-';
    const bl=$('#botLog');if(bl)bl.innerHTML='';
    await botSend('reset');
    sayBot('Compteur remis a 10 000 !','good');
    toast('Robot reinitialise','ok');
    renderBot();
  };
  $('#botExpertToggle')?.addEventListener('click',()=>toggleExpert('botExpertPanel','botExpertToggle'));
  const ba=$('#botApply');if(ba)ba.onclick=()=>{
    Object.assign(S.bot.config,botCfgUI());
    API.post('/api/bot.php',{action:'config',config:S.bot.config});
    toast('Parametres sauvegardes','ok');
  };

  $$('.amt-btn').forEach(b=>b.onclick=()=>{
    $$('.amt-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    applyRiskUsdt(+b.dataset.usdt);
  });
  $('#marketBuy').onclick=()=>openManual('L',S.size);
  $('#marketSell').onclick=()=>openManual('S',S.size);
  $('#closeAll').onclick=()=>{
    if(!confirm('Fermer tous tes trades en cours ?')) return;
    [...S.positions.filter(p=>p.source==='manual')].forEach(p=>closeManual(p.id,'close-all'));
  };
  $('#manExpertToggle')?.addEventListener('click',()=>toggleExpert('manExpertPanel','manExpertToggle'));

  const sz=$('#size');if(sz)sz.addEventListener('input',e=>{S.size=+e.target.value||0;updateRiskDisplay();});
  const sl=$('#slPips');if(sl)sl.addEventListener('input',e=>{S.slPips=+e.target.value||0;S.tpPips=Math.round(S.slPips*S.rr);const t=document.getElementById('tpPips');if(t)t.value=S.tpPips;updateRiskDisplay();});
  const tp=$('#tpPips');if(tp)tp.addEventListener('input',e=>{S.tpPips=+e.target.value||0;});
  const rr=$('#rr');if(rr)rr.addEventListener('input',e=>{S.rr=+e.target.value||0;S.tpPips=Math.round(S.slPips*S.rr);const t=document.getElementById('tpPips');if(t)t.value=S.tpPips;});
  const tr=$('#trail');if(tr)tr.addEventListener('input',e=>{S.trailPips=+e.target.value||0;});
  const lv=$('#lev');if(lv)lv.addEventListener('input',e=>{S.lev=+e.target.value;$('#levVal').textContent=S.lev+'x';});

}catch(e){console.error('bind err',e);}}

const _logSeen=new Set();

async function loadState(){try{
  const s=await API.get('/api/state.php');
  if(!s||!s.ok) return;
  S.startBal=s.startBalance||10000;
  if(!S._liveAligned) S.balance=s.balance||S.startBal;
  S.equityCurve=s.stats?.manual?.equity||[s.balance||S.balance];
  if(!S.positions.length && s.positions){
    S.positions=(s.positions.filter(p=>p.source==='manual')||[]).map(p=>({...p,upnl:0}));
  }
  if(s.bot)syncBot(s.bot);
  updateAccount();
  if(s.bot?.config && !S._cfgLoaded){
    S._cfgLoaded=true;
    const setV=(id,v)=>{const el=document.getElementById(id);if(el&&v!=null){if(el.type==='checkbox')el.checked=!!v;else el.value=v;}};
    setV('botSize',s.bot.config.size);setV('botLev',s.bot.config.lev);
    setV('botSl',s.bot.config.slPips);setV('botTp',s.bot.config.tpPips);
    setV('botTrail',s.bot.config.trail);setV('botCd',s.bot.config.cooldownSec);
    setV('botMax',s.bot.config.maxPos);setV('botSqueeze',s.bot.config.useSqueeze);
  }
  renderBot(); updateRiskDisplay();
}catch(e){}}

async function main(){
  applyRiskPreset('normal');
  applyRiskUsdt(100);
  bindUI();
  resizeCanvases();
  renderSrc('conn');
  computeIndicators(); draw();
  try{connectBybitWS();}catch(e){setTimeout(connectBinanceWS,500);}
  setTimeout(loadState,400);
  setInterval(loadState,8000);
  renderBot();
  updateRiskDisplay();
}

let _lastDrawTick=-1;
function raf(){
  try{
    if(S.tickCount && S.tickCount!==_lastDrawTick && ctx){
      _lastDrawTick=S.tickCount;
      draw();
    }
  }catch(e){}
  requestAnimationFrame(raf);
}

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',main,{once:true});}
else{main();}
requestAnimationFrame(raf);
