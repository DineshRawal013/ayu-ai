import json
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.formatting.rule import CellIsRule
from openpyxl.worksheet.datavalidation import DataValidation
D=json.load(open("data.json")); R=D["reqs"]; T=D["tests"]; U=D["usecases"]; C=D["comps"]
INK="23204F"; SAFF="E07A2E"; TEAL="1F8A80"; LAV="EEEDF7"; PLUM="6C4FA0"; GOLD="D9A21B"
F="Calibri"
thin=Side(style="thin",color="D5D3E6"); B=Border(left=thin,right=thin,top=thin,bottom=thin)
def fill(c): return PatternFill("solid",fgColor=c)
hdr_font=Font(name=F,bold=True,color="FFFFFF",size=11)
def header(ws,row,cols,color=INK):
    for i,h in enumerate(cols,1):
        c=ws.cell(row=row,column=i,value=h); c.font=hdr_font; c.fill=fill(color)
        c.alignment=Alignment(horizontal="center",vertical="center",wrap_text=True); c.border=B
    ws.row_dimensions[row].height=30
def title(ws,text,sub):
    ws["A1"]=text; ws["A1"].font=Font(name=F,bold=True,size=18,color=INK)
    ws["A2"]=sub; ws["A2"].font=Font(name=F,italic=True,size=11,color="5B6478")
    ws.row_dimensions[1].height=28
STATUS={"Verified":("DDF3EF",TEAL),"Implemented":("FDEBDD","B5561A"),"In progress":("FBF1D2","8A6A0C")}
def status_rules(ws,rng):
    for k,(bg,fg) in STATUS.items():
        ws.conditional_formatting.add(rng,CellIsRule(operator="equal",formula=[f'"{k}"'],fill=fill(bg),font=Font(name=F,bold=True,color=fg)))
wb=Workbook()
# ---------------- RTM ----------------
ws=wb.active; ws.title="RTM"
title(ws,"Ayu AI · Requirements Traceability Matrix","Each requirement traced to its use case, components, source and the test that verifies it. Tests: 26 of 26 passing (Node test runner, 18 Nov 2026).")
cols=["Req ID","Type","Requirement","Description","Priority","Use case(s)","Components","Source","Verification","Test case(s)","Status"]
header(ws,4,cols)
for r,q in enumerate(R,5):
    vals=[q[0],q[1],q[2],q[3],q[4],", ".join(q[5]),", ".join(q[6]),q[7],q[8],", ".join(q[9]) if q[9] else "—",q[10]]
    band = "FFFFFF" if r%2 else "F7F6FC"
    for i,v in enumerate(vals,1):
        c=ws.cell(row=r,column=i,value=v); c.font=Font(name=F,size=10,color=INK,bold=(i in (1,3)))
        c.alignment=Alignment(vertical="top",wrap_text=True,horizontal="center" if i in (1,2,5,11) else "left"); c.border=B; c.fill=fill(band)
    ws.cell(row=r,column=1).font=Font(name=F,size=10,bold=True,color=SAFF if q[1]=="Functional" else PLUM)
    ws.row_dimensions[r].height=42
