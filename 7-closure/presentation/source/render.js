const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1240,height:640},deviceScaleFactor:2});
for(const n of ['context','usecase','architecture','pipeline','aca']){await p.goto('file://'+process.cwd()+'/'+n+'.svg');await p.screenshot({path:n+'.png',omitBackground:false});}
await b.close();})();
