"""
╔══════════════════════════════════════════════════════════════════╗
║         FEHM.AI  —  COGNITIVE ROUTER  v6.0                      ║
║         Enterprise Shield + Circuit Breaker + Semantic Memory    ║
╚══════════════════════════════════════════════════════════════════╝

Files:
  ai_core.py   ← YOU ARE HERE  (Router, Circuit Breaker, Utilities)
  tasks.py     ← Celery Worker  (Pipeline, Dreaming Phase, Memory)
"""

import os
import json
import httpx
import re
import time
import asyncio
import redis
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

# ═══════════════════════════════════════════════════════════════════
# 1.  REDIS — single shared connection
# ═══════════════════════════════════════════════════════════════════
r = redis.Redis(host="localhost", port=6379, db=0, decode_responses=True)


# ═══════════════════════════════════════════════════════════════════
# 2.  CREDENTIALS
# ═══════════════════════════════════════════════════════════════════
GROQ_API_KEY  = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"


# ═══════════════════════════════════════════════════════════════════
# 3.  CIRCUIT BREAKER CONSTANTS
#     Each model has a Redis key:  cb:{MODEL_ID}
#     Value = "open" means the breaker is TRIPPED (route around it).
#     After COOLDOWN seconds the key expires → breaker resets.
# ═══════════════════════════════════════════════════════════════════
CB_FAILURE_THRESHOLD = 3          # failures before breaker trips
CB_COOLDOWN_SECONDS  = 60         # how long to stay tripped
CB_FAILURE_WINDOW    = 30         # seconds to count failures in

MODEL_CONFIGS = [
    {
        "id":       "GEMINI_FLASH",
        "label":    "Gemini 2.5 Flash",
        "tier":     1,
        "enabled":  bool(GEMINI_API_KEY),
    },
    {
        "id":       "GROQ_70B",
        "label":    "Groq Llama 3.3 70B",
        "tier":     2,
        "enabled":  bool(GROQ_API_KEY),
    },
    {
        "id":       "GROQ_8B",
        "label":    "Groq Llama 3.1 8B",
        "tier":     3,
        "enabled":  bool(GROQ_API_KEY),
    },
]


# ═══════════════════════════════════════════════════════════════════
# 4.  CIRCUIT BREAKER HELPERS
# ═══════════════════════════════════════════════════════════════════
def _cb_key(model_id: str) -> str:
    return f"cb:state:{model_id}"

def _cb_fail_key(model_id: str) -> str:
    return f"cb:failures:{model_id}"

def is_circuit_open(model_id: str) -> bool:
    """Returns True if the breaker is tripped — do NOT send traffic here."""
    return r.get(_cb_key(model_id)) == "open"

def record_failure(model_id: str):
    """Increment failure counter. Trip the breaker if threshold is hit."""
    fail_key = _cb_fail_key(model_id)
    pipe = r.pipeline()
    pipe.incr(fail_key)
    pipe.expire(fail_key, CB_FAILURE_WINDOW)
    results = pipe.execute()
    failure_count = results[0]

    if failure_count >= CB_FAILURE_THRESHOLD:
        r.setex(_cb_key(model_id), CB_COOLDOWN_SECONDS, "open")
        print(f"[Circuit Breaker] ⚡ TRIPPED for {model_id}. "
              f"Cooling down {CB_COOLDOWN_SECONDS}s.")

def record_success(model_id: str):
    """A successful call resets the failure counter."""
    r.delete(_cb_fail_key(model_id))

def get_model_health() -> dict:
    """Returns a health snapshot of every model for monitoring/UI."""
    health = {}
    for cfg in MODEL_CONFIGS:
        mid = cfg["id"]
        if is_circuit_open(mid):
            ttl = r.ttl(_cb_key(mid))
            health[mid] = {"status": "DEGRADED", "reset_in": ttl}
        else:
            fails = int(r.get(_cb_fail_key(mid)) or 0)
            health[mid] = {
                "status":   "HEALTHY",
                "failures": fails,
                "threshold": CB_FAILURE_THRESHOLD,
            }
    return health

