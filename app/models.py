from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Date, DateTime
from app.database import Base


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    contract_number = Column(String, unique=True, nullable=False)
    customer_name = Column(String, nullable=False)
    kostenplaats = Column(String, nullable=True)
    description = Column(String, nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    contract_value = Column(Float, nullable=True)
    status = Column(String, default="draft", nullable=False)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
