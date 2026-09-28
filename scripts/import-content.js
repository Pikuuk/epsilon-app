'use strict';
// Loads approved question content into the running server as the super user.
// Usage: node scripts/import-content.js content/year7-maths-approved.json
// It asks for your owner email + password so nothing is stored.
const http=require('http');const fs=require('fs');const path=require('path');const readline=require('readline');
const file=process.argv[2]||'content/year7-maths-approved.json';
const cfg=JSON.parse(fs.readFileSync(path.join(__dirname,'..','config.json'),'utf8'));
const PORT=cfg.PORT||8080;
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
function ask(q,hide){return new Promise(res=>{if(!hide)return rl.question(q,res);const stdin=process.openStdin();process.stdout.write(q);let s='';process.stdin.on('data',function h(ch){ch=ch+'';if(ch==='\n'||ch==='\r'||ch==='\u0004'){process.stdin.removeListener('data',h);process.stdout.write('\n');res(s);}else{s+=ch;}});});}
function req(method,p,data,cookie){return new Promise(r=>{const b=data?JSON.stringify(data):null;const q=http.request({host:'localhost',port:PORT,path:p,method,headers:Object.assign({'Content-Type':'application/json'},b?{'Content-Length':Buffer.byteLength(b)}:{},cookie?{Cookie:cookie}:{})},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r({status:res.statusCode,body:d?JSON.parse(d):null,setCookie:res.headers['set-cookie']}));});if(b)q.write(b);q.end();});}
(async()=>{
  const email=await ask('Owner email: ');
  const pw=await ask('Owner password: ',true);
  rl.close();
  let r=await req('POST','/api/login',{email:email.trim(),password:pw});
  if(r.status!==200){console.error('Login failed:',(r.body&&r.body.error)||r.status);process.exit(1);}
  const cookie=r.setCookie[0].split(';')[0];
  const items=JSON.parse(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
  r=await req('POST','/api/admin/action',{type:'import_items',items:items},cookie);
  if(r.status!==200){console.error('Import failed:',(r.body&&r.body.error)||r.status);process.exit(1);}
  console.log('Imported '+r.body.count+' approved questions. Students can now practise.');
  process.exit(0);
})();
