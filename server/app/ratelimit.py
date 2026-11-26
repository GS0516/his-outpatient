"""登录失败计数与临时锁定（进程内实现）。

单实例部署够用；多副本/多进程请把 `_fails` / `_locked` 换成 Redis 计数，
接口保持不变即可。锁定键为 `username|ip`：攻击者最多只能锁掉自己这一条来源，
不会形成"用别人用户名把自己也锁死"的跨用户拒绝服务。
"""
import os
import threading
import time

MAX_FAILS = int(os.getenv("LOGIN_MAX_FAILS", "5"))
LOCK_SECONDS = int(os.getenv("LOGIN_LOCK_SECONDS", "900"))
WINDOW_SECONDS = int(os.getenv("LOGIN_WINDOW_SECONDS", "900"))

_lock = threading.Lock()
_fails: dict[str, list[float]] = {}
_locked: dict[str, float] = {}
_hits: dict[str, list[float]] = {}


def make_key(username: str, ip: str) -> str:
    return f"{(username or '').strip().lower()}|{ip or '-'}"


def _prune(items: list[float], now: float) -> list[float]:
    return [t for t in items if now - t < WINDOW_SECONDS]


def locked_seconds(key: str) -> int:
    """剩余锁定秒数；0 表示未锁定。"""
    now = time.monotonic()
    with _lock:
        until = _locked.get(key, 0.0)
        if until <= now:
            _locked.pop(key, None)
            return 0
        return int(until - now) + 1


def register_failure(key: str) -> int:
    """记一次失败；返回锁定时长（秒），0 表示尚未锁定。"""
    now = time.monotonic()
    with _lock:
        hits = _prune(_fails.get(key, []), now)
        hits.append(now)
        if len(hits) >= MAX_FAILS:
            _locked[key] = now + LOCK_SECONDS
            _fails[key] = []
            return LOCK_SECONDS
        _fails[key] = hits
        return 0


def reset(key: str) -> None:
    with _lock:
        _fails.pop(key, None)
        _locked.pop(key, None)


def hit(key: str, limit: int, window: int) -> bool:
    """通用滑动窗口限流：True 放行，False 超限。

    用于大模型接口这类有成本的调用，避免单个账号把额度刷光。
    """
    now = time.monotonic()
    with _lock:
        stamps = [t for t in _hits.get(key, []) if now - t < window]
        if len(stamps) >= limit:
            _hits[key] = stamps
            return False
        stamps.append(now)
        _hits[key] = stamps
        return True


def clear_all() -> None:  # 测试用
    with _lock:
        _fails.clear()
        _locked.clear()
        _hits.clear()
