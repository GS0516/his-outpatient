"""请求模型（camelCase 与前端一致）。

所有进入业务层的数值都在这里收敛边界：数量、天数、文本长度、口令长度。
越界一律 422，不进入划价与落库逻辑。
"""
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


class LoginIn(ApiModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class ItemIn(ApiModel):
    kind: str = Field(default="drug", max_length=16)     # drug / treat / material
    code: str = Field(min_length=1, max_length=16)
    qty: int = Field(default=1, ge=1, le=999)            # 上限 999，防金额溢出
    usage: str | None = Field(default=None, max_length=128)
    freq: str | None = Field(default=None, max_length=8)
    dose_per: float | None = Field(default=None, ge=0, le=100000)
    days: int = Field(default=3, ge=1, le=90)


class ExamIn(ApiModel):
    item: str = Field(min_length=1, max_length=64)
    part: str = Field(default="—", max_length=64)


class VisitIn(ApiModel):
    patient_id: str = Field(min_length=1, max_length=32)
    complaint: str = Field(default="", max_length=2000)
    present: str = Field(default="", max_length=4000)
    past: str = Field(default="", max_length=4000)
    exam: str = Field(default="", max_length=4000)
    note: str = Field(default="", max_length=2000)
    diagnoses: list[str] = Field(default_factory=list, max_length=20)
    items: list[ItemIn] = Field(default_factory=list, max_length=50)
    treatments: list[ItemIn] = Field(default_factory=list, max_length=50)
    materials: list[ItemIn] = Field(default_factory=list, max_length=50)
    labs: list[str] = Field(default_factory=list, max_length=30)
    exams: list[ExamIn] = Field(default_factory=list, max_length=30)


class VoidIn(ApiModel):
    reason: str = Field(default="", max_length=200)


class TemplateIn(ApiModel):
    name: str = Field(min_length=1, max_length=64)
    items: list[ItemIn] = Field(default_factory=list, max_length=50)
    note: str = Field(default="", max_length=200)


class TriageIn(ApiModel):
    symptoms: str = Field(default="", max_length=1000)


class AssistantIn(ApiModel):
    patient_id: str | None = Field(default=None, max_length=32)
    question: str = Field(default="", max_length=500)
