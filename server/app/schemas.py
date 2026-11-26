"""请求模型（camelCase 与前端一致）。"""
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


class LoginIn(ApiModel):
    username: str
    password: str


class ItemIn(ApiModel):
    kind: str = "drug"                  # drug / treat / material
    code: str
    qty: int = 1
    usage: str | None = None
    freq: str | None = None
    dose_per: float | None = None
    days: int = 3


class ExamIn(ApiModel):
    item: str
    part: str = "—"


class VisitIn(ApiModel):
    patient_id: str
    complaint: str = ""
    present: str = ""
    past: str = ""
    exam: str = ""
    note: str = ""
    diagnoses: list[str] = Field(default_factory=list)
    items: list[ItemIn] = Field(default_factory=list)
    treatments: list[ItemIn] = Field(default_factory=list)
    materials: list[ItemIn] = Field(default_factory=list)
    labs: list[str] = Field(default_factory=list)
    exams: list[ExamIn] = Field(default_factory=list)


class VoidIn(ApiModel):
    reason: str = ""


class TemplateIn(ApiModel):
    name: str
    items: list[ItemIn] = Field(default_factory=list)
    note: str = ""


class TriageIn(ApiModel):
    symptoms: str = ""
