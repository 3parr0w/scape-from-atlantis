// Random-but-legal player for tests. Works with a full state or with a per-player view.
const A=require('../src/engine.js'),rnd=a=>a[Math.floor(Math.random()*a.length)];
function choose(S,pl){const ph=S.phase;
 if(S.pending)return{t:'defend',play:Math.random()<.5};
 if(ph==='setP')return{t:'placePerson',k:rnd(A.dests(S,pl))};
 if(ph==='setB')return{t:'placeBoat',k:rnd(A.dests(S,pl))};
 if(ph==='play'){if(Math.random()<.5)return{t:'skipTile'};
  for(const t of S.hands[pl]){
   if(t==='dolph'){const p=S.people.find(p=>p.o===pl&&p.loc.t==='sea');if(p){const d=A.dests(S,pl,{p:p.id},'dolph');if(d.length)return{t:'dolph',p:p.id,to:rnd(d)}}}
   if(t==='wind'){const b=S.boats.find(b=>A.dests(S,pl,{b:b.id},'wind').length);if(b)return{t:'wind',b:b.id,to:rnd(A.dests(S,pl,{b:b.id},'wind'))}}
   if(A.MV[t]){const c=S.creat.find(c=>c.t===A.MV[t]);if(c){const d=A.dests(S,pl,{c:c.id},t);if(d.length)return{t:'mcreat',tile:t,c:c.id,to:rnd(d)}}}}
  return{t:'skipTile'}}
 if(ph==='move'){const o=[];S.people.filter(p=>p.o===pl).forEach(p=>{const d=A.dests(S,pl,{p:p.id});if(d.length)o.push({t:'movePerson',p:p.id,to:rnd(d)})});S.boats.forEach(b=>{const d=A.dests(S,pl,{b:b.id});if(d.length)o.push({t:'moveBoat',b:b.id,to:rnd(d)})});
  if(!o.length||S.moves<=0||Math.random()<.1)return{t:'endMoves'};
  if(Math.random()<.1&&(S.canUndo||(S.undo&&S.undo.length)))return{t:'undo'};return rnd(o)}
 if(ph==='take')return{t:'take',k:rnd(A.dests(S,pl))};
 if(ph==='roll')return{t:'roll'};
 if(ph==='creature'){const o=S.creat.filter(c=>c.t===S.roll).map(c=>({c,d:A.dests(S,pl,{c:c.id})})).filter(x=>x.d.length);
  if(o.length&&Math.random()<.8){const x=rnd(o);return{t:'moveCreature',c:x.c.id,to:rnd(x.d)}}return{t:'skipCreature'}}
 throw new Error('no action for phase '+ph)}
module.exports={choose};
