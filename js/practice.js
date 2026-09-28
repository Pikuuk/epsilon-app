var EL=window.EL, esc=EL.esc;
var S=null, ME=null, MEMBER=null, LAD={}, CONSENTED=false, dirty=false, view=null;
async function load(){
  var r=await fetch('/api/state'); if(r.status===401){location.href='/login.html';return;}
  S=await r.json(); ME=S.me;
  if(ME.role!=='student'){document.getElementById('app').innerHTML='<h1>Practice</h1><p class="muted">This page is for students. <a href="/">Go back</a>.</p>';return;}
  MEMBER=S.member; CONSENTED=!!S.consented;
  LAD=(MEMBER&&MEMBER.lad)||{};
  render();
}
function approvedLadItems(topic,level){
  return (S.items||[]).filter(function(x){return x.status==='approved'&&x.ladder&&x.ladder.topic===topic&&x.ladder.level===level&&(!x.years||!x.years.length||x.years.indexOf(MEMBER.year)>-1);});
}
function topicHasContent(topic){return EL.LADDERS.filter(function(t){return t.id===topic})[0].levels.some(function(l){return approvedLadItems(topic,l.n).length>0});}
function maxLevel(topic){var mx=0;EL.LADDERS.filter(function(t){return t.id===topic})[0].levels.forEach(function(l){if(approvedLadItems(topic,l.n).length)mx=Math.max(mx,l.n);});return mx;}
function st(topic,level){LAD[topic]=LAD[topic]||{};return LAD[topic][level]=LAD[topic][level]||{passed:false,best:0,sets:0};}
function unlocked(topic,level){return level===1||(LAD[topic]&&LAD[topic][level-1]&&LAD[topic][level-1].passed);}
function medal(b){return b>=12?'🥇':b>=11?'🥈':b>=9?'🥉':'🏆';}
function makeSet(topic,level,setNo){
  var its=approvedLadItems(topic,level); if(!its.length)return null;
  var out=[],seen={};
  for(var j=0;j<12;j++){var it=its[j%its.length],inst=null,seed=0;
    for(var t=0;t<12;t++){seed=EL.hash(ME.id+topic+level+setNo+'q'+j+'t'+t);inst=EL.instantiate(it,seed);if(!seen[inst.stem])break;}
    seen[inst.stem]=1;out.push({stem:inst.stem,ans:inst.ans,fnum:inst.fnum,fden:inst.fden,unit:it.unit,type:it.type,simplest:it.simplest,solution:inst.solution,hints:inst.hints,errs:inst.errs});}
  return out;
}
function save(){ if(!CONSENTED)return; MEMBER.lad=LAD; dirty=true; queueSave(); }
var saveT=null;
function queueSave(){clearTimeout(saveT);saveT=setTimeout(async function(){
  if(!dirty)return;dirty=false;
  try{await fetch('/api/student/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lad:LAD})});}catch(e){dirty=true;}
},700);}
function render(){
  var h='';
  if(!CONSENTED)h+='<div class="warnbox">Your work will not be saved yet — we are still waiting for a parent or guardian to give permission. You can still try the questions.</div>';
  var topics=EL.LADDERS.filter(function(t){return topicHasContent(t.id)&&(MEMBER.subs||[]).some(function(s){return s.subject==='Maths';});});
  if(!topics.length){document.getElementById('app').innerHTML='<h1>Practice levels</h1><p class="muted">No practice is ready for you yet. Please check back after your teacher sets it up.</p>';return;}
  if(!view){
    h+='<h1>Practice levels</h1><p class="muted">Choose a topic and level. Each level has 12 questions with new numbers. Get 9 or more right to earn a trophy and unlock the next level.</p>';
    topics.forEach(function(tp){
      h+='<div class="card"><h3>'+esc(tp.name)+'</h3><p class="muted">'+esc(tp.about||'')+'</p><div class="levelbar">'+tp.levels.map(function(l){
        var has=approvedLadItems(tp.id,l.n).length>0,un=unlocked(tp.id,l.n),s=LAD[tp.id]&&LAD[tp.id][l.n],ic=s&&s.passed?medal(s.best):(!un?'🔒':'');
        return '<button class="lvpill" data-open="'+tp.id+':'+l.n+'"'+((has&&un)?'':' disabled')+' title="'+esc(l.name)+'">'+ic+' '+l.n+'</button>';
      }).join('')+'</div></div>';
    });
    document.getElementById('app').innerHTML=h; wire(); return;
  }
  // in a level
  var tp=EL.LADDERS.filter(function(t){return t.id===view.topic;})[0],lv=tp.levels.filter(function(x){return x.n===view.level;})[0],state=st(view.topic,view.level);
  var cor=view.res.filter(function(x){return x===true;}).length;
  h+='<p class="muted">'+esc(tp.name)+'</p><h1>Level '+lv.n+': '+esc(lv.name)+'</h1>';
  h+='<div class="levelbar">'+tp.levels.map(function(x){var un=unlocked(tp.id,x.n),has=approvedLadItems(tp.id,x.n).length>0,s=LAD[tp.id]&&LAD[tp.id][x.n],ic=s&&s.passed?medal(s.best):(!un?'🔒':'');return '<button class="lvpill" data-goto="'+x.n+'" aria-current="'+(x.n===lv.n)+'"'+((un&&has)?'':' disabled')+'>'+ic+' '+x.n+'</button>';}).join('')+'</div>';
  h+='<div class="shell"><div><p>'+esc(lv.desc)+'. '+esc(lv.tip)+'</p><div class="qgrid">';
  view.q.forEach(function(q,i){
    var r=view.res[i],lock=(r===true||r==='seen'),cls=r===true?' right':(r===false?' wrong':'');
    h+='<div class="qcell'+cls+'"><div class="qn">Question '+(i+1)+'</div><label style="font-weight:600;display:block">'+esc(q.stem)+'<input type="text" inputmode="'+(q.type==='fraction'?'text':'numeric')+'" data-ans="'+i+'" value="'+esc(view.ans[i]||'')+'"'+(lock?' readonly':'')+'></label>';
    if(r===true)h+='<p class="fbk ok">✓ Correct</p>';
    else if(r===false){var dg=EL.diagnose(q,view.ans[i]);h+='<p class="fbk no">✗ Not yet.'+(dg?' '+esc(dg):'')+'</p><button class="ghost" data-show="'+i+'">Show me how</button>';}
    else if(r==='seen')h+='<p class="fbk">Answer: '+esc(EL.ansText(q))+'. '+esc(q.solution)+'</p>';
    h+='</div>';
  });
  h+='</div><div class="scoreband"><div>'+(view.checked?'<strong>'+cor+' of 12 correct</strong>'+(state.passed?' <span class="chip">'+medal(state.best)+' Trophy</span>':''):'<span class="muted">Answer, then press Check</span>')+'</div><div><button data-check>Check answers</button> <button class="ghost" data-new>New numbers</button>'+((state.passed&&lv.n<tp.levels.length&&approvedLadItems(tp.id,lv.n+1).length)?' <button class="ok" data-goto="'+(lv.n+1)+'">Next level ▸</button>':'')+'</div></div>';
  if(view.checked)h+='<p class="muted">Best on this level: '+state.best+' of 12.</p>';
  h+='</div><aside><div class="card helpbox"><h3>How to do it</h3><ul>'+tp.help.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'<li><strong>This level:</strong> '+esc(lv.tip)+'</li></ul>';
  if(tp.tool==='numberline')h+='<h3>Number line</h3><div id="nl">'+EL.numberLine({start:5,steps:-12})+'</div>';
  h+='</div>';
  if(tp.words&&tp.words.length)h+='<div class="card"><h3>Words to know</h3><dl class="gloss">'+tp.words.map(function(w){return '<dt>'+esc(w.w)+'</dt><dd>'+esc(w.d)+'</dd>';}).join('')+'</dl></div>';
  h+='<div class="card"><h3>Why learn this?</h3><p>'+esc(tp.why)+'</p></div><div class="actions"><button class="ghost" data-home>◂ All topics</button></div></aside></div>';
  document.getElementById('app').innerHTML=h; wire();
}
function openLevel(topic,level){var s=st(topic,level);var set=makeSet(topic,level,s.sets||0);if(!set)return;s.sets=(s.sets||0)+1;view={topic:topic,level:level,q:set,ans:[],res:[],checked:false};render();}
function wire(){
  document.querySelectorAll('[data-open]').forEach(function(b){b.onclick=function(){var p=b.getAttribute('data-open').split(':');openLevel(p[0],Number(p[1]));};});
  document.querySelectorAll('[data-goto]').forEach(function(b){b.onclick=function(){var n=Number(b.getAttribute('data-goto'));if(unlocked(view.topic,n)&&approvedLadItems(view.topic,n).length)openLevel(view.topic,n);};});
  document.querySelectorAll('[data-ans]').forEach(function(el){el.oninput=function(){view.ans[Number(el.getAttribute('data-ans'))]=el.value;};});
  document.querySelectorAll('[data-show]').forEach(function(b){b.onclick=function(){var i=Number(b.getAttribute('data-show'));if(view.res[i]===false)view.res[i]='seen';render();};});
  var home=document.querySelector('[data-home]');if(home)home.onclick=function(){view=null;render();};
  var chk=document.querySelector('[data-check]');if(chk)chk.onclick=function(){
    var cor=0;view.q.forEach(function(q,i){if(view.res[i]==='seen')return;var raw=view.ans[i];if(raw==null||String(raw).trim()===''){view.res[i]=null;return;}var okk=EL.markLadder(q,raw);view.res[i]=okk;if(okk)cor++;});
    view.checked=true;var s=st(view.topic,view.level);if(cor>s.best)s.best=cor;if(!s.passed&&cor>=9)s.passed=true;save();render();
  };
  var nw=document.querySelector('[data-new]');if(nw)nw.onclick=function(){openLevel(view.topic,view.level);};
}
load();
