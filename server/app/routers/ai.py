"""智能分诊（AI 增强 + 降级）。接口固定 JSON，超时/异常一律返回兜底结果。"""
import os

import httpx
from fastapi import APIRouter, Depends

from ..catalog import DISCLAIMER, TRIAGE_RULES
from ..models import User
from ..schemas import TriageIn
from ..security import get_current_user

router = APIRouter(prefix="/api", tags=["ai"])

AI_ENDPOINT = os.getenv("AI_ENDPOINT", "")
AI_KEY = os.getenv("AI_KEY", "")
AI_TIMEOUT = float(os.getenv("AI_TIMEOUT", "10"))


def local_triage(text: str) -> dict:
    for rule in TRIAGE_RULES:
        if any(k in text for k in rule["keys"]):
            return {"dept": rule["dept"], "urgency": rule["urgency"], "notes": rule["notes"]}
    return {"dept": "全科门诊", "urgency": "普通",
            "notes": "症状描述不足以判断专科，建议先到全科门诊或分诊台评估。"}


def fallback(why: str = "") -> dict:
    return {"dept": "全科门诊", "urgency": "普通",
            "notes": "AI 服务暂不可用，已按兜底规则推荐全科门诊；" + why,
            "disclaimer": DISCLAIMER, "source": "fallback"}


@router.post("/triage")
async def triage(payload: TriageIn, user: User = Depends(get_current_user)):
    text = (payload.symptoms or "").strip()
    if not text:
        return fallback("未提供症状描述。")

    if AI_ENDPOINT:
        try:
            async with httpx.AsyncClient(timeout=AI_TIMEOUT) as client:
                resp = await client.post(
                    AI_ENDPOINT,
                    json={"symptoms": text,
                          "depts": ["内科", "外科", "儿科", "妇产科", "骨科", "心血管内科", "神经内科", "皮肤科"]},
                    headers={"Authorization": f"Bearer {AI_KEY}"},
                )
                resp.raise_for_status()
                data = resp.json()
            urgency = data.get("urgency") if data.get("urgency") in ("普通", "尽快", "急诊") else "普通"
            return {"dept": data.get("dept") or "全科门诊", "urgency": urgency,
                    "notes": data.get("notes") or "请到分诊台进一步评估。",
                    "disclaimer": DISCLAIMER, "source": "llm"}
        except (httpx.HTTPError, ValueError, KeyError):
            return fallback("（接口超时或异常）")

    result = local_triage(text)
    result.update({"disclaimer": DISCLAIMER, "source": "local-rule"})
    return result
