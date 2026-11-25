import html
INK="#23204F"; SAFF="#E07A2E"; TEAL="#1F8A80"; LAV="#EEEDF7"; PLUM="#6C4FA0"; GOLD="#D9A21B"; SLATE="#5B6478"; LINE="#7D8296"
W,H=1240,640
def esc(s): return html.escape(s)
def defs():
    m=""
    for name,c in [("a",LINE),("s",SAFF),("t",TEAL),("i",INK)]:
        m+=f'<marker id="m{name}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{c}"/></marker>'
    return f'<defs>{m}<filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#23204F" flood-opacity="0.12"/></filter></defs>'
def text(x,y,s,size=16,color=INK,weight=400,anchor="middle",italic=False):
    st=' font-style="italic"' if italic else ''
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{weight}" text-anchor="{anchor}"{st}>{esc(s)}</text>'
def box(x,y,w,h,title,sub=None,fill="#FFFFFF",stroke=INK,tc=INK,sc=SLATE,r=12,ts=17,ss=13,dash=None,shadow=True):
    d=f' stroke-dasharray="{dash}"' if dash else ''
    f=' filter="url(#sh)"' if shadow else ''
    out=f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="2"{d}{f}/>'
    lines=[sub] if isinstance(sub,str) else (sub or [])
    n=len(lines); cy=y+h/2 - (n*(ss+3))/2 + ts*0.35
    out+=text(x+w/2,cy,title,ts,tc,700)
    for i,l in enumerate(lines): out+=text(x+w/2,cy+ts*0.6+ (i+1)*(ss+4)-2,l,ss,sc)
    return out
