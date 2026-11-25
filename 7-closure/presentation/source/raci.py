# Builds Ayu-AI-RACI.xlsx in the same style as xlsx.py (RTM).
# Run: python3 raci.py
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.chart import BarChart, Reference

INK="23204F"; SAFF="E07A2E"; TEAL="1F8A80"; LAV="EEEDF7"; PLUM="6C4FA0"; GOLD="D9A21B"; GREY="5B6478"
F="Calibri"
thin=Side(style="thin",color="D5D3E6"); B=Border(left=thin,right=thin,top=thin,bottom=thin)
def fill(c): return PatternFill("solid",fgColor=c)
hdr_font=Font(name=F,bold=True,color="FFFFFF",size=11)
def header(ws,row,cols,color=INK):
    for i,h in enumerate(cols,1):
        c=ws.cell(row=row,column=i,value=h); c.font=hdr_font; c.fill=fill(color)
        c.alignment=Alignment(horizontal="center",vertical="center",wrap_text=True); c.border=B
    ws.row_dimensions[row].height=34
def title(ws,text,sub):
    ws["A1"]=text; ws["A1"].font=Font(name=F,bold=True,size=18,color=INK)
    ws["A2"]=sub; ws["A2"].font=Font(name=F,italic=True,size=11,color=GREY)
    ws.row_dimensions[1].height=28

# ---------------- Team (6 people, role placeholders) ----------------
TEAM=[
 ("PM","Project Manager / Team Lead","Scope, schedule, requirements sign-off, release decisions, class presentation"),
 ("BE","Backend Developer","gateway, health-svc, kundali-svc, Postgres results DB"),
 ("FE","Frontend Developer","Page UI, kundali chart and planet wheel, nginx config"),
 ("AI","AI/ML Engineer","ai-svc, Ollama with qwen2.5:1.5b, insight and AI-guess prompts"),
 ("DO","DevOps / Cloud Engineer","Docker, GitHub Actions CI/CD, Azure Container Apps (japaneast), security"),
 ("QA","QA & Documentation","Test plan, test runs, RTM, README and user-facing docs"),
]
CODES=[t[0] for t in TEAM]

