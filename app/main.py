from datetime import date
from typing import Optional

from fastapi import Depends, FastAPI, Form, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine, get_db
from app.export import export_contracts_excel
from app.models import Contract

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


def seed_data(db: Session):
    contracts = [
        Contract(contract_number="CNT-2023-001", customer_name="Rijkswaterstaat", kostenplaats="KP-100", description="Onderhoud infrastructuur Noord-Holland", start_date=date(2023, 1, 1), end_date=date(2024, 12, 31), contract_value=125000.00, status="expired", notes="Verlengd tot eind 2024"),
        Contract(contract_number="CNT-2024-007", customer_name="Gemeente Amsterdam", kostenplaats="KP-200, KP-210", description="IT-dienstverlening en beheer", start_date=date(2024, 3, 1), end_date=date(2026, 2, 28), contract_value=87500.00, status="active", notes="Jaarlijkse indexering van toepassing"),
        Contract(contract_number="CNT-2024-015", customer_name="NS Reizigers B.V.", kostenplaats="KP-300", description="Consultancy projectmanagement", start_date=date(2024, 6, 1), end_date=date(2025, 5, 31), contract_value=54000.00, status="active", notes=None),
        Contract(contract_number="CNT-2025-003", customer_name="Philips Nederland B.V.", kostenplaats="KP-400, KP-410", description="Software licenties en support", start_date=date(2025, 1, 15), end_date=None, contract_value=210000.00, status="active", notes="Doorlopend contract, geen einddatum"),
        Contract(contract_number="CNT-2025-011", customer_name="Shell Nederland", kostenplaats="KP-500", description="Trainingsprogramma medewerkers", start_date=date(2025, 9, 1), end_date=date(2025, 12, 31), contract_value=32500.00, status="draft", notes="In afwachting van goedkeuring directie"),
    ]
    db.add_all(contracts)
    db.commit()


@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        if db.query(Contract).count() == 0:
            seed_data(db)
    finally:
        db.close()


@app.get("/", response_class=RedirectResponse)
def root():
    return RedirectResponse(url="/contracts", status_code=302)


@app.get("/contracts", response_class=HTMLResponse)
def list_contracts(request: Request, search: Optional[str] = None, status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Contract)
    if search:
        like = f"%{search}%"
        query = query.filter(Contract.contract_number.ilike(like) | Contract.customer_name.ilike(like) | Contract.description.ilike(like) | Contract.kostenplaats.ilike(like))
    if status and status != "all":
        query = query.filter(Contract.status == status)
    contracts = query.order_by(Contract.id.desc()).all()
    if request.headers.get("hx-request"):
        return templates.TemplateResponse("contracts/table_partial.html", {"request": request, "contracts": contracts})
    return templates.TemplateResponse("contracts/list.html", {"request": request, "contracts": contracts, "search": search or "", "status": status or "all"})


@app.get("/contracts/new", response_class=HTMLResponse)
def new_contract_form(request: Request):
    return templates.TemplateResponse("contracts/form.html", {"request": request, "contract": None})


@app.get("/contracts/export/excel")
def export_excel(db: Session = Depends(get_db)):
    contracts = db.query(Contract).order_by(Contract.id).all()
    output = export_contracts_excel(contracts)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=contracten.xlsx"})


@app.get("/contracts/export/unit4", response_class=HTMLResponse)
def export_unit4():
    return HTMLResponse(content='<div class="toast-info">Unit4 export is nog niet ge\u00efmplementeerd</div>')


@app.get("/contracts/{contract_id}/edit", response_class=HTMLResponse)
def edit_contract_form(contract_id: int, request: Request, db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        return HTMLResponse(content="Contract niet gevonden", status_code=404)
    return templates.TemplateResponse("contracts/form.html", {"request": request, "contract": contract})


@app.post("/contracts", response_class=HTMLResponse)
def create_contract(request: Request, contract_number: str = Form(...), customer_name: str = Form(...), kostenplaats: Optional[str] = Form(None), description: Optional[str] = Form(None), start_date: date = Form(...), end_date: Optional[date] = Form(None), contract_value: Optional[float] = Form(None), status: str = Form("draft"), notes: Optional[str] = Form(None), db: Session = Depends(get_db)):
    contract = Contract(contract_number=contract_number, customer_name=customer_name, kostenplaats=kostenplaats, description=description, start_date=start_date, end_date=end_date, contract_value=contract_value, status=status, notes=notes)
    db.add(contract)
    db.commit()
    db.refresh(contract)
    response = templates.TemplateResponse("contracts/row.html", {"request": request, "contract": contract})
    response.headers["HX-Trigger"] = "closeModal"
    return response


@app.put("/contracts/{contract_id}", response_class=HTMLResponse)
def update_contract(contract_id: int, request: Request, contract_number: str = Form(...), customer_name: str = Form(...), kostenplaats: Optional[str] = Form(None), description: Optional[str] = Form(None), start_date: date = Form(...), end_date: Optional[date] = Form(None), contract_value: Optional[float] = Form(None), status: str = Form("draft"), notes: Optional[str] = Form(None), db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        return HTMLResponse(content="Contract niet gevonden", status_code=404)
    contract.contract_number = contract_number
    contract.customer_name = customer_name
    contract.kostenplaats = kostenplaats
    contract.description = description
    contract.start_date = start_date
    contract.end_date = end_date
    contract.contract_value = contract_value
    contract.status = status
    contract.notes = notes
    db.commit()
    db.refresh(contract)
    response = templates.TemplateResponse("contracts/row.html", {"request": request, "contract": contract})
    response.headers["HX-Trigger"] = "closeModal"
    return response


@app.delete("/contracts/{contract_id}")
def delete_contract(contract_id: int, db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if contract:
        db.delete(contract)
        db.commit()
    return Response(status_code=200)