def arrow(x1,y1,x2,y2,label=None,c=LINE,m="a",dash=None,lx=None,ly=None,both=False,ls=13,lc=None,lanchor="middle"):
    d=f' stroke-dasharray="{dash}"' if dash else ''
    ms=f' marker-start="url(#m{m})"' if both else ''
    out=f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{c}" stroke-width="2"{d} marker-end="url(#m{m})"{ms}/>'
    if label:
        lx=(x1+x2)/2 if lx is None else lx; ly=(y1+y2)/2-6 if ly is None else ly
        tw=len(label)*ls*0.53+12
        ax = lx - tw/2 if lanchor=="middle" else (lx-6 if lanchor=="start" else lx-tw+6)
        out+=f'<rect x="{ax}" y="{ly-ls}" width="{tw}" height="{ls+7}" rx="4" fill="#FFFFFF" opacity="0.92"/>'
        out+=text(lx,ly,label,ls,lc or SLATE,600,lanchor)
    return out
def path(d,c=LINE,m="a",dash=None):
    dd=f' stroke-dasharray="{dash}"' if dash else ''
    return f'<path d="{d}" fill="none" stroke="{c}" stroke-width="2"{dd} marker-end="url(#m{m})"/>'
def actor(x,y,name,c=INK,sub=None):
    o=f'<g stroke="{c}" stroke-width="3" fill="none" stroke-linecap="round"><circle cx="{x}" cy="{y}" r="13" fill="#fff"/><line x1="{x}" y1="{y+13}" x2="{x}" y2="{y+50}"/><line x1="{x-22}" y1="{y+26}" x2="{x+22}" y2="{y+26}"/><line x1="{x}" y1="{y+50}" x2="{x-17}" y2="{y+78}"/><line x1="{x}" y1="{y+50}" x2="{x+17}" y2="{y+78}"/></g>'
    o+=text(x,y+100,name,16,c,700)
    if sub: o+=text(x,y+118,sub,13,SLATE)
    return o
def svg(body): return f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="Liberation Sans, Arial, sans-serif">{defs()}{body}</svg>'

# ---------- Context diagram ----------
b=""
cx,cy=620,320
b+=f'<circle cx="{cx}" cy="{cy}" r="150" fill="{INK}" filter="url(#sh)"/>'
b+=text(cx,cy-52,"AYU AI",30,"#FFFFFF",700)
b+=text(cx,cy-24,"system",16,"#CFCBEF",400,italic=True)
for i,l in enumerate(["Web page + public API","Health & kundali services","Local AI (Ollama)","Reading history (Postgres)"]):
    b+=text(cx,cy+12+i*24,l,15,"#FFFFFF")
# externals
b+=box(40,90,230,96,"Visitor",["Student / curious user","in a web browser"],stroke=SAFF)
b+=box(40,450,230,96,"Developer",["Dinesh: code, deploy,","monitor"],stroke=TEAL)
b+=box(970,60,230,96,"OpenStreetMap",["Nominatim place search"],stroke=PLUM)
b+=box(970,272,230,96,"Ollama library",["model download","qwen2.5:1.5b (first start)"],stroke=PLUM)
b+=box(970,484,230,96,"GitHub",["repo, Actions CI/CD,","GHCR image registry"],stroke=PLUM)
b+=box(505,560,230,62,"Microsoft Azure",["hosting (VM today)"],stroke=PLUM,ts=16,ss=12)
b+=arrow(272,128,492,232,c=SAFF,m="s")
b+=text(300,108,"birth date, health, place",13,SAFF,700,"start")
b+=arrow(476,268,272,172,c=SAFF,m="s")
b+=text(280,302,"age, health, kundali, AI read",13,SAFF,700,"start")
b+=arrow(272,500,500,400,"push code / check status",c=TEAL,m="t",lx=380,ly=476)
b+=arrow(752,222,968,98)
b+=text(800,150,"place name",13,SLATE,600,"start")
b+=arrow(968,140,778,252)
b+=text(960,268,"lat, lon, time zone",13,SLATE,600,"end")
b+=arrow(968,320,772,320,"model weights",lx=870,ly=310)
b+=arrow(968,530,752,418)
b+=text(890,445,"tests, images, deploy",13,SLATE,600,"start")
b+=arrow(620,472,620,556,both=True)
b+=text(620,22+8,"",1)
open("context.svg","w").write(svg(b))

# ---------- Use case diagram ----------
b=""
b+=f'<rect x="250" y="20" width="740" height="600" rx="18" fill="{LAV}" stroke="{INK}" stroke-width="2"/>'
b+=text(620,52,"Ayu AI",20,INK,700)
def uc(x,y,w,label,code,c=INK):
    return f'<ellipse cx="{x}" cy="{y}" rx="{w/2}" ry="30" fill="#FFFFFF" stroke="{c}" stroke-width="2" filter="url(#sh)"/>'+text(x,y-2,label,15,INK,700)+text(x,y+16,code,12,SLATE)
ucs={
 "UC1":(470,110,"Get a reading","UC-01 · age, health, lifeline"),
 "UC2":(470,200,"Search birth place","UC-02"),
 "UC3":(470,290,"View kundali & wheel","UC-03"),
 "UC4":(470,380,"Read AI insight","UC-04 · streamed"),
 "UC5":(470,470,"See AI's lifespan guess","UC-05"),
 "UC6":(470,560,"Share / reopen reading","UC-06"),
 "UC7":(790,250,"Check system status","UC-07"),
 "UC8":(790,410,"Deploy new version","UC-08"),
}
for k,(x,y,l,c) in ucs.items(): b+=uc(x,y,250,l,c)
ax,ay=110,240
b+=actor(ax,ay,"Visitor",SAFF)
for k in ["UC1","UC2","UC3","UC4","UC5","UC6"]:
    x,y=ucs[k][:2]; b+=f'<line x1="{ax+28}" y1="{ay+30}" x2="{x-125}" y2="{y}" stroke="{SAFF}" stroke-width="2"/>'
dx,dy=1130,270
b+=actor(dx,dy,"Developer",TEAL)
for k in ["UC7","UC8"]:
    x,y=ucs[k][:2]; b+=f'<line x1="{dx-28}" y1="{dy+30}" x2="{x+125}" y2="{y}" stroke="{TEAL}" stroke-width="2"/>'
# secondary actors (system actors)
def sysactor(x,y,label,sub):
    return box(x,y,150,58,label,sub,stroke=PLUM,ts=14,ss=12,r=8)
b+=sysactor(1015,60,"Nominatim",["«system»"])
b+=sysactor(1015,520,"GitHub Actions",["«system»"])
b+=sysactor(40,520,"Local AI model",["«system» Ollama"])
b+=path("M 595 200 C 800 190, 900 120, 1013 92",c=PLUM,m="i")
b+=path("M 915 410 C 960 450, 990 520, 1013 545",c=PLUM,m="i")
b+=f'<path d="M 190 540 C 260 480, 300 420, 345 385" fill="none" stroke="{PLUM}" stroke-width="2" marker-end="url(#mi)"/>'
b+=f'<path d="M 190 545 C 260 520, 310 490, 345 475" fill="none" stroke="{PLUM}" stroke-width="2" marker-end="url(#mi)"/>'
# extend / include
b+=arrow(470,170,470,142,dash="6 5",c=INK,m="i")
b+=text(560,162,"«extend» optional place",12,PLUM,600)
b+=arrow(470,260,470,232,dash="6 5",c=INK,m="i")
b+=text(548,252,"«include» place",12,PLUM,600)
open("usecase.svg","w").write(svg(b))

# ---------- Architecture ----------
b=""
def zone(x,y,w,h,label,fill,stroke,note):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="{fill}" stroke="{stroke}" stroke-width="2" stroke-dasharray="7 5"/>'+text(x+16,y+26,label,15,stroke,700,"start")+text(x+16,y+44,note,12,SLATE,400,"start",True)
b+=box(20,262,130,80,"Browser",["user"],stroke=SAFF)
b+=zone(185,40,300,560,"frontend-net","#FFF5EC",SAFF,"public web tier")
b+=box(215,100,240,74,"caddy",["HTTPS, Let's Encrypt","(optional, Azure VM)"],dash="6 4",ts=16,ss=12)
b+=box(215,262,240,80,"frontend",["nginx 1.27 · static page","proxies /api/*"],ts=17)
b+=box(215,450,240,96,"gateway :3000",["only public API","orchestration, share links,","AI cache & locks"],fill=INK,stroke=INK,tc="#FFFFFF",sc="#D9D6F5")
b+=zone(560,40,330,330,"services-net","#EAF6F4",TEAL,"internal, no internet")
b+=box(590,90,270,74,"health-svc :3001",["age, health, lifespan"])
b+=box(590,180,270,74,"kundali-svc :3002",["Swiss Ephemeris (sweph)"])
b+=box(590,270,270,74,"ai-svc :3003",["prompts, streaming, checks"])
b+=zone(560,400,330,200,"data-net","#F1EEF8",PLUM,"internal, no internet")
b+=box(590,460,270,96,"PostgreSQL 16",["anonymous results","JSONB input & result"])
b+=zone(940,200,280,200,"ai-net","#FBF4E2",GOLD,"model download only")
b+=box(965,258,230,96,"Ollama",["qwen2.5:1.5b","runs on CPU"])
b+=box(965,470,230,80,"Nominatim",["OpenStreetMap (external)"],dash="6 4",ts=16,ss=12)
b+=arrow(152,302,213,302,c=SAFF,m="s")
b+=text(182,290,":80",12,SAFF,700)
b+=arrow(335,176,335,260,dash="5 4")
b+=arrow(335,344,335,448,"/api/*",c=INK,m="i")
b+=path("M 457 470 C 520 420, 520 140, 588 127",c=TEAL,m="t")
b+=path("M 457 485 C 530 440, 530 230, 588 217",c=TEAL,m="t")
b+=path("M 457 500 C 540 470, 540 320, 588 307",c=TEAL,m="t")
b+=arrow(457,510,588,508,":5432",c=PLUM,m="i")
b+=arrow(862,307,963,307,":11434",c=GOLD,m="a")
b+=path("M 457 530 C 520 600, 900 610, 963 525",dash="6 4")
b+=text(700,624,"place search (HTTPS)",12,SLATE,600)
open("architecture.svg","w").write(svg(b))

# ---------- CI/CD current ----------
b=""
steps=[("Push to main","GitHub",SAFF),("Test","4 services, matrix",TEAL),("Build","5 Docker images",TEAL),("Publish","GHCR :latest + :sha",TEAL),("Copy","compose + Caddyfile (SCP)",PLUM),("Restart","SSH: pull, up -d",PLUM),("Smoke check","curl /api/status",GOLD)]
x=20; y=110; w=150; gap=27
for i,(t,s,c) in enumerate(steps):
    xx=x+i*(w+gap)
    b+=f'<circle cx="{xx+w/2}" cy="{y-48}" r="20" fill="{c}"/>'+text(xx+w/2,y-42,str(i+1),17,"#FFFFFF",700)
    b+=box(xx,y,w,96,t,[s] if len(s)<20 else [s[:s.rfind(" ",0,19)],s[s.rfind(" ",0,19)+1:]],stroke=c,ts=17,ss=13)
    if i<len(steps)-1: b+=arrow(xx+w+2,y+48,xx+w+gap-2,y+48,c=INK,m="i")
b+=f'<rect x="20" y="290" width="1200" height="1" fill="#D5D3E6"/>'
b+=box(20,330,370,110,"Pull request",["tests only, no deploy","(+ Bicep check for infra changes)"],fill=LAV,stroke=INK,ts=17)
b+=box(435,330,370,110,"Azure VM (production)",["Ubuntu 24.04 · Standard_B2ms","2 vCPU, 8 GB, Docker Compose"],fill=LAV,stroke=INK,ts=17)
b+=box(850,330,370,110,"Secrets",["VM_HOST, VM_USER, VM_SSH_KEY","stored in GitHub, never in code"],fill=LAV,stroke=INK,ts=17)
b+=text(620,520,"Every push to main reaches production in minutes, with no manual steps.",18,INK,600,italic=True)
open("pipeline.svg","w").write(svg(b))

# ---------- ACA target ----------
b=""
b+=f'<rect x="20" y="20" width="1200" height="600" rx="18" fill="#F4F7FB" stroke="#0F6CBD" stroke-width="2"/>'
b+=text(40,50,"Azure resource group  ayu-aca-rg  (Korea Central)",16,"#0F6CBD",700,"start")
b+=box(40,90,180,90,"GitHub Actions",["deploy-aca.yml","OIDC sign-in, no password"],stroke=PLUM,ts=15,ss=12)
b+=box(40,240,180,90,"Container Registry",["ACR Basic","6 images"],stroke=PLUM,ts=15,ss=12)
b+=box(40,450,180,90,"Log Analytics",["logs from every app"],stroke=PLUM,ts=15,ss=12)
b+=f'<rect x="270" y="80" width="690" height="510" rx="16" fill="#FFFFFF" stroke="{TEAL}" stroke-width="2" stroke-dasharray="7 5"/>'
b+=text(430,108,"Container Apps environment (inside a private VNet)",15,TEAL,700,"start")
b+=box(300,135,200,84,"frontend",["public HTTPS ingress","scales 0 to 3"],stroke=SAFF,ts=16,ss=12)
b+=box(300,300,200,84,"gateway",["internal, 1 replica","(in-memory locks)"],fill=INK,stroke=INK,tc="#FFFFFF",sc="#D9D6F5",ts=16,ss=12)
b+=box(560,135,180,70,"health-svc",["0 to 3"],ts=15,ss=12)
b+=box(560,225,180,70,"kundali-svc",["0 to 3"],ts=15,ss=12)
b+=box(560,315,180,70,"ai-svc",["0 to 2"],ts=15,ss=12)
b+=box(780,300,160,84,"ollama",["model baked in","2 vCPU, 4 GiB"],stroke=GOLD,ts=15,ss=12)
b+=box(300,470,250,90,"PostgreSQL Flexible",["Burstable B1ms, 32 GB","private, VNet only"],stroke=PLUM,ts=15,ss=12)
b+=box(1000,135,200,84,"Visitor",["https://frontend…","azurecontainerapps.io"],stroke=SAFF,ts=16,ss=12)
b+=path("M 1100 133 L 1100 66 L 400 66 L 400 132",c=SAFF,m="s")
b+=text(760,60,"HTTPS",13,SAFF,700)
b+=arrow(400,221,400,298,c=INK,m="i")
b+=arrow(502,330,558,170,c=TEAL,m="t")
b+=arrow(502,342,558,260,c=TEAL,m="t")
b+=arrow(502,350,558,350,c=TEAL,m="t")
b+=arrow(742,350,778,342,c=GOLD)
b+=arrow(400,386,400,468,c=PLUM,m="i")
b+=arrow(130,182,130,238,"push images",lx=130,ly=214)
b+=arrow(222,285,268,285)
b+=box(1000,440,200,130,"Status",["prepared in PR #3","manual run only","VM stays production","until switch-over"],fill="#FFF5EC",stroke=SAFF,ts=16,ss=13)
open("aca.svg","w").write(svg(b))
