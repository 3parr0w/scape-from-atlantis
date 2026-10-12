// Headless check of the browser UI (fake DOM): local mode + rendering a server "view" in online mode (my turn / waiting / pending).
const fs=require('fs'),path=require('path'),r=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const el={};const mk=id=>el[id]=el[id]||{style:{},_h:'',set innerHTML(v){this._h=v},get innerHTML(){return this._h},set textContent(v){this._t=v},get textContent(){return this._t},onclick:null,getBoundingClientRect:()=>({left:0,top:0,width:390,height:600}),setAttribute(){},addEventListener(){}};
global.document={querySelector:mk,title:''};global.location={search:'',protocol:'http:',host:'x',origin:'http://x',pathname:'/'};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};global.window=global;global.addEventListener=()=>{};
const src=r('src/engine.js').replace("typeof window!=='undefined'?window:globalThis","global")+'\n'+r('src/ui.js').replace(/^const A=/m,'var A=')+
 ';globalThis.T_={go,dispatch,onNet,render,get S(){return S},setNet(n,me){NET=n;ME=me},get st(){return document.querySelector("#st").textContent}}';
(0,eval)(src);const t=T_,A=Atlantis;
t.go(2);while(t.S.phase==='setP')t.dispatch({t:'placePerson',k:A.dests(t.S,t.S.cur)[0]});while(t.S.phase==='setB')t.dispatch({t:'placeBoat',k:A.dests(t.S,t.S.cur)[0]});
t.dispatch({t:'skipTile'});t.dispatch({t:'endMoves'});t.dispatch({t:'take',k:A.dests(t.S,t.S.cur)[0]});
if(t.S.phase!=='roll')throw new Error('local flow broke');
const full=t.S,sent=[];t.setNet({readyState:1,send:m=>sent.push(JSON.parse(m))},0);
const msg=(me,extra)=>({type:'state',view:A.view(full,me),events:[],names:['علی','بیتا'],connected:[true,true],...extra});
t.onNet(msg(0));const mine=el['#st']._t;t.onNet(msg(1));const wait=el['#st']._t;
t.setNet({readyState:1,send:m=>sent.push(JSON.parse(m))},0);t.onNet(msg(0));t.dispatch({t:'roll'});
const ok=/تاس/.test(mine)&&/نوبت/.test(wait)&&sent.length===1&&sent[0].type==='action'&&sent[0].a.t==='roll'&&el['#bd']._h.length>10000;
console.log('ui smoke:',ok?'OK':'FAIL','|',mine,'|',wait);process.exit(ok?0:1);
