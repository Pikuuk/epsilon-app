function esc(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
document.querySelectorAll('input[name=role]').forEach(function(r){r.onchange=function(){document.getElementById('yearWrap').style.display=(document.querySelector('input[name=role]:checked').value==='student')?'block':'none';};});
document.getElementById('go').onclick=async function(){
  var role=document.querySelector('input[name=role]:checked').value;
  var name=document.getElementById('name').value.trim();
  var email=document.getElementById('email').value.trim();
  var year=document.getElementById('year').value;
  var msg=document.getElementById('msg');
  if(!name||!/^\S+@\S+\.\S+$/.test(email)){msg.className='msg err';msg.textContent='Please enter a name and a valid email.';return;}
  var r=await fetch('/api/request-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:role,name:name,email:email,year:year})});
  var b=await r.json().catch(function(){return{};});
  if(r.status!==200){msg.className='msg err';msg.textContent=b.error||'Could not send the request.';return;}
  document.getElementById('card').innerHTML='<h1>Request sent</h1><p>Thank you. A teacher or the Epsilon team will review it. Once approved, you will be sent a one-time code to sign in and set your password.</p><p class="muted"><a href="/login.html">Go to sign in</a></p>';
};
