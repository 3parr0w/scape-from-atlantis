'use strict';
// Authoritative game server: rooms, seats, reconnect, per-player views. Needs: npm i ws
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {WebSocketServer}=require('ws'),A=require('./src/engine.js');
const PORT=+process.env.PORT||3000,DATA=process.env.DATA_FILE||path.join(__dirname,'data','rooms.json');
const CH='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',rooms=new Map();
const code=()=>{let s;do{s=Array.from({length:5},()=>CH[crypto.randomInt(CH.length)]).join('')}while(rooms.has(s));return s};
const clean=n=>String(n||'').replace(/[<>&"'`]/g,'').trim().slice(0,16),tok=()=>crypto.randomBytes(16).toString('hex');
function load(){try{for(const r of JSON.parse(fs.readFileSync(DATA,'utf8')))rooms.set(r.code,{...r,seats:r.seats.map(s=>({...s,ws:null}))})}catch{}}
let tm;const save=()=>{clearTimeout(tm);tm=setTimeout(()=>{try{fs.mkdirSync(path.dirname(DATA),{recursive:true});fs.writeFileSync(DATA,JSON.stringify([...rooms.values()].map(r=>({code:r.code,n:r.n,state:r.state,updated:r.updated,seats:r.seats.map(({token,name})=>({token,name}))}))))}catch(e){console.error('save failed:',e.message)}},300)};
const send=(ws,m)=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify(m))};
const names=r=>r.seats.map(s=>s.name),conn=r=>r.seats.map(s=>!!(s.ws&&s.ws.readyState===1));
function broadcast(r,ev){r.seats.forEach((s,i)=>{if(!s.ws)return;
 if(r.state)send(s.ws,{type:'state',view:A.view(r.state,i),events:ev.filter(e=>e.type!=='reveal'||e.to===i),names:names(r),connected:conn(r)});
 else send(s.ws,{type:'lobby',code:r.code,n:r.n,names:names(r)})})}
function attach(ws,r,i){const s=r.seats[i];if(s.ws&&s.ws!==ws){s.ws.ctx=null;try{s.ws.close()}catch{}}s.ws=ws;ws.ctx={r,i};send(ws,{type:'joined',code:r.code,seat:i,token:s.token,n:r.n})}
function handle(ws,m){const bad=t=>send(ws,{type:'error',msg:t});
 switch(m.type){
 case'create':{const n=+m.n;if(![2,3,4].includes(n))return bad('تعداد بازیکن نامعتبر است.');
  const r={code:code(),n,seats:[{token:tok(),name:clean(m.name)||'بازیکن ۱',ws:null}],state:null,updated:Date.now()};rooms.set(r.code,r);attach(ws,r,0);save();return broadcast(r,[])}
 case'join':{const r=rooms.get(String(m.code||'').toUpperCase());if(!r)return bad('اتاقی با این کد یافت نشد.');if(r.state)return bad('بازی این اتاق شروع شده است.');if(r.seats.length>=r.n)return bad('اتاق پر است.');
  r.seats.push({token:tok(),name:clean(m.name)||'بازیکن '+(r.seats.length+1),ws:null});attach(ws,r,r.seats.length-1);if(r.seats.length===r.n)r.state=A.newGame(r.n);r.updated=Date.now();save();return broadcast(r,[])}
 case'rejoin':{const r=rooms.get(String(m.code||'').toUpperCase()),i=r?r.seats.findIndex(s=>s.token===m.token):-1;if(i<0)return bad('اتاق یا جای تو یافت نشد.');attach(ws,r,i);return broadcast(r,[])}
 case'action':{const c=ws.ctx;if(!c||!c.r.state)return bad('هنوز بازی شروع نشده.');const a=m.a;
  if(!a||typeof a!=='object'||typeof a.t!=='string'||JSON.stringify(a).length>300)return bad('اکشن نامعتبر.');
  const res=A.apply(c.r.state,c.i,a);if(res.error)return bad(res.error);c.r.state=res.state;c.r.updated=Date.now();save();return broadcast(c.r,res.events)}}}
const server=http.createServer((q,s)=>{const u=q.url.split('?')[0];
 if(u==='/'||u==='/index.html')return fs.readFile(path.join(__dirname,'public','index.html'),(e,d)=>{if(e){s.writeHead(500);return s.end('public/index.html missing — run: python3 tools/build.py')}s.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-cache'});s.end(d)});
 if(u==='/healthz'){s.writeHead(200);return s.end('ok')}s.writeHead(404);s.end('not found')});
const wss=new WebSocketServer({server,maxPayload:2048});
wss.on('connection',ws=>{ws.alive=true;let n=0;const t=setInterval(()=>{n=0},1000);
 ws.on('pong',()=>{ws.alive=true});
 ws.on('message',raw=>{if(++n>40)return send(ws,{type:'error',msg:'درخواست‌ها بیش از حد است؛ کمی صبر کن.'});let m;try{m=JSON.parse(raw)}catch{return}if(!m||typeof m!=='object')return;try{handle(ws,m)}catch(e){console.error(e);send(ws,{type:'error',msg:'خطای سرور'})}});
 ws.on('close',()=>{clearInterval(t);const c=ws.ctx;if(c&&c.r.seats[c.i].ws===ws){c.r.seats[c.i].ws=null;broadcast(c.r,[])}})});
setInterval(()=>wss.clients.forEach(w=>{if(!w.alive)return w.terminate();w.alive=false;w.ping()}),30000);
setInterval(()=>{const old=Date.now()-864e5;for(const[c,r]of rooms)if(r.updated<old)rooms.delete(c);save()},36e5);
load();server.listen(PORT,'0.0.0.0',()=>console.log('listening on '+PORT));
