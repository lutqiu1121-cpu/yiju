const GONG=[0,2,4,7,9];                       // 宫 商 角 徵 羽
const hz=(semi,base=196)=>base*Math.pow(2,semi/12);
let SEED=20261123;
function rnd(){ SEED=(SEED*1103515245+12345)&0x7fffffff; return SEED/0x3fffffff-1; }

/* 混响：程序生成 IR，山谷厅堂感；干声 + 湿声并联 */
function makeIR(ac,dur=1.9,decay=2.8){
  const n=Math.ceil(ac.sampleRate*dur), b=ac.createBuffer(2,n,ac.sampleRate);
  for(let c=0;c<2;c++){
    const d=b.getChannelData(c);
    for(let i=0;i<n;i++){
      const t=i/n, early=i<ac.sampleRate*.012?.35:1;
      d[i]=rnd()*Math.pow(1-t,decay)*early*.55;
    }
  }
  return b;
}
function makeBus(ac){
  const dry=ac.createGain(), wet=ac.createGain(), conv=ac.createConvolver(), bus=ac.createGain();
  conv.buffer=makeIR(ac); dry.gain.value=.86; wet.gain.value=.26;
  bus.connect(dry); bus.connect(conv); conv.connect(wet);
  return {bus,dry,wet};
}

/* Karplus–Strong 拨弦：真实弦的泛音列与自然衰减 */
function ksBuffer(ac,freq,dur,decay=1.7,bright=.42){
  const sr=ac.sampleRate, n=Math.ceil(sr*dur), N=Math.max(2,Math.round(sr/freq));
  const b=ac.createBuffer(1,n,sr), out=b.getChannelData(0), ring=new Float32Array(N);
  let lp=0;
  for(let i=0;i<N;i++){ lp+=bright*(rnd()-lp); ring[i]=lp; }
  const d=Math.pow(.5,N/(sr*decay));
  let idx=0, peak=0;
  for(let i=0;i<n;i++){
    const cur=ring[idx], nxt=ring[(idx+1)%N];
    ring[idx]=(cur+nxt)*.5*d;
    const fade=i>n-sr*.05?(n-i)/(sr*.05):1;
    out[i]=cur*fade; if(Math.abs(out[i])>peak)peak=Math.abs(out[i]);
    idx=(idx+1)%N;
  }
  if(peak>0) for(let i=0;i<n;i++) out[i]/=peak;
  return b;
}
const _ksCache=new WeakMap();
function pluck(ac,dest,o){
  const f=o.f0, dur=o.dur||1.6, t=o.t;
  let cache=_ksCache.get(ac); if(!cache){cache=new Map();_ksCache.set(ac,cache);}
  const key=Math.round(f)+'|'+Math.round(dur*10)+'|'+(o.decay||1.7)+'|'+(o.bright||.42);
  let buf=cache.get(key);
  if(!buf){ buf=ksBuffer(ac,f,dur,o.decay||1.7,o.bright||.42); cache.set(key,buf); }
  const src=ac.createBufferSource(), g=ac.createGain();
  src.buffer=buf;
  const vol=Math.max(.0002,o.gain??.20);
  g.gain.setValueAtTime(vol,t);
  g.gain.exponentialRampToValueAtTime(.0001,t+dur*.96);
  // 绰注：古琴走手音，由低滑上或由高滑下
  if(o.slide){
    src.playbackRate.setValueAtTime(o.slide<0?.94:1.05,t);
    src.playbackRate.linearRampToValueAtTime(1,t+Math.abs(o.slide));
  }
  src.connect(g); g.connect(dest); src.start(t); src.stop(t+dur+.02);
  src.onended=()=>{try{src.disconnect();g.disconnect();}catch(e){}};
}

/* 箫：正弦 + 二次泛音 + 气声噪声 + 轻微颤音，缓入缓出 */
function xiao(ac,dest,o){
  const t=o.t,dur=o.dur||1.5,f=o.f0;
  const osc=ac.createOscillator(), g=ac.createGain();
  osc.type='sine'; osc.frequency.setValueAtTime(f*.992,t);
  osc.frequency.linearRampToValueAtTime(f,t+.16);
  const lfo=ac.createOscillator(), lg=ac.createGain();
  lfo.frequency.value=4.7; lg.gain.value=f*.006;
  lfo.connect(lg); lg.connect(osc.frequency);
  const peak=Math.max(.0002,o.gain??.09);
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(peak,t+.22);
  g.gain.setValueAtTime(peak,t+dur*.65);
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  osc.connect(g); g.connect(dest);
  osc.start(t); osc.stop(t+dur+.03); lfo.start(t); lfo.stop(t+dur+.03);
  // 气声
  const nb=ac.createBuffer(1,Math.ceil(ac.sampleRate*dur),ac.sampleRate), nd=nb.getChannelData(0);
  for(let i=0;i<nd.length;i++) nd[i]=rnd()*(1-i/nd.length);
  const ns=ac.createBufferSource(), bp=ac.createBiquadFilter(), ng=ac.createGain();
  ns.buffer=nb; bp.type='bandpass'; bp.frequency.value=f*3.2; bp.Q.value=1.4;
  ng.gain.setValueAtTime(.0001,t);
  ng.gain.exponentialRampToValueAtTime(peak*.30,t+.25);
  ng.gain.exponentialRampToValueAtTime(.0001,t+dur);
  ns.connect(bp); bp.connect(ng); ng.connect(dest); ns.start(t); ns.stop(t+dur+.02);
  osc.onended=()=>{try{osc.disconnect();g.disconnect();lfo.disconnect();lg.disconnect();ns.disconnect();bp.disconnect();ng.disconnect();}catch(e){}};
}

