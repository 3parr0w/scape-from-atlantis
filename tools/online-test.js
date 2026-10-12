// Starts the real server, connects 3 websocket clients, plays a full random game through the network
// (using only per-player views), reconnects one player mid-game, and checks that no secrets reach other players.
const {spawn}=require('child_process'),WebSocket=require('ws'),path=require('path'),os=require('os');
const {choose}=require('./bot.js');
const PORT=3100+Math.floor(Math.random()*800),DATA=path.join(os.tmpdir(),'atl-test-'+PORT+'.json');
const srv=spawn('node',[path.join(__dirname,'../server.js')],{env:{...process.env,PORT,DATA_FILE:DATA},stdio:['ignore','pipe','inherit']});
const fail=m=>{console.log('FAIL:',m);srv.kill();process.exit(1)};
setTimeout(()=>fail('timeout'),90000);
if(process.env.DBG)setInterval(()=>console.log('sent',sent,C.map(c=>c&&c.view?c.view.phase+'/'+c.view.cur+(c.view.pending?'/P':''):'-').join(' ')),1500);
let code,sent=0,leaks=0,expectedErrors=0,unexpectedErrors=0,reconnected=false,done=0;const C=[];
const send=(c,m)=>c.ws.send(JSON.stringify(m));
function mk(i,name){const c={i,name,view:null,token:null,seat:null};bind(c,new WebSocket('ws://localhost:'+PORT));if(i<3)C[i]=c;return c}
function bind(c,ws){c.ws=ws;ws.on('message',d=>{const m=JSON.parse(d);if(process.env.DBG2)console.log('  <-',c.i,m.type,m.type==='state'?m.view.phase+'/cur'+m.view.cur+'/ev'+m.events.map(e=>e.type).join(','):m.msg||'');
 if(m.type==='joined'){c.token=m.token;c.seat=m.seat;code=m.code}
 if(m.type==='error'){if(c.expectErr){c.expectErr--;expectedErrors++}else{unexpectedErrors++;console.log('unexpected error',c.i,m.msg)}}
 if(m.type==='state'){const v=m.view;c.view=v;
  if(Object.values(v.tiles).some(t=>'cont' in t))leaks++;
  if(!v.over&&v.people.some(p=>p.o!==c.seat&&p.n!==null))leaks++;
  v.hands.forEach((h,o)=>{if(o!==c.seat&&h.some(x=>x!==null))leaks++});
  if(m.events.some(e=>e.type==='reveal'&&e.to!==c.seat))leaks++;
  if(v.over){if(!c.over){c.over=true;done++;if(done===C.length)finish()}return}
  const actor=v.pending?v.pending.queue[0]:v.cur;
  if(actor===c.seat)setTimeout(()=>{if(c.view!==v||c.ws!==ws)return;sent++;
   if(sent===150&&!reconnected){reconnected=true;return reconnect(C[1])}
   let a;try{a=choose(v,c.seat)}catch(e){console.log('BOT THREW',e.message,v.phase,v.roll);return}
   if(process.env.DBG)console.log('send',c.seat,JSON.stringify(a));send(c,{type:'action',a})},25)}})}
function reconnect(c){c.ws.terminate();setTimeout(()=>{const ws=new WebSocket('ws://localhost:'+PORT);bind(c,ws);ws.on('open',()=>send(c,{type:'rejoin',code,token:c.token}))},300)}
function finish(){const r=C[0].view.result;console.log('online test: game finished, scores',r.map(x=>x.total).join('/'),'| actions',sent,'| expected errors',expectedErrors);
 if(leaks)fail('secret leak x'+leaks);if(unexpectedErrors)fail('unexpected errors');if(!reconnected)fail('reconnect not exercised');console.log('online test: OK (no leaks, reconnect worked)');srv.kill();process.exit(0)}
srv.stdout.on('data',async d=>{if(!/listening/.test(d)||C.length)return;
 const a=mk(0,'Ali'),wait=ms=>new Promise(r=>setTimeout(r,ms));
 a.ws.on('open',async()=>{send(a,{type:'create',n:3,name:'Ali <b>'});await wait(200);
  const b=mk(1,'Bita');b.ws.on('open',()=>send(b,{type:'join',code,name:'Bita'}));await wait(200);
  const bad=mk(9,'x');bad.expectErr=3;bad.ws.on('open',()=>{send(bad,{type:'join',code:'ZZZZZ'});send(bad,{type:'rejoin',code,token:'nope'});send(bad,{type:'action',a:{t:'roll'}})});
  await wait(200);const c=mk(2,'Cyrus');c.ws.on('open',()=>send(c,{type:'join',code,name:'Cyrus'}));
  await wait(300);b.expectErr=1;send(b,{type:'action',a:{t:'placePerson',k:'0,0'}});   // not his turn / invalid
  const late=mk(8,'late');late.expectErr=1;late.ws.on('open',()=>send(late,{type:'join',code,name:'late'}))})});
