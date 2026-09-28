var app=document.getElementById('app');
function esc(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
async function api(path,data){var r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data||{})});return{status:r.status,body:await r.json().catch(function(){return{}})}}
function loginForm(msg){
  app.innerHTML='<p class="muted">Sign in to your account. If you were given a one-time code, use it as your password and you will set your own next.</p>'+
  (msg?'<div class="msg">'+esc(msg)+'</div>':'')+
  '<label for="e">Email</label><input id="e" type="email" autocomplete="username">'+
  '<label for="p">Password or one-time code</label><input id="p" type="password" autocomplete="current-password">'+
  '<button id="go">Sign in</button>'+
  '<p class="muted" style="margin-top:1rem">Not signed up? <a href="/request.html">Ask for access</a></p>';
  document.getElementById('go').onclick=doLogin;
  document.getElementById('p').addEventListener('keydown',function(e){if(e.key==='Enter')doLogin()});
}
async function doLogin(){
  var email=document.getElementById('e').value.trim(),pw=document.getElementById('p').value;
  var r=await api('/api/login',{email:email,password:pw});
  if(r.status!==200)return loginForm(r.body.error||'Could not sign in.');
  if(r.body.user.mustReset)return setPwForm();
  location.href='/';
}
function setPwForm(msg){
  app.innerHTML='<p class="muted">Welcome. Please set your own password now. Use at least 8 characters and keep it private.</p>'+
  (msg?'<div class="msg">'+esc(msg)+'</div>':'')+
  '<label for="np">New password</label><input id="np" type="password" autocomplete="new-password">'+
  '<label for="np2">Type it again</label><input id="np2" type="password" autocomplete="new-password">'+
  '<button id="sp">Save password</button>';
  document.getElementById('sp').onclick=async function(){
    var a=document.getElementById('np').value,b=document.getElementById('np2').value;
    if(a.length<8)return setPwForm('Use at least 8 characters.');
    if(a!==b)return setPwForm('The two passwords do not match.');
    var r=await api('/api/set-password',{password:a});
    if(r.status!==200)return setPwForm(r.body.error||'Could not save.');
    location.href='/';
  };
}
loginForm();
