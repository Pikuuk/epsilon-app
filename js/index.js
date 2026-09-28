function esc(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
async function get(){var r=await fetch('/api/state');if(r.status===401){location.href='/login.html';return null;}return r.json();}
async function act(data){var r=await fetch('/api/admin/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return{status:r.status,body:await r.json().catch(function(){return{}})};}
var S=null,flash='';
function setFlash(m){flash=m;}
async function refresh(){S=await get();if(S)render();}
function render(){
  var m=S.me;
  document.getElementById('whoami').innerHTML=esc(m.name)+' · '+esc(m.role)+' · <a href="#" id="lo" style="color:#cfe">Sign out</a>';
  document.getElementById('lo').onclick=async function(e){e.preventDefault();await fetch('/api/logout',{method:'POST'});location.href='/login.html';};
  var h=flash?'<div class="flash">'+esc(flash)+'</div>':'';flash='';
  if(m.role==='super')h+=superView();
  else if(m.role==='teacher')h+=teacherView();
  else if(m.role==='student')h+=studentView();
  else if(m.role==='parent')h+=parentView();
  document.getElementById('app').innerHTML=h;
  wire();
}
function superView(){
  var pend=S.requests.filter(function(r){return r.status==='pending'});
  var openFlags=(S.safeguard||[]).filter(function(s){return !s.handled});
  var h='<h1>Control room</h1>';
  if(openFlags.length)h+='<div class="warnbox"><strong>'+openFlags.length+' safeguarding flag(s) need attention.</strong> Follow your safeguarding process and contact '+esc(S.settings.dsl_name)+'.</div>';
  h+='<div class="card"><h2 style="margin:0 0 .4rem">Switchboard</h2><label style="font-weight:400"><input type="checkbox" data-flag="registration_open" '+(S.flags.registration_open?'checked':'')+'> Allow new access requests</label><p class="muted">Turn parts of the system on or off without breaking the rest.</p></div>';
  h+='<h2>Requests waiting ('+pend.length+')</h2>';
  if(!pend.length)h+='<p class="muted">None.</p>';
  pend.forEach(function(r){
    h+='<div class="card" data-req="'+r.id+'"><div class="row"><strong>'+esc(r.name)+'</strong><span class="chip warn">waiting</span></div><div class="muted">'+(r.role==='student'?'Student, '+esc(r.year):'Parent/guardian')+' · '+esc(r.email)+'</div><label>Assign teacher</label><select data-teacher><option value="">Choose…</option>'+S.users.filter(function(u){return u.role==='teacher'}).map(function(u){return '<option value="'+u.id+'">'+esc(u.name)+'</option>'}).join('')+'<option value="'+S.me.id+'">Me (super user)</option></select>';
    if(r.role==='student')h+='<label>Subjects</label><div>'+['Maths','English','Biology','Chemistry','Physics'].map(function(s){return '<label style="display:inline-block;font-weight:400;margin-right:1rem"><input type="checkbox" data-subj value="'+s+'"> '+s+'</label>'}).join('')+'</div>';
    h+='<div class="actions"><button class="ok" data-approve="'+r.id+'">Approve</button><button class="bad" data-reject="'+r.id+'">Reject</button></div></div>';
  });
  h+='<h2>People</h2>';
  if(!S.members.length)h+='<p class="muted">No approved people yet.</p>';
  S.members.forEach(function(mm){
    var consented=(S.consents||[]).some(function(c){return c.studentId===mm.id});
    h+='<div class="card"><div class="row"><strong>'+esc(mm.name)+'</strong><span class="chip '+(mm.status==='revoked'?'bad':'ok')+'">'+(mm.status==='revoked'?'paused':'active')+'</span></div><div class="muted">'+(mm.role==='student'?'Student, '+esc(mm.year):'Parent')+' · teacher: '+esc(teacherName(mm.teacherId))+'</div>'+(mm.role==='student'?('<div>'+(consented?'<span class="chip ok">parental consent on file</span>':'<span class="chip bad">no consent yet — student is blocked from saving work</span>')+'</div>'):'')+'<div class="actions">'+(mm.role==='student'&&!consented?'<button data-consent="'+mm.id+'">Record parental consent</button>':'')+(mm.status==='revoked'?'<button class="ok" data-restore="'+mm.id+'">Restore access</button>':'<button class="bad" data-revoke="'+mm.id+'">Pause access</button>')+'</div></div>';
  });
  h+='<h2>Wellbeing flags</h2>';
  if(!(S.safeguard||[]).length)h+='<p class="muted">None.</p>';
  (S.safeguard||[]).slice().reverse().forEach(function(s,i){var idx=S.safeguard.length-1-i;h+='<div class="card"><div class="row"><strong>'+esc(memberName(s.studentId))+'</strong><span class="chip '+(s.handled?'ok':'bad')+'">'+(s.handled?'handled':'needs attention')+'</span></div><p>'+esc(s.message)+'</p>'+(s.handled?'':'<div class="actions"><button data-flag-idx="'+idx+'">Mark handled</button></div>')+'</div>';});
  h+='<h2>Full staff tools</h2><div class="card"><p class="muted">The question bank, plans, marking, attendance, practice levels and progress run in the design prototype. On this live server, students and parents use the live app above; the full staff console is the next thing to switch on. Import the approved question bank to give students content.</p></div>';
  return h;
}
function teacherView(){
  var pend=S.requests.filter(function(r){return r.status==='pending'});
  var h='<h1>Teacher desk</h1>';
  var flags=(S.safeguard||[]).filter(function(s){return !s.handled});
  if(flags.length)h+='<div class="warnbox"><strong>'+flags.length+' wellbeing flag(s) for your students.</strong> Follow your safeguarding process.</div>';
  h+='<h2>Requests assigned to you ('+pend.length+')</h2>';
  if(!pend.length)h+='<p class="muted">None. The super user assigns requests to teachers.</p>';
  pend.forEach(function(r){h+='<div class="card"><div class="row"><strong>'+esc(r.name)+'</strong></div><div class="muted">'+esc(r.email)+'</div><div class="actions"><button class="ok" data-approve="'+r.id+'">Approve</button><button class="bad" data-reject="'+r.id+'">Reject</button></div></div>';});
  h+='<h2>Your students</h2>';
  if(!S.members.length)h+='<p class="muted">None yet.</p>';
  S.members.forEach(function(m){h+='<div class="card"><strong>'+esc(m.name)+'</strong> <span class="muted">'+esc(m.year)+'</span></div>';});
  h+='<h2>Wellbeing flags</h2>'+((S.safeguard||[]).length?'':'<p class="muted">None.</p>');
  (S.safeguard||[]).slice().reverse().forEach(function(s,i){var idx=S.safeguard.length-1-i;h+='<div class="card"><p>'+esc(s.message)+'</p>'+(s.handled?'<span class="chip ok">handled</span>':'<div class="actions"><button data-flag-idx="'+idx+'">Mark handled</button></div>')+'</div>';});
  return h;
}
function studentView(){
  var m=S.member;
  if(!m)return '<h1>Welcome</h1><p>Your account is being set up. Please check back soon.</p>';
  if(m.status==='revoked')return '<h1>Access paused</h1><p>Please contact Epsilon Academy.</p>';
  var h='<h1>Hello, '+esc(m.name)+'</h1>';
  if(!S.consented)h+='<div class="warnbox">Your learning is not switched on yet because we still need a parent or guardian to give permission. You can look around, but your answers will not be saved until then.</div>';
  h+='<p class="muted">'+esc(m.year)+'</p><div class="card"><h2 style="margin-top:0">Your subjects</h2>'+((m.subs||[]).map(function(s){return '<span class="chip">'+esc(s.subject)+' ('+esc(s.board)+')</span>'}).join('')||'<span class="muted">No subjects yet.</span>')+'<div class="actions"><a href="/practice.html"><button>Open practice levels</button></a></div><p class="muted" style="margin-top:.6rem">Your baseline check and weekly plan open here as your teacher sets them.</p></div>';
  return h;
}
function parentView(){
  var m=S.member,c=S.child;
  var h='<h1>Welcome'+(m?', '+esc(m.name):'')+'</h1>';
  if(!c)return h+'<p>Your account is not linked to a child yet. The Epsilon team will link it soon.</p>';
  h+='<div class="card"><h2 style="margin-top:0">Your child: '+esc(c.name)+'</h2><p class="muted">'+esc(c.year)+'</p><div>'+((c.subs||[]).map(function(s){return '<span class="chip">'+esc(s.subject)+'</span>'}).join('')||'<span class="muted">No subjects yet.</span>')+'</div><p class="muted" style="margin-top:1rem">You will see progress and ways to help here as the plan grows.</p></div>';
  return h;
}
function teacherName(id){var u=(S.users||[]).filter(function(x){return x.id===id})[0];if(u)return u.name;if(id===S.me.id)return S.me.name+' (you)';return 'a teacher';}
function memberName(id){var m=(S.members||[]).filter(function(x){return x.id===id})[0];return m?m.name:'a student';}
function wire(){
  document.querySelectorAll('[data-flag]').forEach(function(el){el.onchange=async function(){await act({type:'set_flag',key:el.getAttribute('data-flag'),value:el.checked});setFlash('Setting saved.');refresh();};});
  document.querySelectorAll('[data-approve]').forEach(function(b){b.onclick=async function(){var card=b.closest('[data-req]')||b.closest('.card');var id=b.getAttribute('data-approve');var tsel=card.querySelector('[data-teacher]');var teacherId=tsel?tsel.value:'';var subs=[].slice.call(card.querySelectorAll('[data-subj]:checked')).map(function(c){return {subject:c.value,board:'No board (KS3)'};});var r=await act({type:'approve',id:id,teacherId:teacherId,subs:subs});if(r.status!==200)return alert(r.body.error||'Could not approve.');if(r.body.loginCode)setFlash('Approved. One-time login for '+r.body.loginEmail+': '+r.body.loginCode+' — send this to them; they set their own password on first sign-in.');refresh();};});
  document.querySelectorAll('[data-reject]').forEach(function(b){b.onclick=async function(){var r=await act({type:'reject',id:b.getAttribute('data-reject')});if(r.status!==200)return alert(r.body.error);setFlash('Rejected.');refresh();};});
  document.querySelectorAll('[data-consent]').forEach(function(b){b.onclick=async function(){if(!confirm('Confirm a parent or guardian has given permission for this child to use the platform?'))return;var r=await act({type:'record_consent',studentId:b.getAttribute('data-consent'),text:'Parental consent confirmed by super user'});if(r.status!==200)return alert(r.body.error);setFlash('Consent recorded.');refresh();};});
  document.querySelectorAll('[data-revoke]').forEach(function(b){b.onclick=async function(){var r=await act({type:'revoke',id:b.getAttribute('data-revoke')});if(r.status!==200)return alert(r.body.error);setFlash('Access paused.');refresh();};});
  document.querySelectorAll('[data-restore]').forEach(function(b){b.onclick=async function(){var r=await act({type:'restore',id:b.getAttribute('data-restore')});if(r.status!==200)return alert(r.body.error);setFlash('Access restored.');refresh();};});
  document.querySelectorAll('[data-flag-idx]').forEach(function(b){b.onclick=async function(){var r=await act({type:'handle_flag',index:Number(b.getAttribute('data-flag-idx'))});if(r.status!==200)return alert(r.body.error);setFlash('Marked handled.');refresh();};});
}
refresh();