last=4+len(R)
widths=[9,13,22,52,9,14,26,30,23,26,13]
for i,w in enumerate(widths,1): ws.column_dimensions[get_column_letter(i)].width=w
ws.freeze_panes="C5"; ws.auto_filter.ref=f"A4:K{last}"
status_rules(ws,f"K5:K{last}")
dv=DataValidation(type="list",formula1='"Verified,Implemented,In progress,Not started"',allow_blank=False); ws.add_data_validation(dv); dv.add(f"K5:K{last}")
dv2=DataValidation(type="list",formula1='"Must,Should,Could"'); ws.add_data_validation(dv2); dv2.add(f"E5:E{last}")
ws.print_title_rows="4:4"; ws.page_setup.orientation="landscape"; ws.page_setup.fitToWidth=1; ws.page_setup.fitToHeight=0; ws.sheet_properties.pageSetUpPr.fitToPage=True
# ---------------- Coverage matrix ----------------
m=wb.create_sheet("Coverage Matrix")
title(m,"Coverage matrix: requirements × components","● = the component takes part in meeting the requirement. Last columns count the tests and show the status.")
mc=["Req ID","Requirement"]+C+["Tests","Status"]
header(m,4,mc)
for r,q in enumerate(R,5):
    m.cell(row=r,column=1,value=q[0]).font=Font(name=F,bold=True,size=10,color=SAFF if q[1]=="Functional" else PLUM)
    m.cell(row=r,column=2,value=q[2]).font=Font(name=F,size=10,color=INK)
    for j,comp in enumerate(C,3):
        c=m.cell(row=r,column=j,value="●" if comp in q[6] else "")
        c.alignment=Alignment(horizontal="center",vertical="center"); c.font=Font(name=F,size=13,color=INK)
        if comp in q[6]: c.fill=fill(LAV)
    m.cell(row=r,column=3+len(C),value=len(q[9]))
    m.cell(row=r,column=4+len(C),value=q[10])
    for j in range(1,5+len(C)):
        c=m.cell(row=r,column=j); c.border=B
        if j>=3+len(C) or j==1: c.alignment=Alignment(horizontal="center",vertical="center")
        else: c.alignment=Alignment(vertical="center",horizontal=c.alignment.horizontal or "left")
    m.row_dimensions[r].height=20
mlast=4+len(R)
tr=mlast+1
m.cell(row=tr,column=2,value="Requirements per component").font=Font(name=F,bold=True,color="FFFFFF")
for j in range(1,5+len(C)):
    m.cell(row=tr,column=j).fill=fill(INK); m.cell(row=tr,column=j).border=B
for j in range(3,3+len(C)):
    L=get_column_letter(j); c=m.cell(row=tr,column=j,value=f'=COUNTIF({L}5:{L}{mlast},"●")')
    c.font=Font(name=F,bold=True,color="FFFFFF"); c.alignment=Alignment(horizontal="center")
L=get_column_letter(3+len(C)); c=m.cell(row=tr,column=3+len(C),value=f"=SUM({L}5:{L}{mlast})"); c.font=Font(name=F,bold=True,color="FFFFFF"); c.alignment=Alignment(horizontal="center")
m.column_dimensions["A"].width=9; m.column_dimensions["B"].width=28
for j in range(3,3+len(C)): m.column_dimensions[get_column_letter(j)].width=12
m.column_dimensions[get_column_letter(3+len(C))].width=8; m.column_dimensions[get_column_letter(4+len(C))].width=13
m.freeze_panes="C5"; status_rules(m,f"{get_column_letter(4+len(C))}5:{get_column_letter(4+len(C))}{mlast}")
# ---------------- Use cases ----------------
u=wb.create_sheet("Use Cases")
title(u,"Use cases","Actors and goals from the use case diagram, with the requirements each one traces to.")
header(u,4,["UC ID","Use case","Actor(s)","Description","Requirements"],TEAL)
for r,(k,(n,a,d)) in enumerate(U.items(),5):
    reqs=", ".join(q[0] for q in R if k in q[5])
    for i,v in enumerate([k,n,a,d,reqs],1):
        c=u.cell(row=r,column=i,value=v); c.border=B; c.alignment=Alignment(wrap_text=True,vertical="top",horizontal="center" if i==1 else "left")
        c.font=Font(name=F,size=10,color=INK,bold=i in (1,2))
    u.row_dimensions[r].height=36
for i,w in enumerate([9,26,24,58,36],1): u.column_dimensions[get_column_letter(i)].width=w
u.freeze_panes="A5"
# ---------------- Test cases ----------------
t=wb.create_sheet("Test Cases")
title(t,"Test cases","Automated tests in the repository (npm test in each service). Run on 18 Nov 2026: 26 passed, 0 failed.")
header(t,4,["Test ID","Service","Test name (as in code)","Verifies","Result"],PLUM)
for r,(k,(svc,name)) in enumerate(T.items(),5):
    ver=", ".join(q[0] for q in R if k in q[9]) or "—"
    for i,v in enumerate([k,svc,name,ver,"Pass"],1):
        c=t.cell(row=r,column=i,value=v); c.border=B; c.alignment=Alignment(wrap_text=True,vertical="top",horizontal="center" if i in (1,2,5) else "left")
        c.font=Font(name=F,size=10,color=INK,bold=i==1)
    t.cell(row=r,column=5).fill=fill("DDF3EF"); t.cell(row=r,column=5).font=Font(name=F,size=10,bold=True,color=TEAL)