/* 编钟：非谐分音，金属余韵 */
function bianzhong(ac,dest,o){
  const t=o.t,f=o.f0,parts=[[1,.9,2.1],[2.76,.36,1.5],[5.40,.18,1.0],[8.93,.09,.7]];
  parts.forEach(([r,a,dec])=>{
    const osc=ac.createOscillator(), g=ac.createGain();
    osc.type='sine'; osc.frequency.value=f*r*(1+(rnd()*.002));
    const peak=Math.max(.0002,(o.gain??.14)*a);
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(peak,t+.008);
    g.gain.exponentialRampToValueAtTime(.0001,t+dec);
    osc.connect(g); g.connect(dest); osc.start(t); osc.stop(t+dec+.03);
    osc.onended=()=>{try{osc.disconnect();g.disconnect();}catch(e){}};
  });
}
/* 鼓、木鱼/棋子叩枰、磬、纸帛 */
function drum(ac,dest,t,gain=.18){
  const o=ac.createOscillator(),g=ac.createGain();
  o.type='sine'; o.frequency.setValueAtTime(155,t); o.frequency.exponentialRampToValueAtTime(52,t+.25);
  g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(.0001,t+.28);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t+.30);
  o.onended=()=>{try{o.disconnect();g.disconnect();}catch(e){}};
}
function noiseHit(ac,dest,o){
  const t=o.t,dur=o.dur,n=Math.max(1,Math.ceil(ac.sampleRate*dur));
  const b=ac.createBuffer(1,n,ac.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<n;i++) d[i]=rnd()*Math.pow(1-i/n,o.curve||2);
  const s=ac.createBufferSource(), f=ac.createBiquadFilter(), g=ac.createGain();
  s.buffer=b; f.type=o.filter||'bandpass'; f.frequency.value=o.freq||900; f.Q.value=o.q||1.2;
  const peak=Math.max(.0002,o.gain??.10);
  g.gain.setValueAtTime(peak,t); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t); s.stop(t+dur+.01);
  s.onended=()=>{try{s.disconnect();f.disconnect();g.disconnect();}catch(e){}};
}
function muyu(ac,dest,t,gain=.16){
  noiseHit(ac,dest,{t,dur:.075,freq:820,q:2.2,gain:gain*.9,curve:3});
  const o=ac.createOscillator(),g=ac.createGain();
  o.type='sine'; o.frequency.setValueAtTime(430,t); o.frequency.exponentialRampToValueAtTime(300,t+.06);
  g.gain.setValueAtTime(gain*.8,t); g.gain.exponentialRampToValueAtTime(.0001,t+.09);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t+.10);
  o.onended=()=>{try{o.disconnect();g.disconnect();}catch(e){}};
}
function qing(ac,dest,t,gain=.10){
  [1,1.51,2.32].forEach((r,i)=>{
    const o=ac.createOscillator(),g=ac.createGain();
    o.type='sine'; o.frequency.value=1180*r;
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(gain/(i+1),t+.006);
    g.gain.exponentialRampToValueAtTime(.0001,t+1.05-i*.2);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t+1.10);
    o.onended=()=>{try{o.disconnect();g.disconnect();}catch(e){}};
  });
}

