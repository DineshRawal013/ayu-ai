const pptxgen=require('pptxgenjs'); const fs=require('fs'); const icon=require('./icons.js');
const { applyTheme } = require("/root/.claude/skills/synced/47bbd39b-4126-4c46-9358-a33ad5a9b3a0_4d166533-2a6b-4416-860d-9400ffd18b7b/pptx/scripts/apply_theme.js");
const D=JSON.parse(fs.readFileSync('data.json'));
const THEME={name:"Ayu AI",headFontFace:"Cambria",bodyFontFace:"Calibri",colors:{dk1:"23204F",lt1:"FFFFFF",dk2:"5B6478",lt2:"EEEDF7",accent1:"E07A2E",accent2:"1F8A80",accent3:"6C4FA0",accent4:"D9A21B",accent5:"C8453B",accent6:"0F6CBD",hlink:"1F8A80",folHlink:"6C4FA0"}};
const HEX={ink:"23204F",slate:"5B6478",lav:"EEEDF7",saff:"E07A2E",teal:"1F8A80",plum:"6C4FA0",gold:"D9A21B",white:"FFFFFF"};
(async()=>{
const pres=new pptxgen(); pres.layout="LAYOUT_WIDE"; pres.title="Ayu AI"; pres.author="Dinesh";
pres.theme={headFontFace:THEME.headFontFace,bodyFontFace:THEME.bodyFontFace};
const C=pres.SchemeColor;
const INK=C.text1, SLATE=C.text2, LAV=C.background2, WHITE=C.background1, SAFF=C.accent1, TEAL=C.accent2, PLUM=C.accent3, GOLD=C.accent4;
pres.defineSlideMaster({title:"DARK",background:{color:INK},objects:[
 {placeholder:{options:{name:"title",type:"title",x:0.8,y:2.2,w:11.7,h:1.4,fontSize:54,bold:true,color:WHITE,fontFace:"Cambria",valign:"middle",align:"left"},text:""}},
 {placeholder:{options:{name:"body",type:"body",x:0.8,y:3.6,w:11.7,h:1.0,fontSize:22,color:"CFCBEF",valign:"top",align:"left"},text:""}},
]});
pres.defineSlideMaster({title:"CONTENT",background:{color:WHITE},margin:[0.5,0.6,0.6,0.6],slideNumber:{x:12.3,y:7.0,w:0.6,h:0.3,fontSize:10,color:SLATE,align:"right"},objects:[
 {placeholder:{options:{name:"title",type:"title",x:0.6,y:0.35,w:12.1,h:0.75,fontSize:36,bold:true,color:INK,fontFace:"Cambria",valign:"middle",margin:0,align:"left"},text:""}},
 {placeholder:{options:{name:"body",type:"body",x:0.6,y:1.1,w:12.1,h:0.45,fontSize:16,italic:true,color:SLATE,valign:"top",margin:0,align:"left"},text:""}},
 {text:{text:"Ayu AI · class presentation",options:{x:0.6,y:7.0,w:5,h:0.3,fontSize:10,color:SLATE,margin:0}}},
]});
const sec=(t)=>pres.addSection({title:t});
let cur="";
const S=(master,section)=>{if(section!==cur){sec(section);cur=section;} return pres.addSlide({masterName:master,sectionTitle:section});};
const T=(s,t,sub)=>{s.addText(t,{placeholder:"title"}); if(sub) s.addText(sub,{placeholder:"body"});};
const ic=async(s,name,hex,x,y,d,bgFill)=>{ s.addShape(pres.shapes.OVAL,{x,y,w:d,h:d,fill:{color:bgFill},line:{color:bgFill},objectName:"icon circle"}); s.addImage({data:await icon(name,hex),x:x+d*0.25,y:y+d*0.25,w:d*0.5,h:d*0.5,altText:name.replace('Fa','')+" icon"}); };
const card=(s,x,y,w,h,fill=WHITE,line="D5D3E6",name="card")=>s.addShape(pres.shapes.ROUNDED_RECTANGLE,{x,y,w,h,rectRadius:0.12,fill:{color:fill},line:{color:line,width:1},shadow:{type:"outer",blur:6,offset:2,angle:90,color:"23204F",opacity:0.12},objectName:name});
const pill=(s,txt,x,y,w,h,fill,color=WHITE,fs=12)=>{s.addShape(pres.shapes.ROUNDED_RECTANGLE,{x,y,w,h,rectRadius:h/2,fill:{color:fill},line:{color:fill},objectName:"chip "+txt}); s.addText(txt,{x,y,w,h,fontSize:fs,bold:true,color,align:"center",valign:"middle",margin:0,isTextBox:true});};
const txt=(s,t,o)=>s.addText(t,Object.assign({isTextBox:true,margin:0,color:INK,fontSize:14,valign:"top"},o));
const img=(s,file,alt,y=1.7,h=5.2)=>{const w=h*1240/640; s.addImage({path:file,x:(13.333-w)/2,y,w,h,altText:alt});};

// 1 Title
let s=S("DARK","Introduction");
s.addText("Ayu AI",{placeholder:"title"});
s.addText("Age, health and a Vedic birth chart on one page, explained by a self-hosted AI",{placeholder:"body"});
txt(s,"Dinesh  ·  Class presentation  ·  November 2026",{x:0.8,y:5.3,w:8,h:0.4,fontSize:16,color:"CFCBEF"});
txt(s,"āyu (Sanskrit) = life",{x:0.8,y:1.6,w:6,h:0.4,fontSize:16,italic:true,color:SAFF});
const pillars=[["FaHourglassHalf","Age",SAFF],["FaHeartbeat","Health",TEAL],["FaMoon","Kundali",PLUM],["FaRobot","AI",GOLD]];
for(let i=0;i<4;i++){const [n,l,c]=pillars[i]; const x=8.9+(i%2)*1.75, y=4.55+Math.floor(i/2)*1.25; await ic(s,n,"FFFFFF",x,y,0.8,c); txt(s,l,{x:x-0.3,y:y+0.83,w:1.4,h:0.3,fontSize:13,bold:true,color:WHITE,align:"center"});}
s.addNotes("Ayu means life in Sanskrit. The app reads your age, your health and your Vedic birth chart together, then a small AI model that runs on our own server writes a short summary.");

// 2 Overview
s=S("CONTENT","Introduction"); T(s,"Overview","One web page that answers: how old am I, how healthy am I, and what does my birth chart say?");
txt(s,[{text:"What it is",options:{bold:true,fontSize:20,color:INK,breakLine:true}},
 {text:"An educational web app that merges two earlier projects (an age calculator and HealthCheck) and adds a kundali, a database, an AI read and a cloud deployment.",options:{fontSize:16,color:SLATE,breakLine:true}},
 {text:" ",options:{fontSize:10,breakLine:true}},
 {text:"Why it is interesting",options:{bold:true,fontSize:20,color:INK,breakLine:true}},
 {text:"Real calculations, a local LLM, microservices and CI/CD in one small, complete system.",options:{fontSize:16,color:SLATE,breakLine:true}},
 {text:" ",options:{fontSize:10,breakLine:true}},
 {text:"Not a medical device. Astrology is shown as a cultural tradition.",options:{fontSize:14,italic:true,color:SAFF}}],
 {x:0.6,y:1.9,w:5.0,h:4.6});
const ov=[["FaHourglassHalf",SAFF,"Age","Exact age, live seconds counter, next-birthday countdown"],["FaHeartbeat",TEAL,"Health","BMI, BMR, TDEE, alerts, 12-week weight projection, Lifeline estimate"],["FaMoon",PLUM,"Kundali","North Indian chart, nakshatra, dasha timeline, animated planet wheel"],["FaRobot",GOLD,"AI insight","qwen2.5:1.5b on our server explains the numbers, streamed word by word"]];
for(let i=0;i<4;i++){const [n,c,h,d]=ov[i]; const x=6.1+(i%2)*3.35, y=1.9+Math.floor(i/2)*2.45; card(s,x,y,3.1,2.2); await ic(s,n,"FFFFFF",x+0.25,y+0.25,0.7,c); txt(s,h,{x:x+1.1,y:y+0.38,w:1.9,h:0.45,fontSize:20,bold:true,fontFace:"Cambria"}); txt(s,d,{x:x+0.25,y:y+1.1,w:2.65,h:0.95,fontSize:14,color:SLATE});}

// 3 How it works
s=S("CONTENT","Introduction"); T(s,"How it works","Four steps from a form to a shareable reading");
const steps=[["FaKeyboard","Enter details","Birth date, optional time and place, height, weight, waist, habits"],["FaCalculator","Services calculate","health-svc and kundali-svc compute every number, deterministically"],["FaComments","AI explains","ai-svc asks the local model for a short read and its own lifespan guess"],["FaShareAlt","Save and share","The reading is stored anonymously and opens again with a link"]];
for(let i=0;i<4;i++){const [n,h,d]=steps[i]; const x=0.6+i*3.1; card(s,x,2.0,2.8,3.9,i===1?LAV:WHITE);
 pill(s,String(i+1),x+0.25,2.25,0.5,0.5,[SAFF,TEAL,GOLD,PLUM][i]);
 await ic(s,n,HEX.ink,x+1.0,2.7,1.0,LAV); txt(s,h,{x:x+0.25,y:3.95,w:2.3,h:0.45,fontSize:20,bold:true,fontFace:"Cambria"}); txt(s,d,{x:x+0.25,y:4.45,w:2.3,h:1.3,fontSize:14,color:SLATE});
 if(i<3) s.addShape(pres.shapes.RIGHT_ARROW,{x:x+2.83,y:3.75,w:0.24,h:0.35,fill:{color:INK},line:{color:INK},objectName:"flow arrow"});}
txt(s,"Rule: calculated numbers and the AI's guess are always shown as separate, labelled sections.",{x:0.6,y:6.25,w:12.1,h:0.4,fontSize:16,italic:true,color:SAFF,align:"center"});

// 4 FR
s=S("CONTENT","Requirements"); T(s,"Functional requirements","What the system must do: 14 requirements, traced in the RTM");
const FR=D.reqs.filter(r=>r[1]==="Functional");
const shortFR={"FR-01":"Years, months, days and birthday countdown","FR-02":"BMI, BMR, TDEE, water, waist-to-height","FR-03":"Ranked alerts, 12-week projection","FR-04":"Remaining years, factor by factor","FR-05":"Clear 400 errors for bad input","FR-06":"OpenStreetMap + time zone","FR-07":"Lagna, nakshatra, planets, dasha","FR-08":"Noon used, chart flagged","FR-09":"Birth to today, then live sky","FR-10":"Streamed, explains numbers only","FR-11":"Raw answers only, shown apart","FR-12":"Anonymous, share links","FR-13":"DB, AI and per-service health","FR-14":"Test, build, deploy on push to main"};
for(let i=0;i<FR.length;i++){const r=FR[i]; const col=Math.floor(i/7), row=i%7; const x=0.6+col*6.2, y=1.8+row*0.72;
 s.addShape(pres.shapes.ROUNDED_RECTANGLE,{x,y,w:5.9,h:0.6,rectRadius:0.1,fill:{color:row%2?WHITE:LAV},line:{color:"D5D3E6",width:0.75},objectName:"FR row"});
 pill(s,r[0],x+0.12,y+0.14,0.95,0.32,SAFF,WHITE,12);
 txt(s,[{text:r[2],options:{bold:true,color:INK}},{text:"   "+shortFR[r[0]],options:{color:SLATE}}],{x:x+1.22,y:y,w:4.6,h:0.6,fontSize:14,valign:"middle"});}

// 5 NFR
s=S("CONTENT","Requirements"); T(s,"Non-functional requirements","How well it must do it: quality, safety and cost");
const NFR=D.reqs.filter(r=>r[1]==="Non-functional");
const nIcon={"NFR-01":"FaUserCheck","NFR-02":"FaShieldAlt","NFR-03":"FaSyncAlt","NFR-04":"FaHeartbeat","NFR-05":"FaBolt","NFR-06":"FaCheckCircle","NFR-07":"FaBalanceScale","NFR-08":"FaLayerGroup","NFR-09":"FaCoins","NFR-10":"FaExpandArrowsAlt"};
const nShort={"NFR-01":"No name, email or IP; AI never leaves our server","NFR-02":"One public port, internal networks, strict CSP","NFR-03":"Friendly 503 when a service is down","NFR-04":"/healthz and Docker health checks everywhere","NFR-05":"AI text streams; results are cached","NFR-06":"Deterministic, checked against known values","NFR-07":"Calculated vs AI's guess, clear disclaimers","NFR-08":"Own code, tests and image per service","NFR-09":"One 2 vCPU VM, CPU model, no API key","NFR-10":"Azure Container Apps, scale from zero"};
for(let i=0;i<NFR.length;i++){const r=NFR[i]; const col=i%5,row=Math.floor(i/5); const x=0.6+col*2.48, y=1.8+row*2.55; card(s,x,y,2.25,2.3);
 await ic(s,nIcon[r[0]],"FFFFFF",x+0.2,y+0.2,0.6,PLUM); txt(s,r[0],{x:x+0.95,y:y+0.3,w:1.2,h:0.4,fontSize:12,bold:true,color:PLUM,valign:"middle"});
 txt(s,r[0]==="NFR-02"?"Security":r[2],{x:x+0.2,y:y+0.95,w:1.95,h:0.4,fontSize:16,bold:true,fontFace:"Cambria"}); txt(s,nShort[r[0]],{x:x+0.2,y:y+1.38,w:1.9,h:0.85,fontSize:13,color:SLATE});}

// 6-8 diagrams
s=S("CONTENT","System design"); T(s,"Context diagram","Ayu AI as one system, and everything outside it that it talks to"); img(s,"context.png","Context diagram: Visitor and Developer interact with the Ayu AI system, which uses OpenStreetMap, the Ollama model library, GitHub and Azure");
s.addNotes("The visitor sends birth date, health inputs and place, and gets back age, health, kundali and the AI read. External systems: Nominatim for place search, Ollama library for the model download on first start, GitHub for CI/CD and images, Azure for hosting.");
s=S("CONTENT","System design"); T(s,"Use case diagram","Two human actors, three system actors, eight use cases"); img(s,"usecase.png","Use case diagram with Visitor, Developer and eight use cases");
s=S("CONTENT","System design"); T(s,"Architecture","Microservices: one gateway, three stateless services, four isolated networks"); img(s,"architecture.png","Architecture diagram: frontend, gateway, health-svc, kundali-svc, ai-svc, PostgreSQL and Ollama on four Docker networks");
s.addNotes("Only the frontend publishes a port. The gateway is the only public API and the only service that reaches Postgres. Only ai-svc reaches Ollama. The three domain services never call each other.");

// 9 Tech stack
s=S("CONTENT","System design"); T(s,"Tech stack","Open-source tools, no paid API");
const stack=[["FaMobileAlt",SAFF,"Frontend","HTML, CSS, JavaScript, Chart.js","nginx 1.27 serves the page"],["FaNodeJs",TEAL,"Services","Node.js 20, Express 5","gateway + 3 microservices"],["FaStar",PLUM,"Astronomy","Swiss Ephemeris (sweph)","Lahiri ayanamsa, whole-sign houses"],["FaRobot",GOLD,"AI","Ollama + qwen2.5:1.5b","runs on CPU, ~1 GB model"],["FaDatabase",TEAL,"Data","PostgreSQL 16","JSONB results, anonymous"],["FaDocker",SAFF,"Containers","Docker Compose","8 containers, 4 networks"],["FaGithub",PLUM,"CI/CD","GitHub Actions + GHCR","test, build, deploy"],["FaCloud",GOLD,"Cloud","Microsoft Azure","VM now, Container Apps next"]];
for(let i=0;i<8;i++){const [n,c,h,a,b]=stack[i]; const col=i%4,row=Math.floor(i/4); const x=0.6+col*3.1,y=1.85+row*2.55; card(s,x,y,2.85,2.3);
 await ic(s,n,"FFFFFF",x+0.25,y+0.25,0.65,c); txt(s,h,{x:x+1.05,y:y+0.35,w:1.7,h:0.45,fontSize:18,bold:true,fontFace:"Cambria",valign:"middle"});
 txt(s,a,{x:x+0.25,y:y+1.1,w:2.4,h:0.5,fontSize:15,bold:true}); txt(s,b,{x:x+0.25,y:y+1.6,w:2.4,h:0.5,fontSize:13,color:SLATE});}

// 10 Calculated vs AI
s=S("CONTENT","System design"); T(s,"Design rule: calculated vs AI's guess","The backend owns the numbers. The AI makes its own guess, shown apart.");
const cols2=[[TEAL,"FaCalculator","Calculated (backend)",["Deterministic formulas and Swiss Ephemeris","Covered by automated tests","Lifeline uses country baseline + habits","Shown as \"Lifeline\""]],[GOLD,"FaRobot","AI's guess (ai-svc)",["Gets raw answers only: no BMI, no lifespan, no kundali","Must be JSON, above current age, at most 125","Retries once, otherwise 502","Shown as \"AI's guess\", cached separately"]]];
for(let i=0;i<2;i++){const [c,n,h,items]=cols2[i]; const x=0.6+i*6.3; card(s,x,1.85,5.8,3.9,i?WHITE:LAV);
 await ic(s,n,"FFFFFF",x+0.35,2.15,0.8,c); txt(s,h,{x:x+1.35,y:2.25,w:4.2,h:0.6,fontSize:22,bold:true,fontFace:"Cambria",valign:"middle"});
 txt(s,items.map((t,k)=>({text:t,options:{bullet:true,breakLine:k<items.length-1}})),{x:x+0.4,y:3.2,w:5.1,h:2.4,fontSize:16,paraSpaceAfter:8,color:INK});}
pill(s,"Never merged",0.6,6.05,1.8,0.45,SAFF,WHITE,14);
txt(s,"A test checks that the guess prompt never sees the calculated numbers or the kundali. The two values are expected to differ.",{x:2.6,y:6.0,w:10.1,h:0.55,fontSize:15,color:SLATE,valign:"middle"});
s.addNotes("This is a project rule. A test checks that the guess prompt never sees the calculated numbers or the kundali. The two values are expected to differ, and that difference is part of the lesson.");

// 11 Pipeline
s=S("CONTENT","Deployment"); T(s,"Deployment pipeline (today)","GitHub Actions deploys to an Azure VM on every push to main"); img(s,"pipeline.png","CI/CD pipeline: push, test, build, publish, copy, restart, smoke check",1.75,5.1);
// 12 ACA
s=S("CONTENT","Deployment"); T(s,"Target: Azure Container Apps","In progress: one container app per service, managed Postgres in a private VNet"); img(s,"aca.png","Target Azure Container Apps architecture",1.75,5.1);
pill(s,"IN PROGRESS",10.9,0.5,1.8,0.42,SAFF,WHITE,13);

// 13-14 RTM
const comps=D.comps, compShort=["FE","GW","HS","KS","AI","DB","LLM","CI"];
const stColor={"Verified":TEAL,"Implemented":SAFF,"In progress":GOLD};
const rtmSlide=async(list,heading,sub,chipColor)=>{
 const s=S("CONTENT","Traceability"); T(s,heading,sub);
 const x0=0.6, y0=1.62, rowH=list.length>12?0.33:0.43; const cx0=5.55, cw=0.52;
 txt(s,"Requirement",{x:x0,y:y0,w:3,h:0.3,fontSize:12,bold:true,color:SLATE});
 txt(s,"Use case",{x:4.05,y:y0,w:1.4,h:0.3,fontSize:12,bold:true,color:SLATE});
 comps.forEach((c,j)=>txt(s,compShort[j],{x:cx0+j*cw,y:y0,w:cw,h:0.3,fontSize:12,bold:true,color:SLATE,align:"center"}));
 txt(s,"Tests",{x:9.85,y:y0,w:0.8,h:0.3,fontSize:12,bold:true,color:SLATE,align:"center"});
 txt(s,"Status",{x:10.9,y:y0,w:1.8,h:0.3,fontSize:12,bold:true,color:SLATE,align:"center"});
 for(let i=0;i<list.length;i++){const r=list[i]; const y=y0+0.38+i*rowH;
  if(i%2===0) s.addShape(pres.shapes.RECTANGLE,{x:x0,y:y,w:12.1,h:rowH,fill:{color:LAV},line:{color:LAV},objectName:"row band"});
  pill(s,r[0],x0+0.05,y+(rowH-0.26)/2,0.82,0.26,chipColor,WHITE,10);
  txt(s,r[2],{x:x0+0.98,y,w:2.5,h:rowH,fontSize:12,bold:true,valign:"middle"});
  txt(s,r[5].join(", "),{x:4.05,y,w:1.45,h:rowH,fontSize:11,color:SLATE,valign:"middle"});
  // lane line + dots
  s.addShape(pres.shapes.LINE,{x:cx0+cw/2,y:y+rowH/2,w:(comps.length-1)*cw,h:0,line:{color:"C9C6E0",width:1},objectName:"lane"});
  comps.forEach((c,j)=>{const on=r[6].includes(c); const d=on?0.2:0.09; s.addShape(pres.shapes.OVAL,{x:cx0+j*cw+(cw-d)/2,y:y+(rowH-d)/2,w:d,h:d,fill:{color:on?INK:"C9C6E0"},line:{color:on?INK:"C9C6E0"},objectName:on?"uses "+c:"not used"});});
  const n=r[9].length; txt(s,n?String(n):"–",{x:9.85,y,w:0.8,h:rowH,fontSize:13,bold:true,color:n?TEAL:SLATE,align:"center",valign:"middle"});
  pill(s,r[10],11.0,y+(rowH-0.26)/2,1.6,0.26,stColor[r[10]],WHITE,10);
 }
 txt(s,"FE frontend · GW gateway · HS health-svc · KS kundali-svc · AI ai-svc · DB postgres · LLM ollama · CI GitHub Actions / infra.  Full matrix with test names: Ayu-AI-RTM.xlsx",{x:0.6,y:6.68,w:12.1,h:0.28,fontSize:10,color:SLATE});
 return s;};
s=await rtmSlide(FR,"RTM: functional requirements","Each line traces a requirement through its use case and components to its tests",SAFF);
s.addNotes("Read across a row: the chip is the requirement, the dots are the components that implement it, the number is how many automated tests check it, and the pill is the status. The Excel file has the test names.");
s=await rtmSlide(NFR,"RTM: non-functional requirements","Quality requirements are verified by tests where possible, otherwise by inspection or CI",PLUM);

// 15 Testing
s=S("CONTENT","Traceability"); T(s,"Testing and verification","Each service has its own test suite; CI runs all four on every push");
const stats=[["26 / 26","automated tests pass",TEAL],["17 / 24","requirements checked by a test",SAFF],["8","use cases traced",PLUM]];
for(let i=0;i<3;i++){const [n,l,c]=stats[i]; const y=1.85+i*1.6; card(s,0.6,y,4.6,1.4); txt(s,n,{x:0.85,y:y+0.15,w:4.1,h:0.75,fontSize:44,bold:true,color:c,fontFace:"Cambria",valign:"middle"}); txt(s,l,{x:0.85,y:y+0.9,w:4.1,h:0.4,fontSize:15,color:SLATE});}
s.addChart(pres.charts.BAR,[{name:"Tests",labels:["gateway","health-svc","kundali-svc","ai-svc"],values:[8,5,5,8]}],{x:5.6,y:1.85,w:7.1,h:4.6,barDir:"col",chartColors:["1F8A80"],showValue:true,dataLabelPosition:"outEnd",dataLabelColor:"23204F",dataLabelFontSize:14,dataLabelFontFace:"+mn-lt",showLegend:false,showTitle:true,title:"Automated tests per service (all passing)",titleFontSize:16,titleColor:"23204F",titleFontFace:"+mn-lt",catAxisLabelColor:"5B6478",catAxisLabelFontSize:13,catAxisLabelFontFace:"+mn-lt",valAxisLabelColor:"5B6478",valAxisLabelFontSize:11,valAxisLabelFontFace:"+mn-lt",valAxisMaxVal:10,valGridLine:{color:"E4E2F0",size:0.75},catGridLine:{style:"none"},barGapWidthPct:70});
txt(s,"ai-svc tests use a fake Ollama, so no model is needed in CI. The other 7 requirements are checked by inspection, demo or the CI run.",{x:5.6,y:6.5,w:7.1,h:0.45,fontSize:12,color:SLATE});

// 16 Future work
s=S("CONTENT","Wrap-up"); T(s,"Future work","Next steps, in order of value");
const fut=[["FaCloud",SAFF,"Switch to Container Apps","Move production from the VM after the first Azure run works"],["FaLock",TEAL,"HTTPS by default","Free managed certificate on Container Apps, no Caddy needed"],["FaBug",PLUM,"More automated tests","Place search, alerts and the frontend (end-to-end)"],["FaFlask",GOLD,"Educational astrology mode","Traditional lifespan beliefs, clearly labelled as belief, not prediction"],["FaGlobeAsia",TEAL,"More languages","Korean, Hindi and Nepali for the page and the AI read"],["FaChartLine",SAFF,"Compare AI vs calculated","Track how far the AI guess is from the Lifeline over many readings"]];
for(let i=0;i<6;i++){const [n,c,h,d]=fut[i]; const col=i%2,row=Math.floor(i/2); const x=0.6+col*6.25,y=1.85+row*1.6; card(s,x,y,5.85,1.4);
 await ic(s,n,"FFFFFF",x+0.25,y+0.3,0.8,c); txt(s,h,{x:x+1.3,y:y+0.22,w:4.4,h:0.45,fontSize:18,bold:true,fontFace:"Cambria"}); txt(s,d,{x:x+1.3,y:y+0.7,w:4.4,h:0.6,fontSize:14,color:SLATE});}

// 17 Summary
s=S("DARK","Wrap-up");
txt(s,"Summary",{x:0.8,y:0.6,w:11.7,h:1.0,fontSize:48,bold:true,color:WHITE,fontFace:"Cambria",valign:"middle"});
const sum=[["Complete system","Age, health, kundali and an AI read on one page"],["Clear requirements","14 functional, 10 non-functional, all traced in the RTM"],["Microservices","Gateway + 3 stateless services, isolated networks"],["Honest AI","Local model; calculated numbers and AI's guess kept apart"],["Automated delivery","26 passing tests; every push to main deploys to Azure"]];
for(let i=0;i<5;i++){const [h,d]=sum[i]; const y=1.95+i*0.9; pill(s,String(i+1),0.8,y+0.08,0.5,0.5,[SAFF,TEAL,PLUM,GOLD,SAFF][i]); txt(s,h,{x:1.55,y,w:3.6,h:0.66,fontSize:22,bold:true,color:WHITE,fontFace:"Cambria",valign:"middle"}); txt(s,d,{x:5.2,y,w:7.3,h:0.66,fontSize:18,color:"CFCBEF",valign:"middle"});}
txt(s,"Thank you · Questions?",{x:0.8,y:6.55,w:11.7,h:0.5,fontSize:22,italic:true,color:SAFF,fontFace:"Cambria"});

await pres.writeFile({fileName:"Ayu-AI-Presentation.pptx"});
await applyTheme("Ayu-AI-Presentation.pptx",THEME);
console.log("done");
})().catch(e=>{console.error(e);process.exit(1)});