for i,w in enumerate([11,13,64,22,9],1): t.column_dimensions[get_column_letter(i)].width=w
t.freeze_panes="A5"; tl=4+len(T)
# ---------------- Summary (first) ----------------
s=wb.create_sheet("Summary",0)
title(s,"Ayu AI · RTM summary","Age, health and Vedic kundali on one page, with an AI insight from a self-hosted model. Educational tool.")
header(s,4,["Measure","Functional","Non-functional","Total"])
rows=[("Requirements",None),("Verified","Verified"),("Implemented (inspection / demo)","Implemented"),("In progress","In progress")]
for r,(lab,st) in enumerate(rows,5):
    s.cell(row=r,column=1,value=lab)
    for j,typ in ((2,"Functional"),(3,"Non-functional")):
        f = f'=COUNTIF(RTM!B5:B{last},"{typ}")' if st is None else f'=COUNTIFS(RTM!B5:B{last},"{typ}",RTM!K5:K{last},"{st}")'
        s.cell(row=r,column=j,value=f)
    s.cell(row=r,column=4,value=f"=B{r}+C{r}")
r=9
s.cell(row=r,column=1,value="Covered by at least one automated test"); s.cell(row=r,column=4,value=f'=COUNTIF(RTM!J5:J{last},"TC-*")')
s.cell(row=10,column=1,value="Automated tests passing"); s.cell(row=10,column=4,value=f'=COUNTIF(\'Test Cases\'!E5:E{tl},"Pass")&" of "&COUNTA(\'Test Cases\'!A5:A{tl})')
s.cell(row=11,column=1,value="Use cases"); s.cell(row=11,column=4,value=f"=COUNTA('Use Cases'!A5:A{4+len(U)})")
for rr in range(5,12):
    for j in range(1,5):
        c=s.cell(row=rr,column=j); c.border=B; c.font=Font(name=F,size=11,color=INK,bold=(j==1 or j==4))
        c.alignment=Alignment(horizontal="left" if j==1 else "center",vertical="center")
        if rr%2==0: c.fill=fill("F7F6FC")
    s.row_dimensions[rr].height=22
s.cell(row=13,column=1,value="Status legend").font=Font(name=F,bold=True,size=12,color=INK)
for i,(k,txt) in enumerate([("Verified","An automated test or the CI run checks it"),("Implemented","Built and checked by inspection or demo; no automated test yet"),("In progress","Prepared, not live yet (Azure Container Apps)")],14):
    a=s.cell(row=i,column=1,value=k); bg,fg=STATUS[k]; a.fill=fill(bg); a.font=Font(name=F,bold=True,color=fg); a.border=B
    s.cell(row=i,column=2,value=txt).font=Font(name=F,color=INK)
s.cell(row=18,column=1,value="Sheets: RTM (full matrix) · Coverage Matrix · Use Cases · Test Cases").font=Font(name=F,italic=True,color="5B6478")
s.column_dimensions["A"].width=40
for L in "BCD": s.column_dimensions[L].width=16
for w in wb.worksheets:
    w.sheet_view.showGridLines=False; w.page_setup.orientation="landscape"; w.page_setup.fitToWidth=1; w.page_setup.fitToHeight=0; w.sheet_properties.pageSetUpPr.fitToPage=True
s.sheet_properties.tabColor=INK; ws.sheet_properties.tabColor=SAFF; m.sheet_properties.tabColor=TEAL; u.sheet_properties.tabColor=TEAL; t.sheet_properties.tabColor=PLUM
wb.save("Ayu-AI-RTM.xlsx")
