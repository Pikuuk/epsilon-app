'use strict';
// Copies data/store.json into data/backups/ with a timestamp, keeps the last 30.
// Run daily with cron (see DEPLOY.md).
const fs=require('fs');const path=require('path');
const dir=path.join(__dirname,'..','data');const store=path.join(dir,'store.json');
const bdir=path.join(dir,'backups');
if(!fs.existsSync(store)){console.log('No store yet, nothing to back up.');process.exit(0);}
fs.mkdirSync(bdir,{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
fs.copyFileSync(store,path.join(bdir,'store-'+stamp+'.json'));
const files=fs.readdirSync(bdir).filter(f=>f.startsWith('store-')).sort();
while(files.length>30){fs.unlinkSync(path.join(bdir,files.shift()));}
console.log('Backup saved. Kept '+Math.min(files.length,30)+' backups.');