/* 事件 → 古器编排，每个事件 2–4 通道，彼此不同 */
/* 大钟：非谐分音 + 低频基音 + 8~9 秒长尾，专供终局与突破 */
function dazhong(ac,dest,o){
  const t=o.t,f=o.f0,gain=o.gain??.15,dec=o.dec??3.2;
  [[.5,.55,dec*1.15],[1,.95,dec],[2.76,.36,dec*.72],[5.40,.17,dec*.5],[8.93,.08,dec*.32]].forEach(([r,a,d])=>{
    const osc=ac.createOscillator(),g=ac.createGain();
    osc.type='sine'; osc.frequency.value=f*r*(1+(rnd()*.0015));
    const pk=Math.max(.0002,gain*a);
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(pk,t+.02);
    g.gain.exponentialRampToValueAtTime(.0001,t+d);
    osc.connect(g); g.connect(dest); osc.start(t); osc.stop(t+d+.04);
    osc.onended=()=>{try{osc.disconnect();g.disconnect();}catch(e){}};
  });
}
function liftWet(wet,t,dur){
  if(!wet)return;
  try{
    wet.gain.cancelScheduledValues(t);
    wet.gain.setValueAtTime(.26,t);
    wet.gain.linearRampToValueAtTime(.58,t+.45);
    wet.gain.linearRampToValueAtTime(.26,t+dur);
  }catch(e){}
}
/* 终局：三响递降大钟 + 低鼓 + 磬 + 箫，余韵约 3.4 秒 */
function heavyFinish(ac,dest,t,wet){
  [0,-3,-5].forEach((semi,i)=>{
    dazhong(ac,dest,{t:t+i*.92,f0:hz(semi,98),gain:.165-i*.018,dec:3.25-i*.25});
    drum(ac,dest,t+i*.92+.05,.085);
    qing(ac,dest,t+i*.92+.22,.070);
  });
  xiao(ac,dest,{t:t+.24,f0:hz(0,196),dur:3.0,gain:.060});
  pluck(ac,dest,{t:t+2.85,f0:hz(0,98),dur:1.9,gain:.070,bright:.24,decay:1.6});
  qing(ac,dest,t+3.05,.080);
  liftWet(wet,t,3.4);
}
/* 境界突破：五响递进钟（宫商角徵羽）+ 箫 + 收尾大钟，约 3.6 秒 */
function breachBells(ac,dest,t,wet){
  GONG.forEach((semi,i)=>{
    dazhong(ac,dest,{t:t+i*.46,f0:hz(semi,196),gain:.090+i*.014,dec:2.15+i*.18});
    qing(ac,dest,t+i*.46+.10,.045);
  });
  xiao(ac,dest,{t:t+1.0,f0:hz(7,392),dur:2.6,gain:.075});
  dazhong(ac,dest,{t:t+2.55,f0:hz(0,98),gain:.17,dec:3.30});
  drum(ac,dest,t+2.55,.10);
  liftWet(wet,t,3.6);
}
function eventFx(ac,dest,name,t,wet){
  switch(name){
    case 'place':   muyu(ac,dest,t,.17); break;
    case 'capture': drum(ac,dest,t,.17); qing(ac,dest,t+.04,.07); break;
    case 'check':   bianzhong(ac,dest,{t,f0:hz(-5,196),gain:.16}); break;
    case 'flip':    noiseHit(ac,dest,{t,dur:.10,freq:3100,filter:'highpass',q:.7,gain:.05,curve:1.4});
                    pluck(ac,dest,{t:t+.02,f0:hz(7,392),dur:.7,gain:.06,bright:.25}); break;
    case 'win':     [0,2,4,7,9,12].forEach((s,i)=>pluck(ac,dest,{t:t+i*.065,f0:hz(s,262),dur:1.1,gain:.15,bright:.55})); break;
    case 'finish':  heavyFinish(ac,dest,t,wet); break;
    case 'breach':  breachBells(ac,dest,t,wet); break;
    case 'tap':     muyu(ac,dest,t,.055); break;
  }
}

/* 五声音高：宫 商 角 徵 羽 */
function laneHz(l){ return [hz(0,196),hz(2,196),hz(4,196),hz(7,196),hz(9,196)][l]; }
/* 五弦：直接点击，每弦音高与明暗不同 */
function laneFx(ac,dest,type,l,t){
  const bright=[.40,.30,.48,.56,.34][l], slide=[-.16,0,.10,-.20,.14][l];
  pluck(ac,dest,{t,f0:laneHz(l),dur:1.35+l*.12,gain:.14,bright,slide});
}

/* 散板底乐：不方整的拍距，古筝 + 箫 + 间插钟 */
const SANBAN=[0,.85,1.75,2.9,3.5,4.7,5.35,6.6,7.2,8.5,9.1,10.4];
function bgmStep(ac,dest,t,step,vol){
  const deg=GONG[step%5]+(step%3===0?12:0);
  pluck(ac,dest,{t,f0:hz(deg,196),dur:1.9,gain:.085*vol,bright:.36,decay:2.2,slide:step%4===0?-.20:0});
  if(step%4===0) pluck(ac,dest,{t,f0:hz(0,98),dur:2.4,gain:.065*vol,bright:.28,decay:2.6});
  if(step%6===3) xiao(ac,dest,{t:t+.12,f0:hz(deg+12,196),dur:1.8,gain:.030*vol});
  if(step%8===6) bianzhong(ac,dest,{t:t+.06,f0:hz(0,196),gain:.045*vol});
}



/* ===== 单例音频总线：整站共用一条 AudioContext，事件反馈与轮弦同源 ===== */
let _A=null;
export function getAudio(){
  if(!_A){
    const AC=window.AudioContext||window.webkitAudioContext;
    const ac=new AC();
    const master=ac.createGain(); master.gain.value=.92; master.connect(ac.destination);
    const bus=makeBus(ac); bus.dry.connect(master); bus.wet.connect(master);
    _A={ac,master,bus};
  }
  if(_A.ac.state==='suspended')_A.ac.resume();
  return _A;
}
export function setMuted(on){ if(_A)_A.master.gain.setTargetAtTime(on?0:.92,_A.ac.currentTime,.02); }
export const now=()=>_A?_A.ac.currentTime:0;
export { GONG, SANBAN, hz, makeBus, pluck, xiao, bianzhong, drum, noiseHit, muyu, qing,
         dazhong, liftWet, heavyFinish, breachBells, eventFx, laneHz, laneFx, bgmStep };
