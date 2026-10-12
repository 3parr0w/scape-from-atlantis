/* Survive: Escape from Atlantis — pure game engine (no DOM, no I/O). Works in browser and Node.
   State is plain JSON. apply(state, playerIdx, action) -> {state, events} | {error}. view(state, playerIdx) hides secrets.
   Actions: placePerson{k,id} placeBoat{k} | skipTile, dolph{p,to}, wind{b,to}, mcreat{tile,c,to} | movePerson{p,to}, moveBoat{b,to}, undo, endMoves
            | take{k} | roll | moveCreature{c,to}, skipCreature | defend{play} (only the player in state.pending.queue[0]) */
(function(root){'use strict';
const W=17,H=11,SAFE=['0,0','16,0','0,10','16,10'],
DOCK={'1,0':'0,0','0,1':'0,0','15,0':'16,0','16,1':'16,0','1,9':'0,10','0,9':'0,10','15,9':'16,10','16,9':'16,10'},
SERP=['8,5','0,1','16,1','0,9','16,9'],CUT=['8,5','4,4','12,4'],
CONT={shark:6,whale:5,boat:4,whirl:2,volc:1,dolph:3,wind:3,mserp:2,mshark:2,mwhale:2,rshark:5,rwhale:5},
NUMS=[1,1,2,2,3,3,4,4,5,6],MV={mserp:'serp',mshark:'shark',mwhale:'whale'},RANGE={serp:1,shark:2,whale:3},
DIE=['serp','serp','shark','shark','whale','whale'],PUBLIC=['shark','whale','boat','whirl','volc'];
const kk=(c,r)=>c+','+r,P=k=>k.split(',').map(Number);
const NB=k=>{const[c,r]=P(k);return(c&1?[[1,0],[1,1],[-1,0],[-1,1],[0,-1],[0,1]]:[[1,0],[1,-1],[-1,0],[-1,-1],[0,-1],[0,1]]).map(([a,b])=>[c+a,r+b]).filter(([x,y])=>x>=0&&y>=0&&x<W&&y<H).map(([x,y])=>kk(x,y))};
const CELLS=[],LAND=[];
for(let r=0;r<H;r++)for(let c=0;c<W;c++)CELLS.push(kk(c,r));
[3,4,5,6,7,6,5,4,3].forEach((L,i)=>{const c=i+4,s=5-(L-1)/2-.5*(c&1);for(let r=s;r<s+L;r++)if(!CUT.includes(kk(c,r)))LAND.push(kk(c,r))});
const rand=S=>{S.seed=(S.seed+0x6D2B79F5)|0;let t=Math.imul(S.seed^S.seed>>>15,1|S.seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const shuffle=(S,a)=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rand(S)*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const isSea=(S,k)=>!S.tiles[k]&&!SAFE.includes(k),boatAt=(S,k)=>S.boats.find(b=>b.k===k);
const riders=(S,b)=>S.people.filter(p=>p.loc.t==='boat'&&p.loc.b===b.id);
const pk=(S,p)=>p.loc.t==='boat'?S.boats.find(b=>b.id===p.loc.b).k:p.loc.k;
const swim=(S,k)=>S.people.filter(p=>p.loc.t==='sea'&&p.loc.k===k),crAt=(S,k,t)=>S.creat.filter(c=>c.k===k&&(!t||t.includes(c.t)));
const own=(S,b)=>{const n={};riders(S,b).forEach(p=>n[p.o]=(n[p.o]||0)+1);const m=Math.max(0,...Object.values(n));return Object.keys(n).filter(o=>n[o]===m).map(Number)};
const canB=(S,b,pl)=>!riders(S,b).length||own(S,b).includes(pl),cap=(S,k)=>{const b=boatAt(S,k);return b&&riders(S,b).length<3?{t:'boat',b:b.id}:null};
const die=p=>{p.loc={t:'dead'}},sink=(S,b,sw)=>{riders(S,b).forEach(p=>{p.loc=sw?{t:'sea',k:b.k}:{t:'dead'}});S.boats=S.boats.filter(x=>x!==b)};
const hazard=(S,k)=>{if(crAt(S,k,['serp','shark']).length)swim(S,k).forEach(die)};
const empty=(S,k)=>isSea(S,k)&&!boatAt(S,k)&&!crAt(S,k).length&&!swim(S,k).length;
function opts(S,p){const L=p.loc,o=[];
 if(L.t==='land')NB(L.k).forEach(n=>{if(S.tiles[n])o.push({k:n,to:{t:'land',k:n}});else if(isSea(S,n))o.push({k:n,to:cap(S,n)||{t:'sea',k:n}})});
 else if(L.t==='sea'||L.t==='boat'){const k=pk(S,p);if(L.t==='sea'&&cap(S,k))o.push({k,to:cap(S,k)});if(DOCK[k])o.push({k:DOCK[k],to:{t:'safe'}});NB(k).forEach(n=>{if(isSea(S,n))o.push({k:n,to:cap(S,n)||{t:'sea',k:n}})})}
 return o}
function reach(S,k,n,stop){const seen={[k]:0},q=[k],out=[];while(q.length){const u=q.shift();if(seen[u]>=n||(u!==k&&stop&&stop(u)))continue;NB(u).forEach(v=>{if(isSea(S,v)&&seen[v]===undefined){seen[v]=seen[u]+1;q.push(v);out.push(v)}})}return out}
function cands(S){for(const t of['b','f','m']){const l=Object.keys(S.tiles).filter(k=>S.tiles[k].type===t&&NB(k).some(x=>isSea(S,x)));if(l.length)return l}return Object.keys(S.tiles)}
function newGame(n,seed){const S={n,seed:(seed==null?Date.now():seed)|0,tiles:{},people:[],boats:[],creat:[],hands:Array.from({length:n},()=>[]),boatsLeft:Array(n).fill(2),cur:0,phase:'setP',moves:3,roll:null,pending:null,over:false,result:null,undo:[],id:100};
 const ty=shuffle(S,[...Array(16).fill('b'),...Array(16).fill('f'),...Array(8).fill('m')]),cs=shuffle(S,Object.entries(CONT).flatMap(([k,v])=>Array(v).fill(k)));
 const tl=cs.map((c,i)=>({type:ty[i],cont:c})),v=tl.find(t=>t.cont==='volc');
 if(v.type!=='m'){const m=tl.find(t=>t.type==='m');[m.cont,v.cont]=[v.cont,m.cont]}
 shuffle(S,LAND).forEach((k,i)=>{S.tiles[k]=tl[i]});
 let id=0;for(let o=0;o<n;o++)NUMS.forEach(m=>S.people.push({id:id++,o,n:m,loc:{t:'hand'}}));
 SERP.forEach(k=>S.creat.push({id:++S.id,t:'serp',k}));return S}
function dests(S,pl,sel,mode){sel=sel||{};const ph=S.phase;if(S.pending||S.over||pl!==S.cur)return[];
 if(ph==='setP')return Object.keys(S.tiles).filter(k=>!S.people.some(p=>p.loc.t==='land'&&p.loc.k===k));
 if(ph==='setB')return CELLS.filter(k=>isSea(S,k)&&NB(k).some(x=>S.tiles[x])&&!boatAt(S,k));
 const p=S.people.find(x=>x.id===sel.p),b=S.boats.find(x=>x.id===sel.b),c=S.creat.find(x=>x.id===sel.c),h=S.hands[pl];
 if(ph==='take')return cands(S);
 if(ph==='move'&&S.moves>0){if(p&&p.o===pl&&['land','sea','boat'].includes(p.loc.t))return opts(S,p).map(o=>o.k);if(b&&canB(S,b,pl))return NB(b.k).filter(k=>isSea(S,k)&&!boatAt(S,k))}
 if(ph==='play'){
  if(mode==='dolph'&&h.includes('dolph')&&p&&p.o===pl&&p.loc.t==='sea')return reach(S,p.loc.k,3);
  if(mode==='wind'&&h.includes('wind')&&b&&canB(S,b,pl))return reach(S,b.k,3).filter(k=>!boatAt(S,k));
  if(MV[mode]&&h.includes(mode)&&c&&c.t===MV[mode])return CELLS.filter(k=>empty(S,k))}
 if(ph==='creature'&&c&&c.t===S.roll)return reach(S,c.k,RANGE[c.t],c.t==='shark'?k=>swim(S,k).length>0:c.t==='whale'?k=>{const bb=boatAt(S,k);return!!bb&&riders(S,bb).length>0}:null);
 return[]}
const nextWith=(S,f)=>{for(let i=1;i<=S.n;i++){const o=(S.cur+i)%S.n;if(f(o))return o}return-1};
function startTurn(S,ev){S.phase='play';S.moves=3;S.undo=[];S.roll=null;ev.push({type:'turn',cur:S.cur})}
function endGame(S,ev){S.over=true;S.phase='end';S.result=[...Array(S.n).keys()].map(o=>{const nums=S.people.filter(p=>p.o===o&&p.loc.t==='safe').map(p=>p.n);return{o,nums,total:nums.reduce((a,b)=>a+b,0)}});ev.push({type:'end'})}
function boatArrive(S,b,ev){if(!riders(S,b).length)return;const k=b.k;if(crAt(S,k,['serp']).length){sink(S,b,0);ev.push({type:'devoured',k})}else if(crAt(S,k,['whale']).length){sink(S,b,1);hazard(S,k);ev.push({type:'capsize',k})}}
function finish(S,c,ev){const k=c.k;
 if(c.t==='whale'){const b=boatAt(S,k);if(b&&riders(S,b).length){sink(S,b,1);hazard(S,k);ev.push({type:'capsize',k})}}
 else{swim(S,k).forEach(die);if(c.t==='serp'){const b=boatAt(S,k);if(b&&riders(S,b).length){sink(S,b,0);ev.push({type:'devoured',k})}}}}
function arrive(S,c,k,mv,ev){c.k=k;let q=[],tile;
 if(c.t==='whale'){const b=boatAt(S,k);if(b&&riders(S,b).length){q=own(S,b).filter(o=>o!==mv);tile='rwhale'}}
 else if(c.t==='shark'){q=[...new Set(swim(S,k).map(p=>p.o))].filter(o=>o!==mv);tile='rshark'}
 if(q.length)S.pending={c:c.id,k,mover:mv,queue:q,tile};else finish(S,c,ev)}
function apply(S0,pl,a){const S=JSON.parse(JSON.stringify(S0)),ev=[],err=m=>({error:m}),ok=()=>({state:S,events:ev});
 if(S.over)return err('بازی تمام شده');const ph=S.phase;
 if(a.t==='defend'){const pd=S.pending;if(!pd||pd.queue[0]!==pl)return err('نوبت تصمیم تو نیست');const c=S.creat.find(x=>x.id===pd.c),h=S.hands[pl];
  if(a.play&&h.includes(pd.tile)){h.splice(h.indexOf(pd.tile),1);ev.push({type:'defended',pl,tile:pd.tile});S.creat=S.creat.filter(x=>x!==c);S.pending=null;S.cur=pd.mover;S.cur=(S.cur+1)%S.n;startTurn(S,ev);return ok()}
  pd.queue.shift();if(!pd.queue.length){S.pending=null;finish(S,c,ev);S.cur=(S.cur+1)%S.n;startTurn(S,ev)}return ok()}
 if(S.pending)return err('منتظر تصمیم دفاعی');
 if(a.t==='undo'){if(pl!==S.cur||!S.undo.length)return err('چیزی برای برگرداندن نیست');const u=S.undo,R=JSON.parse(u.pop());R.undo=u;return{state:R,events:[]}}
 if(pl!==S.cur)return err('نوبت تو نیست');
 const snap=()=>S.undo.push(JSON.stringify(Object.assign({},S,{undo:null}))),
  D=()=>dests(S,pl,{p:a.p,b:a.b,c:a.c},a.t==='mcreat'?a.tile:a.t).includes(a.to||a.k),
  useTile=t=>{S.hands[pl].splice(S.hands[pl].indexOf(t),1);S.phase='move'};
 switch(a.t){
 case'placePerson':{if(ph!=='setP'||!dests(S,pl).includes(a.k))return err('خانه‌ی نامعتبر');const m=S.people.filter(p=>p.o===pl&&p.loc.t==='hand'),p=m.find(x=>x.id===a.id)||m[0];p.loc={t:'land',k:a.k};
  const nx=nextWith(S,q=>S.people.some(x=>x.o===q&&x.loc.t==='hand'));if(nx<0){S.phase='setB';S.cur=0}else S.cur=nx;return ok()}
 case'placeBoat':{if(ph!=='setB'||!dests(S,pl).includes(a.k))return err('خانه‌ی نامعتبر');S.boats.push({id:++S.id,k:a.k});S.boatsLeft[pl]--;
  const nx=nextWith(S,q=>S.boatsLeft[q]>0);if(nx<0){S.cur=0;startTurn(S,ev)}else S.cur=nx;return ok()}
 case'skipTile':if(ph!=='play')return err('الان نه');S.phase='move';return ok();
 case'dolph':if(ph!=='play'||!D())return err('حرکت نامعتبر');snap();{const p=S.people.find(x=>x.id===a.p);p.loc={t:'sea',k:a.to};hazard(S,a.to)}useTile('dolph');return ok();
 case'wind':if(ph!=='play'||!D())return err('حرکت نامعتبر');snap();{const b=S.boats.find(x=>x.id===a.b);b.k=a.to;boatArrive(S,b,ev)}useTile('wind');return ok();
 case'mcreat':if(ph!=='play'||!D())return err('حرکت نامعتبر');snap();S.creat.find(x=>x.id===a.c).k=a.to;useTile(a.tile);return ok();
 case'movePerson':{if(ph!=='move'||!D())return err('حرکت نامعتبر');snap();const p=S.people.find(x=>x.id===a.p),o=opts(S,p).find(x=>x.k===a.to);p.loc=o.to;S.moves--;
  if(o.to.t==='sea')hazard(S,o.to.k);if(o.to.t==='safe')ev.push({type:'saved',pl});return ok()}
 case'moveBoat':{if(ph!=='move'||!D())return err('حرکت نامعتبر');snap();const b=S.boats.find(x=>x.id===a.b);b.k=a.to;S.moves--;boatArrive(S,b,ev);return ok()}
 case'endMoves':if(ph!=='move')return err('الان نه');S.phase='take';S.undo=[];return ok();
 case'take':{if(ph!=='take'||!D())return err('کاشی نامعتبر');const k=a.k,t=S.tiles[k],c=t.cont;delete S.tiles[k];S.undo=[];
  S.people.filter(p=>p.loc.t==='land'&&p.loc.k===k).forEach(p=>{p.loc={t:'sea',k}});
  ev.push({type:'reveal',to:pl,cont:c,k},{type:'took',pl,k,cont:PUBLIC.includes(c)?c:null});
  if(c==='shark'||c==='whale'){S.creat.push({id:++S.id,t:c,k});hazard(S,k)}
  else if(c==='boat'){const b={id:++S.id,k};S.boats.push(b);swim(S,k).sort((x,y)=>(y.o===pl)-(x.o===pl)).slice(0,3).forEach(p=>{p.loc={t:'boat',b:b.id}})}
  else if(c==='whirl'){const ks=[k,...NB(k).filter(x=>isSea(S,x))];S.people.forEach(p=>{if(['sea','boat'].includes(p.loc.t)&&ks.includes(pk(S,p)))die(p)});S.boats=S.boats.filter(b=>!ks.includes(b.k));S.creat=S.creat.filter(x=>!ks.includes(x.k))}
  else if(c==='volc'){endGame(S,ev);return ok()}else S.hands[pl].push(c);
  S.phase='roll';return ok()}
 case'roll':if(ph!=='roll')return err('الان نه');S.roll=DIE[Math.floor(rand(S)*6)];S.phase='creature';ev.push({type:'roll',pl,face:S.roll});return ok();
 case'moveCreature':{if(ph!=='creature'||!D())return err('حرکت نامعتبر');const c=S.creat.find(x=>x.id===a.c);ev.push({type:'cmove',pl,t:c.t});arrive(S,c,a.to,pl,ev);if(!S.pending){S.cur=(S.cur+1)%S.n;startTurn(S,ev)}return ok()}
 case'skipCreature':if(ph!=='creature')return err('الان نه');S.cur=(S.cur+1)%S.n;startTurn(S,ev);return ok();
 }return err('اکشن ناشناخته')}
function view(S,pl){const V=JSON.parse(JSON.stringify(S));V.me=pl;V.canUndo=pl===S.cur&&S.undo.length>0;delete V.undo;delete V.seed;
 for(const k in V.tiles)V.tiles[k]={type:V.tiles[k].type};
 V.people.forEach(p=>{if(p.o!==pl&&!S.over)p.n=null});V.hands=V.hands.map((h,o)=>o===pl?h:h.map(()=>null));return V}
const api={W,H,SAFE,DOCK,SERP,CELLS,LAND,NB,kk,P,MV,PUBLIC,newGame,apply,view,dests,cands,pk};
root.Atlantis=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