# ---------------- Tasks: (phase, task, deliverable, {code: letter}) ----------------
# Letters: R, A, R/A (does it and owns it), C, I. Exactly one A (or R/A) per task.
T=[
 ("Planning & design","Project scope, goals and schedule","Project plan",
  dict(PM="R/A",BE="C",FE="C",AI="C",DO="C",QA="C")),
 ("Planning & design","Functional and non-functional requirements","FR-01..14, NFR-01..10",
  dict(PM="A",BE="C",FE="C",AI="C",DO="C",QA="R")),
 ("Planning & design","Use cases and diagrams (context, use case)","UC-01..08, diagrams",
  dict(PM="A",BE="C",FE="C",AI="C",DO="I",QA="R")),
 ("Planning & design","Microservice architecture and networks","Architecture diagram",
  dict(PM="A",BE="R",FE="C",AI="C",DO="R",QA="I")),
 ("Backend services","Age and health metrics (BMI, BMR, TDEE, alerts, projection)","health-svc",
  dict(PM="I",BE="R/A",FE="C",AI="I",DO="I",QA="C")),
 ("Backend services","Lifeline estimate (calculated lifespan)","health-svc lifespan.js",
  dict(PM="C",BE="R/A",FE="I",AI="C",DO="I",QA="C")),
 ("Backend services","Kundali with Swiss Ephemeris (lagna, nakshatra, dasha, transits)","kundali-svc",
  dict(PM="I",BE="R/A",FE="C",AI="C",DO="C",QA="C")),
 ("Backend services","API gateway: orchestration, share links, place search","gateway",
  dict(PM="I",BE="R/A",FE="C",AI="C",DO="C",QA="C")),
 ("Backend services","Results database (anonymous readings, AI cache)","Postgres, db.js",
  dict(PM="I",BE="R/A",FE="I",AI="C",DO="C",QA="I")),
 ("AI","Self-hosted model on CPU (Ollama, qwen2.5:1.5b)","ollama image",
  dict(PM="I",BE="I",FE="I",AI="R/A",DO="C",QA="I")),
 ("AI","\"Ayu's read\" insight prompt, streamed","ai-svc /insight",
  dict(PM="I",BE="C",FE="C",AI="R/A",DO="I",QA="C")),
 ("AI","AI's own lifespan guess (raw answers only, validated, one retry)","ai-svc /guess",
  dict(PM="C",BE="C",FE="I",AI="R/A",DO="I",QA="C")),
 ("AI","Separate \"Calculated\" vs \"AI's guess\" sections and disclaimers","Page copy, ai.js",
  dict(PM="A",BE="C",FE="R",AI="R",DO="I",QA="C")),
 ("Frontend","Input form, results, health and Lifeline sections","index.html, app.js, style.css",
  dict(PM="I",BE="C",FE="R/A",AI="I",DO="I",QA="C")),
 ("Frontend","Kundali chart and animated planet wheel","kundali.js",
  dict(PM="I",BE="C",FE="R/A",AI="I",DO="I",QA="C")),
 ("Frontend","nginx proxy, AI text streaming, CSP","frontend/nginx.conf",
  dict(PM="I",BE="C",FE="R",AI="I",DO="A",QA="I")),
 ("DevOps & cloud","Dockerfiles and docker compose for local runs","Dockerfiles, docker-compose.yml",
  dict(PM="I",BE="C",FE="C",AI="C",DO="R/A",QA="I")),
 ("DevOps & cloud","CI/CD pipeline (tests, build to ACR, deploy)","GitHub Actions workflows",
  dict(PM="I",BE="C",FE="I",AI="C",DO="R/A",QA="C")),
 ("DevOps & cloud","Azure Container Apps infrastructure in japaneast","infra/main.bicep",
  dict(PM="C",BE="C",FE="I",AI="C",DO="R/A",QA="I")),
 ("DevOps & cloud","Secrets and security (OIDC, DB password, internal networks)","GitHub environment, VNet",
  dict(PM="I",BE="C",FE="I",AI="I",DO="R/A",QA="I")),
 ("DevOps & cloud","Production release and health monitoring","Live site, /api/status",
  dict(PM="A",BE="C",FE="I",AI="C",DO="R",QA="C")),
 ("Testing & QA","Test plan and test case list","TC-HS, TC-KS, TC-AI, TC-GW",
  dict(PM="I",BE="C",FE="C",AI="C",DO="I",QA="R/A")),
 ("Testing & QA","Automated unit and HTTP tests per service","npm test (26 tests)",
  dict(PM="I",BE="R",FE="I",AI="R",DO="C",QA="A")),
 ("Testing & QA","Manual and acceptance testing on the live site","Test results",
  dict(PM="C",BE="I",FE="R",AI="I",DO="I",QA="R/A")),
 ("Testing & QA","Bug triage and fixes","Issues, pull requests",
  dict(PM="A",BE="R",FE="R",AI="R",DO="C",QA="C")),
 ("Docs & delivery","Requirements Traceability Matrix","Ayu-AI-RTM.xlsx",
  dict(PM="C",BE="C",FE="I",AI="C",DO="I",QA="R/A")),
 ("Docs & delivery","README, setup and deploy guides","README, deploy/azure/README.md",
  dict(PM="I",BE="C",FE="C",AI="C",DO="R",QA="A")),
 ("Docs & delivery","Class presentation and live demo","Ayu-AI-Presentation.pptx",
  dict(PM="R/A",BE="C",FE="C",AI="C",DO="C",QA="R")),
]
for _,task,_,m in T:
    assert sum("A" in m.get(c,"") for c in CODES)==1, task
    assert any("R" in m.get(c,"") for c in CODES), task

LETTER={"R/A":("FBE3CF","B5561A"),"A":("F6D7D2","A33A2C"),"R":("FDEBDD","B5561A"),"C":("DDF3EF",TEAL),"I":("EEEDF7",PLUM)}
def letter_rules(ws,rng):
    for k,(bg,fg) in LETTER.items():
        ws.conditional_formatting.add(rng,CellIsRule(operator="equal",formula=[f'"{k}"'],fill=fill(bg),font=Font(name=F,bold=True,color=fg)))