# ═══════════════════════════════════════════════════════════════════
# 5.  ISOLATED USER-LEVEL RATE LIMITER (GPT-STYLE)
# ═══════════════════════════════════════════════════════════════════
def check_rate_limit(user_id: str, limit: int = 50) -> tuple[bool, int]:
    """
    Every user gets their own unique key in Redis.
    Limits are isolated. Reset happens every 3 hours.
    """
    # 1. Create a unique key for THIS specific user
    key = f"user_limit:{user_id}"
    current = r.get(key)

    # 2. Check if they hit THEIR personal limit
    if current and int(current) >= limit:
        ttl = r.ttl(key)
        return False, max(ttl, 0)

    # 3. If not limited, increment THEIR counter
    pipe = r.pipeline()
    pipe.incr(key)
    
    # 4. Set reset window to 3 hours (10800 seconds) 
    # instead of 24 hours (86400)
    if not current:
        pipe.expire(key, 10800) 
        
    pipe.execute()
    return True, 0


# ═══════════════════════════════════════════════════════════════════
# 6.  UTILITIES
# ═══════════════════════════════════════════════════════════════════
def clean_json(raw_text: str) -> str:
    """Strip markdown fences, extract the first {...} block."""
    text = raw_text.strip()
    text = re.sub(r'^```json\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'\s*```$',     '', text, flags=re.MULTILINE)

    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        return match.group(0)

    # Graceful fallback — never let a parse error crash the pipeline
    return json.dumps({
        "hidden_thought":       "System Note: Model bypassed JSON enforcement.",
        "reply":                text,
        "empathetic_validation": "",
        "ui_payload":           {},
    })

def _professional_limit_message(reset_in: int) -> str:
    """Human-readable rate-limit message shown to students."""
    minutes = reset_in // 60
    seconds = reset_in % 60
    if minutes > 0:
        time_str = f"{minutes}m {seconds}s"
    else:
        time_str = f"{seconds}s"
    return (
        f"You've reached your cognitive session limit. "
        f"Your pathways will reset in **{time_str}**. "
        f"Use this time to review what you've learned — "
        f"consolidation is where real mastery happens."
    )

def _cognitive_buffer_message(model_label: str, cooldown: int) -> str:
    """Human-readable model-degraded message."""
    return (
        f"I'm recalibrating my neural pathways to better assist you. "
        f"Please give me ~{cooldown}s to sync my cognitive nodes. "
        f"({model_label} is temporarily resting — routing to backup.)"
    )


# ═══════════════════════════════════════════════════════════════════
# 7.  MODEL-SPECIFIC CALLERS
# ═══════════════════════════════════════════════════════════════════
def _messages_to_gemini_payload(messages: list, temperature: float) -> dict:
    """Convert OpenAI-style messages to Gemini's content format."""
    system_instruction = None
    contents = []

    for msg in messages:
        role    = msg["role"]
        content = msg["content"]

        if role == "system":
            # Accumulate all system messages into one instruction
            system_instruction = (system_instruction or "") + "\n" + content
            continue

        gemini_role = "user" if role == "user" else "model"
        parts = []

        if isinstance(content, str):
            parts.append({"text": content})
        elif isinstance(content, list):
            for item in content:
                if item["type"] == "text":
                    parts.append({"text": item["text"]})
                elif item["type"] == "image_url":
                    url = item["image_url"]["url"]
                    if url.startswith("data:image"):
                        mime, b64 = url.split(";base64,")
                        parts.append({
                            "inline_data": {
                                "mime_type": mime.split(":")[1],
                                "data":      b64,
                            }
                        })

        contents.append({"role": gemini_role, "parts": parts})

    payload: dict = {
        "contents": contents,
        "generationConfig": {
            "temperature":    temperature,
            "responseMimeType": "application/json",
        },
    }
    if system_instruction:
        payload["systemInstruction"] = {
            "parts": [{"text": system_instruction.strip()}]
        }
    return payload


async def _call_gemini(messages: list, temperature: float) -> str:
    model_id = "GEMINI_FLASH"
    if not GEMINI_API_KEY:
        raise ValueError("No Gemini API key.")
    if is_circuit_open(model_id):
        ttl = r.ttl(_cb_key(model_id))
        raise RuntimeError(f"Circuit open for {model_id}. Reset in {ttl}s.")

    payload = _messages_to_gemini_payload(messages, temperature)
    async with httpx.AsyncClient(verify=False, timeout=60.0) as client:
        resp = await client.post(
            f"{GEMINI_URL}?key={GEMINI_API_KEY}", json=payload
        )

    if resp.status_code == 200:
        record_success(model_id)
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"]

    # Rate-limit or server error → record failure
    record_failure(model_id)
    raise RuntimeError(f"Gemini HTTP {resp.status_code}: {resp.text[:120]}")


async def _call_groq(messages: list, temperature: float, model_id: str,
                     groq_model_name: str) -> str:
    if not GROQ_API_KEY:
        raise ValueError("No Groq API key.")
    if is_circuit_open(model_id):
        ttl = r.ttl(_cb_key(model_id))
        raise RuntimeError(f"Circuit open for {model_id}. Reset in {ttl}s.")

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type":  "application/json",
    }
    payload = {
        "messages":    messages,
        "model":       groq_model_name,
        "temperature": temperature,
    }

    async with httpx.AsyncClient(verify=False, timeout=60.0) as client:
        resp = await client.post(GROQ_URL, headers=headers, json=payload)

    if resp.status_code == 200:
        record_success(model_id)
        return resp.json()["choices"][0]["message"]["content"]

    record_failure(model_id)
    raise RuntimeError(f"Groq {model_id} HTTP {resp.status_code}: {resp.text[:120]}")


# ═══════════════════════════════════════════════════════════════════
# 8.  THE COGNITIVE ROUTER  ← the main entry point
# ═══════════════════════════════════════════════════════════════════
class CognitiveRouter:
    """
    Stateless, async, enterprise-grade AI router.

    Usage:
        router   = CognitiveRouter()
        response = await router.route(messages, user_id="student_42")

    Returns a dict:
        {
          "content":    str,          # the model's text reply
          "model_used": str,          # which model actually answered
          "tier":       int,          # 1/2/3
          "limited":    bool,         # True if user hit rate limit
          "limit_message": str | None # human-readable limit note
        }
    """

    async def route(
        self,
        messages:    list,
        user_id:     str  = "anonymous",
        temperature: float = 0.4,
        bypass_rate_limit: bool = False,
    ) -> dict:

        # ── Rate-limit check ──────────────────────────────────────
        if not bypass_rate_limit:
            allowed, reset_in = check_rate_limit(user_id)
            if not allowed:
                return {
                    "content":       _professional_limit_message(reset_in),
                    "model_used":    "NONE",
                    "tier":          0,
                    "limited":       True,
                    "limit_message": _professional_limit_message(reset_in),
                }

        # ── Tier cascade ──────────────────────────────────────────
        attempts = [
            ("GEMINI_FLASH", "Gemini 2.5 Flash",   1,
             lambda m, t: _call_gemini(m, t)),
            ("GROQ_70B",     "Groq Llama 3.3 70B", 2,
             lambda m, t: _call_groq(m, t, "GROQ_70B", "llama-3.3-70b-versatile")),
            ("GROQ_8B",      "Groq Llama 3.1 8B",  3,
             lambda m, t: _call_groq(m, t, "GROQ_8B",  "llama-3.1-8b-instant")),
        ]

        last_error = None
        for model_id, label, tier, caller in attempts:
            try:
                print(f"[CognitiveRouter] → Attempting {label} (Tier {tier})...")
                content = await caller(messages, temperature)
                print(f"[CognitiveRouter] ✅ {label} responded.")
                return {
                    "content":       content,
                    "model_used":    model_id,
                    "tier":          tier,
                    "limited":       False,
                    "limit_message": None,
                }
            except Exception as e:
                last_error = e
                print(f"[CognitiveRouter] ⚠️  {label} failed: {e}")
                # Short pause before next tier to avoid thundering-herd
                await asyncio.sleep(0.3)

        # ── All tiers exhausted ───────────────────────────────────
        raise RuntimeError(
            f"CRITICAL: All cognitive nodes offline. Last error: {last_error}"
        )


# Module-level singleton — import this everywhere
cognitive_router = CognitiveRouter()


# ═══════════════════════════════════════════════════════════════════
# 9.  LEGACY SHIM  (keeps tasks.py backward compatible)
# ═══════════════════════════════════════════════════════════════════
async def call_ai_direct(messages: list, model: str = "auto",
                         temperature: float = 0.4) -> str:
    """
    Thin wrapper around CognitiveRouter for backward compatibility.
    Returns raw text content (raises on total failure).
    """
    result = await cognitive_router.route(
        messages, user_id="internal_pipeline", temperature=temperature,
        bypass_rate_limit=True          # internal agent calls are not rate-limited
    )
    return result["content"]