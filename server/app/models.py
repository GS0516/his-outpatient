"""ORM 模型：门诊医生工作站（第三章）相关实体。"""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from .db import Base


def now():
    return datetime.now()


class User(Base):
    __tablename__ = "users"
    id = Column(String(32), primary_key=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(64), nullable=False)
    role = Column(String(16), nullable=False)          # doctor / admin
    dept = Column(String(64), default="")
    title = Column(String(64), default="")
    password_hash = Column(String(255), nullable=False)
    active = Column(Boolean, default=True)


class Patient(Base):
    __tablename__ = "patients"
    id = Column(String(32), primary_key=True)
    mrn = Column(String(32), index=True)
    card = Column(String(32), index=True)
    name = Column(String(64), nullable=False)
    sex = Column(String(8), default="")
    age = Column(Integer, default=0)
    phone = Column(String(32), default="")
    id_masked = Column(String(32), default="")          # 430102********1234
    id_tail = Column(String(4), default="")
    ins = Column(String(32), default="自费")
    allergy = Column(String(64), default="")
    status = Column(String(16), default="待诊", index=True)
    dept = Column(String(64), default="")
    doctor = Column(String(64), default="")
    complaint = Column(Text, default="")
    present = Column(Text, default="")
    past = Column(Text, default="")
    exam = Column(Text, default="")
    temp = Column(Float, nullable=True)
    pulse = Column(Integer, nullable=True)
    bp = Column(String(32), default="")


class Drug(Base):
    __tablename__ = "drugs"
    code = Column(String(16), primary_key=True)
    generic = Column(String(64), nullable=False, index=True)
    trade = Column(String(64), default="")
    spec = Column(String(64), nullable=False)
    form = Column(String(32), default="")
    unit = Column(String(16), default="盒")
    price = Column(Float, nullable=False)
    cost = Column(Float, default=0)
    ins = Column(String(8), default="自费")             # 甲/乙/自费
    stock = Column(Integer, default=0)
    low = Column(Integer, default=0)
    batch = Column(String(32), default="")
    expiry = Column(String(16), default="")
    allergen = Column(String(32), default="")
    max_dose = Column(Float, default=0)
    dose_unit = Column(String(16), default="")
    usage = Column(String(128), default="")
    indication = Column(Text, default="")
    contra = Column(Text, default="")


class Treatment(Base):
    __tablename__ = "treatments"
    code = Column(String(16), primary_key=True)
    name = Column(String(64), nullable=False)
    unit = Column(String(16), default="次")
    price = Column(Float, nullable=False)
    ins = Column(String(8), default="甲")


class Material(Base):
    __tablename__ = "materials"
    code = Column(String(16), primary_key=True)
    name = Column(String(64), nullable=False)
    spec = Column(String(64), default="")
    unit = Column(String(16), default="个")
    price = Column(Float, nullable=False)
    ins = Column(String(8), default="甲")


class Visit(Base):
    __tablename__ = "visits"
    id = Column(String(32), primary_key=True)
    patient_id = Column(String(32), ForeignKey("patients.id"), index=True)
    patient_name = Column(String(64), default="")
    date = Column(String(16), index=True)
    time = Column(String(32))
    dept = Column(String(64), default="")
    doctor = Column(String(64), default="")
    complaint = Column(Text, default="")
    present = Column(Text, default="")
    past = Column(Text, default="")
    exam = Column(Text, default="")
    note = Column(Text, default="")
    diagnosis = Column(Text, default="")
    diags = Column(JSON, default=list)
    total = Column(Float, default=0)
    status = Column(String(16), default="已提交")


class Prescription(Base):
    __tablename__ = "prescriptions"
    id = Column(String(32), primary_key=True)
    visit_id = Column(String(32), ForeignKey("visits.id"), index=True)
    patient_id = Column(String(32), index=True)
    patient_name = Column(String(64), default="")
    doctor = Column(String(64), default="")
    diagnosis = Column(Text, default="")
    total = Column(Float, default=0)
    status = Column(String(16), default="待收费")       # 待收费 / 已作废
    void_reason = Column(Text, default="")
    void_by = Column(String(64), default="")
    void_at = Column(String(32), default="")
    created_at = Column(String(32), default="")
    items = relationship("RxItem", backref="prescription", cascade="all, delete-orphan", lazy="selectin")


class RxItem(Base):
    __tablename__ = "rx_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    prescription_id = Column(String(32), ForeignKey("prescriptions.id"), index=True)
    code = Column(String(16))
    name = Column(String(64))
    spec = Column(String(64), default="")
    qty = Column(Integer, default=1)
    price = Column(Float, default=0)
    amount = Column(Float, default=0)
    usage = Column(String(128), default="")


class LabOrder(Base):
    __tablename__ = "lab_orders"
    id = Column(String(32), primary_key=True)
    patient_id = Column(String(32), index=True)
    visit_id = Column(String(32), index=True)
    items = Column(JSON, default=list)
    specimen = Column(String(16), default="全血")
    status = Column(String(16), default="待采样")
    results = Column(JSON, default=list)
    created_at = Column(String(32), default="")


class Exam(Base):
    __tablename__ = "exams"
    id = Column(String(32), primary_key=True)
    patient_id = Column(String(32), index=True)
    visit_id = Column(String(32), index=True)
    item = Column(String(64))
    part = Column(String(64))
    status = Column(String(16), default="待检查")
    report = Column(Text, default="")
    conclusion = Column(Text, default="")
    created_at = Column(String(32), default="")


class Template(Base):
    __tablename__ = "templates"
    id = Column(String(32), primary_key=True)
    name = Column(String(64), nullable=False)
    owner = Column(String(64), default="")
    dept = Column(String(64), default="")
    items = Column(JSON, default=list)
    note = Column(Text, default="")
    created_at = Column(String(32), default="")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(32), default="")
    username = Column(String(64), default="", index=True)
    name = Column(String(64), default="")
    role = Column(String(16), default="", index=True)
    action = Column(String(64), default="", index=True)
    object_type = Column(String(32), default="")
    object_id = Column(String(64), default="")
    detail = Column(Text, default="")
    ip = Column(String(64), default="")
    created_at = Column(DateTime, default=now, index=True)