wb=Workbook()
# ---------------- RACI Matrix ----------------
ws=wb.active; ws.title="RACI Matrix"
title(ws,"Ayu AI · RACI chart","Who does what on a 6-person team. R = Responsible, A = Accountable, C = Consulted, I = Informed. R/A = does the work and owns it. One A per task.")
roles=[f"{c}\n{n}" for c,n,_ in TEAM]
cols=["ID","Phase","Task","Deliverable / component"]+roles+["A count","R count","Check"]
header(ws,4,cols); ws.row_dimensions[4].height=48
first=5; last=first+len(T)-1
c0=5; cN=c0+len(CODES)-1; L0=get_column_letter(c0); LN=get_column_letter(cN)
PH={}
for r,(ph,task,deliv,m) in enumerate(T,first):
    PH[ph]=PH.get(ph,0)+1
    tid=f"T-{r-first+1:02d}"
    band="FFFFFF" if r%2 else "F7F6FC"
    vals=[tid,ph,task,deliv]+[m.get(c,"") for c in CODES]
    for i,v in enumerate(vals,1):
        c=ws.cell(row=r,column=i,value=v); c.border=B; c.fill=fill(band)
        c.font=Font(name=F,size=10,color=INK,bold=(i in (1,3)))
        c.alignment=Alignment(vertical="center",wrap_text=True,horizontal="center" if i==1 or i>=c0 else "left")
    ws.cell(row=r,column=1).font=Font(name=F,size=10,bold=True,color=SAFF)
    ws.cell(row=r,column=2).font=Font(name=F,size=10,color=GREY)
    a=ws.cell(row=r,column=cN+1,value=f'=COUNTIF({L0}{r}:{LN}{r},"A")+COUNTIF({L0}{r}:{LN}{r},"R/A")')
    rc=ws.cell(row=r,column=cN+2,value=f'=COUNTIF({L0}{r}:{LN}{r},"R")+COUNTIF({L0}{r}:{LN}{r},"R/A")')
    La=get_column_letter(cN+1); Lr=get_column_letter(cN+2)
    ck=ws.cell(row=r,column=cN+3,value=f'=IF(AND({La}{r}=1,{Lr}{r}>=1),"OK","Fix")')
    for c in (a,rc,ck):
        c.border=B; c.fill=fill(band); c.alignment=Alignment(horizontal="center",vertical="center"); c.font=Font(name=F,size=10,color=INK)
    ws.row_dimensions[r].height=32
Lck=get_column_letter(cN+3)
ws.conditional_formatting.add(f"{Lck}{first}:{Lck}{last}",CellIsRule(operator="equal",formula=['"OK"'],fill=fill("DDF3EF"),font=Font(name=F,bold=True,color=TEAL)))
ws.conditional_formatting.add(f"{Lck}{first}:{Lck}{last}",CellIsRule(operator="equal",formula=['"Fix"'],fill=fill("F6D7D2"),font=Font(name=F,bold=True,color="A33A2C")))
letter_rules(ws,f"{L0}{first}:{LN}{last}")
dv=DataValidation(type="list",formula1='"R,A,R/A,C,I"',allow_blank=True); ws.add_data_validation(dv); dv.add(f"{L0}{first}:{LN}{last}")
widths=[7,17,44,28]+[13]*len(CODES)+[8,8,8]
for i,w in enumerate(widths,1): ws.column_dimensions[get_column_letter(i)].width=w
ws.freeze_panes=f"{L0}{first}"; ws.auto_filter.ref=f"A4:{Lck}{last}"
ws.print_title_rows="4:4"
# legend under the table
lg=last+2
ws.cell(row=lg,column=3,value="Legend").font=Font(name=F,bold=True,size=12,color=INK)
LEG=[("R","Responsible","Does the work."),("A","Accountable","Owns the result and signs it off. Exactly one per task."),
     ("R/A","Responsible + Accountable","Does the work and owns it."),("C","Consulted","Gives input before or during the work (two-way)."),
     ("I","Informed","Told about progress or the result (one-way).")]
for i,(k,n,d) in enumerate(LEG,lg+1):
    a=ws.cell(row=i,column=3,value=f"{k}  {n}"); bg,fg=LETTER[k]; a.fill=fill(bg); a.font=Font(name=F,bold=True,color=fg); a.border=B
    ws.cell(row=i,column=4,value=d).font=Font(name=F,color=INK)

# ---------------- Workload ----------------
w=wb.create_sheet("Workload")
title(w,"Workload by role","How many tasks each person is Responsible, Accountable, Consulted or Informed on. Counts update when the matrix changes.")
header(w,4,["Code","Role","Responsible (R + R/A)","Accountable (A + R/A)","Consulted","Informed","Tasks involved"],TEAL)
for r,(code,name,_) in enumerate(TEAM,5):
    col=get_column_letter(c0+CODES.index(code)); rng=f"'RACI Matrix'!{col}{first}:{col}{last}"
    vals=[code,name,
          f'=COUNTIF({rng},"R")+COUNTIF({rng},"R/A")',
          f'=COUNTIF({rng},"A")+COUNTIF({rng},"R/A")',
          f'=COUNTIF({rng},"C")', f'=COUNTIF({rng},"I")',
          f'=COUNTA({rng})-COUNTBLANK({rng})']
    for i,v in enumerate(vals,1):
        c=w.cell(row=r,column=i,value=v); c.border=B
        c.font=Font(name=F,size=11,color=INK,bold=i in (1,2))
        c.alignment=Alignment(horizontal="left" if i==2 else "center",vertical="center")
        if r%2==0: c.fill=fill("F7F6FC")
    w.row_dimensions[r].height=22
wl=4+len(TEAM)
tr=wl+1
w.cell(row=tr,column=2,value="Total")
for j in range(3,7):
    L=get_column_letter(j); w.cell(row=tr,column=j,value=f"=SUM({L}5:{L}{wl})")
