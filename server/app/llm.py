"""大模型客户端（OpenAI 兼容 /chat/completions）。

适配 DeepSeek、通义千问（DashScope 兼容模式）、Kimi、智谱、vLLM、Ollama 等
一切提供 OpenAI 兼容接口的服务；密钥只从环境变量读取，不落库、不进日志。

环境变量：
    AI_BASE_URL   形如 https://api.deepseek.com/v1（不含 /chat/completions）
    AI_KEY        API Key
    AI_MODEL      模型名，默认 deepseek-chat
    AI_TIMEOUT    单次请求超时秒数，默认 20
    AI_MAX_TOKENS 单次生成上限，默认 600
    AI_FAIL_THRESHOLD / AI_COOLDOWN_SECONDS  连续失败多少次后暂停调用多少秒

任何异常都返回 None，由调用方降级到本地规则——AI 不可用不能影响门诊业务。
"""
import json
import logging
import os
import re
import threading
import time

import httpx

log = logging.getLogger("his.llm")

BASE_URL = (os.getenv("AI_BASE_URL") or "").strip().rstrip("/")
API_KEY = (os.getenv("AI_KEY") or "").strip()
MODEL = (os.getenv("AI_MODEL") or "deepseek-chat").strip()
TIMEOUT = float(os.getenv("AI_TIMEOUT", "20"))
MAX_TOKENS = int(os.getenv("AI_MAX_TOKENS", "600"))
TEMPERATURE = float(os.getenv("AI_TEMPERATURE", "0.2"))
FAIL_THRESHOLD = int(os.getenv("AI_FAIL_THRESHOLD", "3"))
COOLDOWN = int(os.getenv("AI_COOLDOWN_SECONDS", "60"))

_lock = threading.Lock()
_state = {"fails": 0, "open_until": 0.0, "last_error": ""}


def enabled() -> bool:
    return bool(BASE_URL and API_KEY)


def status() -> dict:
    """给前端展示的接入状态，不包含密钥。"""
    with _lock:
        cooling = _state["open_until"] > time.monotonic()
        return {
            "enabled": enabled(),
            "model": MODEL if enabled() else "",
            "host": re.sub(r"^https?://", "", BASE_URL).split("/")[0] if BASE_URL else "",
            "coolingDown": cooling,
            "lastError": _state["last_error"] if not enabled() else ("" if not cooling else _state["last_error"]),
        }


def _cooling() -> bool:
    with _lock:
        return _state["open_until"] > time.monotonic()


def _on_success() -> None:
    with _lock:
        _state["fails"] = 0
        _state["open_until"] = 0.0
        _state["last_error"] = ""


def _on_failure(err: str) -> None:
    with _lock:
        _state["fails"] += 1
        _state["last_error"] = err[:200]
        if _state["fails"] >= FAIL_THRESHOLD:
            _state["open_until"] = time.monotonic() + COOLDOWN
            log.warning("大模型连续失败 %s 次，暂停调用 %s 秒：%s", _state["fails"], COOLDOWN, err[:120])


def reset_state() -> None:      # 测试用
    with _lock:
        _state.update({"fails": 0, "open_until": 0.0, "last_error": ""})


def _strip_fence(text: str) -> str:
    """去掉 ```json ... ``` 包裹，容忍模型多写的说明文字。"""
    text = (text or "").strip()
    fence = re.search(r"```(?:json)?\s*(.+?)```", text, re.S)
    if fence:
        text = fence.group(1).strip()
    if not text.startswith("{"):
        brace = re.search(r"\{.*\}", text, re.S)
        if brace:
            text = brace.group(0)
    return text


async def _post(messages: list[dict], *, max_tokens: int, json_mode: bool) -> str | None:
    body = {
        "model": MODEL,
        "messages": messages,
        "temperature": TEMPERATURE,
        "max_tokens": max_tokens,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
    url = f"{BASE_URL}/chat/completions"

    for attempt in (1, 2):
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                resp = await client.post(url, json=body, headers=headers)
            if resp.status_code in (400, 404, 422) and json_mode and attempt == 1:
                # 部分服务不支持 response_format，去掉再试一次
                body.pop("response_format", None)
                json_mode = False
                continue
            if resp.status_code == 401:
                _on_failure("鉴权失败（401），请检查 AI_KEY")
                return None
            if resp.status_code == 429:
                _on_failure("被限流（429）")
                return None
            resp.raise_for_status()
            data = resp.json()
            content = (data.get("choices") or [{}])[0].get("message", {}).get("content") or ""
            if not content.strip():
                _on_failure("返回内容为空")
                return None
            _on_success()
            return content
        except httpx.TimeoutException:
            if attempt == 1:
                continue
            _on_failure("请求超时")
            return None
        except Exception as exc:                     # 网络/DNS/JSON 解析
            if attempt == 1:
                continue
            _on_failure(f"{type(exc).__name__}: {exc}")
            return None
    return None


async def chat_text(system: str, user: str, *, max_tokens: int | None = None) -> str | None:
    if not enabled() or _cooling():
        return None
    out = await _post([{"role": "system", "content": system},
                       {"role": "user", "content": user}],
                      max_tokens=max_tokens or MAX_TOKENS, json_mode=False)
    return out.strip() if out else None


async def chat_json(system: str, user: str, *, max_tokens: int | None = None) -> dict | None:
    if not enabled() or _cooling():
        return None
    out = await _post([{"role": "system", "content": system},
                       {"role": "user", "content": user}],
                      max_tokens=max_tokens or MAX_TOKENS, json_mode=True)
    if not out:
        return None
    try:
        data = json.loads(_strip_fence(out))
        return data if isinstance(data, dict) else None
    except (ValueError, TypeError):
        _on_failure("返回内容不是合法 JSON")
        return None
