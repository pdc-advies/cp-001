from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class ContractCreate(BaseModel):
    contract_number: str
    customer_name: str
    kostenplaats: Optional[str] = None
    description: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    contract_value: Optional[float] = None
    status: str = "draft"
    notes: Optional[str] = None


class ContractUpdate(BaseModel):
    contract_number: Optional[str] = None
    customer_name: Optional[str] = None
    kostenplaats: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    contract_value: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ContractRead(ContractCreate):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