for j in range(1,8):
    c=w.cell(row=tr,column=j); c.fill=fill(INK); c.border=B; c.font=Font(name=F,bold=True,color="FFFFFF"); c.alignment=Alignment(horizontal="center" if j!=2 else "left")
for i,wd in enumerate([8,30,14,14,12,12,12],1): w.column_dimensions[get_column_letter(i)].width=wd
ch=BarChart(); ch.type="bar"; ch.grouping="stacked"; ch.overlap=100
ch.title="Tasks per role"; ch.y_axis.title="Tasks"; ch.height=8.5; ch.width=18
data=Reference(w,min_col=3,max_col=6,min_row=4,max_row=wl); cats=Reference(w,min_col=1,min_row=5,max_row=wl)
ch.add_data(data,titles_from_data=True); ch.set_categories(cats)
for s,colr in zip(ch.series,[SAFF,"A33A2C",TEAL,PLUM]):
    s.graphicalProperties.solidFill=colr; s.graphicalProperties.line.solidFill=colr
ch.x_axis.delete=False; ch.y_axis.delete=False; ch.legend.position="b"
w.add_chart(ch,f"A{tr+2}")

# ---------------- Summary (first) ----------------
s=wb.create_sheet("Summary",0)
title(s,"Ayu AI · RACI summary","Age, health and Vedic kundali on one page, with an AI insight from a self-hosted model. Team of 6 (placeholder roles; replace with names).")
header(s,4,["Code","Role (member)","Main areas"])
for r,(code,name,area) in enumerate(TEAM,5):
    for i,v in enumerate([code,name,area],1):
        c=s.cell(row=r,column=i,value=v); c.border=B; c.font=Font(name=F,size=11,color=INK,bold=i<3)
        c.alignment=Alignment(horizontal="center" if i==1 else "left",vertical="center",wrap_text=True)
        if r%2==0: c.fill=fill("F7F6FC")
    s.cell(row=r,column=1).font=Font(name=F,size=11,bold=True,color=SAFF)
    s.row_dimensions[r].height=30
r0=6+len(TEAM)
header(s,r0,["Check","","Value"])
s.merge_cells(start_row=r0,start_column=1,end_row=r0,end_column=2)
mx="'RACI Matrix'"; La=get_column_letter(cN+1); Lck=get_column_letter(cN+3)
checks=[("Tasks in the matrix",f"=COUNTA({mx}!A{first}:A{last})"),
        ("Tasks with exactly one Accountable",f'=COUNTIF({mx}!{La}{first}:{La}{last},1)'),
        ("Tasks passing the check (one A, at least one R)",f'=COUNTIF({mx}!{Lck}{first}:{Lck}{last},"OK")'),
        ("Phases",len(PH))]
for i,(lab,v) in enumerate(checks,r0+1):
    s.cell(row=i,column=1,value=lab); s.merge_cells(start_row=i,start_column=1,end_row=i,end_column=2)
    s.cell(row=i,column=3,value=v)
    for j in range(1,4):
        c=s.cell(row=i,column=j); c.border=B; c.font=Font(name=F,size=11,color=INK,bold=j==3)
        c.alignment=Alignment(horizontal="left" if j==1 else "center",vertical="center")
    s.row_dimensions[i].height=22
lg=r0+len(checks)+2
s.cell(row=lg,column=1,value="Legend").font=Font(name=F,bold=True,size=12,color=INK)
for i,(k,n,d) in enumerate(LEG,lg+1):
    a=s.cell(row=i,column=1,value=k); bg,fg=LETTER[k]; a.fill=fill(bg); a.font=Font(name=F,bold=True,color=fg); a.border=B; a.alignment=Alignment(horizontal="center")
    s.cell(row=i,column=2,value=n).font=Font(name=F,bold=True,color=INK)
    s.cell(row=i,column=3,value=d).font=Font(name=F,color=INK)
s.cell(row=lg+len(LEG)+2,column=1,value="Sheets: RACI Matrix (full chart) · Workload (counts and chart per role)").font=Font(name=F,italic=True,color=GREY)
s.column_dimensions["A"].width=10; s.column_dimensions["B"].width=34; s.column_dimensions["C"].width=72

for x in wb.worksheets:
    x.sheet_view.showGridLines=False; x.page_setup.orientation="landscape"; x.page_setup.fitToWidth=1; x.page_setup.fitToHeight=0; x.sheet_properties.pageSetUpPr.fitToPage=True
s.sheet_properties.tabColor=INK; ws.sheet_properties.tabColor=SAFF; w.sheet_properties.tabColor=TEAL
wb.save("Ayu-AI-RACI.xlsx")
print(len(T),"tasks")
