"""
╔══════════════════════════════════════════════════════════════════╗
║         FEHM.AI  —  CELERY WORKER  v7.0                         ║
║         Full Layer 4 Integration                                 ║
╚══════════════════════════════════════════════════════════════════╝

What changed from v6.0:
  + Critic fires after every Teacher response (background)
  + Evolved directive injected into Teacher prompt (Self-Correction)
  + Librarian hint injected when state == STUCK
  + Librarian task triggered on STUCK state
"""

import asyncio
import json
import os
from dotenv import load_dotenv

load_dotenv()
import certifi
import redis as redis_lib
from celery import Celery
from pymongo import MongoClient

from ai_core import call_ai_direct, clean_json, check_rate_limit
from agents import (
    fetch_evolved_directive,
    critic_task,
    librarian_task,
)

# ═══════════════════════════════════════════════════════════════════
# 1.  INFRASTRUCTURE
# ═══════════════════════════════════════════════════════════════════
celery_app = Celery(
    "ai_tasks",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/1",
)

MONGO_URI = os.getenv("MONGO_URI")

r = redis_lib.Redis(host="localhost", port=6379, db=0, decode_responses=True)

try:
    cluster      = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
    db           = cluster["tuition_center"]
    semantic_col = db["semantic_cores"]
    chat_log_col = db["chat_logs"]
    print("[Worker] ✅ Database Connected.\n")
except Exception as e:
    print(f"[Worker Error] MongoDB Failed: {e}")
    semantic_col = chat_log_col = None


# ═══════════════════════════════════════════════════════════════════
# 2.  PERSONALITY ENGINE
# ═══════════════════════════════════════════════════════════════════
def compute_personality_mode(
    frustration_index: float,
    repetition_count:  int,
    accuracy_score:    float,
) -> dict:
    if frustration_index >= 0.65:
        return {
            "mode":       "EMPATHETIC",
            "tone_label": "Empathetic Support",
            "directive":  (
                "The student is frustrated. SOFTEN everything. "
                "Speak like a calm friend, not a professor. "
                "Reduce complexity by 50%. Celebrate tiny wins. "
                "Do NOT challenge them right now."
            ),
        }
    elif repetition_count >= 3:
        return {
            "mode":       "STRICT",
            "tone_label": "Strict Mentor",
            "directive":  (
                "The student is repeating the same question without trying. "
                "Be FIRM. Refuse to rephrase until they attempt an answer first. "
                "Say: 'I know you can figure this out. What's your first instinct?' "
                "Do not soften. They need friction, not comfort."
            ),
        }
    elif accuracy_score >= 0.75:
        return {
            "mode":       "PEER",
            "tone_label": "Intellectual Peer",
            "directive":  (
                "The student is performing well. Treat them as a PEER. "
                "Use technical vocabulary freely. Challenge with edge cases. "
                "Be intellectually playful — debate, not lecture."
            ),
        }
    else:
        return {
            "mode":       "BALANCED",
            "tone_label": "Socratic Guide",
            "directive":  "Standard Socratic mode. Guide with questions. Stay curious.",
        }


def _count_repetitions(history_list: list, user_input: str) -> int:
    count = 0
    words = set(user_input.lower().split())
    for msg in history_list:
        if msg.startswith("Student:"):
            overlap = len(words & set(msg.lower().split())) / max(len(words), 1)
            if overlap > 0.7:
                count += 1
    return count


# ═══════════════════════════════════════════════════════════════════
# 3.  MEMORY HELPERS
# ═══════════════════════════════════════════════════════════════════

def fetch_semantic_core(student_name: str) -> dict | None:
    if semantic_col is None:
        return None
    doc = semantic_col.find_one({"student_name": student_name})
    return doc.get("semantic_core") if doc else None

def upsert_semantic_core(student_name: str, new_core: dict):
    if semantic_col is None:
        return None
    semantic_col.update_one(
        {"student_name": student_name},
        {"$set": {
            "semantic_core": new_core,
            "last_updated":  __import__("datetime").datetime.utcnow(),
        }},
        upsert=True,
    )


def fetch_librarian_hint(student_name: str) -> str:
    """
    Retrieve a cached Librarian recommendation from Redis.
    Returns empty string if none cached or confidence too low.
    Consumes the hint on read (one-time use per stuck event).
    """
    cached = r.get(f"librarian:{student_name}")
    if not cached:
        return ""
    try:
        data = json.loads(cached)
        if data.get("found_pattern") and data.get("confidence", 0) >= 0.6:
            analogy = data.get("recommended_analogy", "")
            if analogy:
                r.delete(f"librarian:{student_name}")
                return analogy
    except Exception:
        pass
    return ""


def append_raw_log(student_name: str, user_input: str, ai_reply: str):
    if chat_log_col is None:
        return
    
    chat_log_col.update_one(
        {"student_name": student_name},
        {"$push": {"exchanges": {
            "user": user_input,
            "ai":   ai_reply,
            "ts":   __import__("datetime").datetime.utcnow(),
        }}},
        upsert=True,
    )
    
    # This line below was the one crashing your system:
    doc = chat_log_col.find_one({"student_name": student_name}, {"exchanges": 1})
    count = len(doc.get("exchanges", [])) if doc else 0
    
    if count % 10 == 0:
        print(f"[Memory] 🌙 Triggering Dreaming Phase ({count} exchanges).")
        dreaming_phase.delay(student_name)

# ═══════════════════════════════════════════════════════════════════
# 4.  MAIN PIPELINE
# ═══════════════════════════════════════════════════════════════════
async def run_ai_pipeline(
    student_name:     str,
    user_input:       str,
    chat_history_str: str,
    user_id:          str = None,
) -> dict:

    user_id = user_id or student_name

    # ── Rate limit ────────────────────────────────────────────────
    allowed, reset_in = check_rate_limit(user_id)
    if not allowed:
        from ai_core import _professional_limit_message
        return {
            "sender":   "System",
            "limited":  True,
            "message":  _professional_limit_message(reset_in),
            "thought":  "Rate limit enforced.",
            "state":    "RATE_LIMITED",
            "reset_in": reset_in,
        }

    history_list = json.loads(chat_history_str)
    transcript   = "\n".join(history_list) + f"\nStudent: {user_input}"

    # ──────────────────────────────────────────────────────────────
    # PHASE 1: SUPERVISOR
    # ──────────────────────────────────────────────────────────────
    supervisor_prompt = """
FEHM.AI SUPERVISOR v6.0 — AFFECTIVE COMPUTING LAYER

Analyze the student's emotional and cognitive state.

frustration_index 0.0-1.0:
  0.0 = Calm, curious.  0.5 = Confused.  1.0 = Highly frustrated.

OUTPUT — STRICT JSON:
{
  "state": "NEW_TOPIC | LEARNING_FOUNDATION | LEARNING_READY_TO_ADVANCE | STUCK | MASTERY_SUSPECTED",
  "frustration_index": 0.0,
  "accuracy_score": 0.5,
  "detected_emotion": "String",
  "current_bottleneck": "Max 10 words",
  "note_to_teacher": "Psychological directive."
}
"""
    print(f"[Pipeline] 🧠 Phase 1: Profiling {student_name}...")
    try:
        sup_raw    = await call_ai_direct([
            {"role": "system", "content": supervisor_prompt},
            {"role": "user",   "content": f"Transcript:\n{transcript}"},
        ], temperature=0.1)
        supervisor = json.loads(clean_json(sup_raw))
    except Exception as e:
        print(f"[Pipeline Error] Supervisor failed: {e}")
        supervisor = {}

    state       = supervisor.get("state",             "LEARNING_FOUNDATION")
    frustration = float(supervisor.get("frustration_index", 0.3))
    accuracy    = float(supervisor.get("accuracy_score",    0.5))
    bottleneck  = supervisor.get("current_bottleneck", "General understanding")
    directive   = supervisor.get("note_to_teacher",   "")
    emotion     = supervisor.get("detected_emotion",  "neutral")

    # ──────────────────────────────────────────────────────────────
    # PHASE 2: PERSONALITY + MEMORY + LIBRARIAN + EVOLVED DIRECTIVE
    # ──────────────────────────────────────────────────────────────
    repetitions = _count_repetitions(history_list, user_input)
    personality = compute_personality_mode(frustration, repetitions, accuracy)
    print(f"[Pipeline] 🎭 Phase 2: Mode → {personality['tone_label']}")

    # Semantic Core (long-term memory)
    semantic_core    = fetch_semantic_core(student_name)
    student_modality = "mixed"
    if semantic_core:
        student_modality = semantic_core.get("optimal_modality", "mixed")
        memory_block = f"""
# CRITICAL USER CONTEXT (SEMANTIC MEMORY — NEOCORTEX)
{json.dumps(semantic_core, indent=2)}

RULES:
- AVOID topics in 'frustration_triggers'.
- Use analogies from 'successful_analogies' when stuck.
- Adapt to 'optimal_modality': {student_modality}.
- If session just started, open with 'next_session_opener'.
"""
    else:
        memory_block = "# NO PRIOR MEMORY. New student. Build profile from scratch."

    # Librarian hint — inject only when STUCK
    librarian_block = ""
    if state == "STUCK":
        librarian_hint = fetch_librarian_hint(student_name)
        if librarian_hint:
            librarian_block = f"""
# LIBRARIAN RECOMMENDATION (cross-student pattern match)
Other students who struggled with "{bottleneck}" broke through using:
"{librarian_hint}"
TRY THIS ANALOGY. Adapt it naturally to the current context.
"""
            print(f"[Pipeline] 📚 Librarian hint injected.")
        else:
            librarian_task.delay(student_name, bottleneck, student_modality)
            print(f"[Pipeline] 📚 Librarian search triggered (ready next turn).")

    # Evolved directive from Self-Correction loop
    evolved_directive = fetch_evolved_directive(student_name)
    evolved_block = f"""
# EVOLVED DIRECTIVE (auto-rewritten from past Critic reviews)
{evolved_directive}
""" if evolved_directive else ""

    # ──────────────────────────────────────────────────────────────
    # PHASE 3: TEACHER EXECUTION
    # ──────────────────────────────────────────────────────────────
    print(f"[Pipeline] 🎓 Phase 3: Teacher responding...")

    teacher_system = f"""
# CORE IDENTITY: AFFECTIVE SOCRATIC MENTOR
You are an elite Cognitive Engine. You don't give answers; you rewire brains.

{memory_block}
{librarian_block}
{evolved_block}

# CURRENT COGNITIVE SNAPSHOT
- Emotion:          {emotion}
- Frustration:      {frustration:.2f} / 1.0
- Accuracy:         {accuracy:.2f} / 1.0
- Bottleneck:       {bottleneck}
- Personality Mode: {personality['tone_label']}

# ACTIVE PERSONALITY DIRECTIVE
{personality['directive']}

# UNIVERSAL LAWS
1. EMPATHETIC FRICTION: Acknowledge the feeling BEFORE asking a question.
2. PARALLEL SANDBOX: Never give code or direct answers.
3. ONE QUESTION RULE: Ask exactly ONE focused question per response.
"""

    MAX_HISTORY = 6
    focused = history_list[-MAX_HISTORY:] if len(history_list) > MAX_HISTORY else history_list
    teacher_messages = [{"role": "system", "content": teacher_system}]

    for msg in focused:
        role    = "user"      if msg.startswith("Student:") else "assistant"
        content = msg.split(": ", 1)[1] if ": " in msg else msg
        teacher_messages.append({"role": role, "content": content})

    if directive:
        teacher_messages.append({
            "role":    "system",
            "content": f"SUPERVISOR DIRECTIVE: {directive}",
        })

    enforced_input = f"""
STUDENT INPUT: {user_input}

### RESPONSE CONTRACT ###
Respond ONLY with raw JSON. No markdown. No ```json.
{{
  "hidden_thought":         "Internal reasoning about the student's cognitive trap.",
  "empathetic_validation":  "One sentence acknowledging their feeling.",
  "reply":                  "Your single Socratic question or nudge.",
  "confidence":             0.85,
  "ui_payload": {{
    "requires_diagram":         false,
    "requires_code_editor":     false,
    "parallel_sandbox_problem": "A simpler analogy scenario."
  }}
}}
"""
    teacher_messages.append({"role": "user", "content": enforced_input})

    try:
        teacher_raw  = await call_ai_direct(teacher_messages, temperature=0.15)
        teacher_json = json.loads(clean_json(teacher_raw))
        reply        = teacher_json.get("reply", "Can you walk me through your thinking?")

        # Fire Critic in background — non-blocking
        critic_task.delay(
            student_name,
            user_input,
            reply,
            emotion,
            frustration,
        )
        print(f"[Pipeline] 🔍 Critic task fired (background).")

        # Log exchange → triggers Dreaming Phase every 10 messages
        append_raw_log(student_name, user_input, reply)

        return {
            "sender":               "Teacher",
            "message":              reply,
            "thought":              teacher_json.get("hidden_thought", ""),
            "empathetic_validation": teacher_json.get("empathetic_validation", ""),
            "ui_payload":           teacher_json.get("ui_payload", {}),
            "state":                state,
            "personality_mode":     personality["mode"],
            "tone_label":           personality["tone_label"],
            "limited":              False,
        }

    except Exception as e:
        print(f"[Pipeline Error] Teacher failed: {e}")
        return {
            "sender":  "Teacher",
            "message": "I'm recalibrating my neural pathways. One moment.",
            "thought": f"Exception: {str(e)[:80]}",
            "state":   state,
            "limited": False,
        }


# ═══════════════════════════════════════════════════════════════════
# 5.  DREAMING PHASE
# ═══════════════════════════════════════════════════════════════════
async def _run_dreaming_phase(student_name: str):
    print(f"\n[Dreaming] 🌙 Consolidating for {student_name}...")
    if chat_log_col is None:
        return

    doc = chat_log_col.find_one({"student_name": student_name})
    if not doc or not doc.get("exchanges"):
        return

    exchanges    = doc["exchanges"][-20:]
    log_text     = "\n".join(f"Student: {ex['user']}\nTeacher: {ex['ai']}" for ex in exchanges)
    existing_core = fetch_semantic_core(student_name)
    existing_str  = json.dumps(existing_core, indent=2) if existing_core else "None yet."

    psychologist_prompt = f"""
FEHM.AI PSYCHOLOGIST AGENT — DREAMING PHASE v6.0

Analyze the session. Rewrite the Semantic Core completely (merge old + new).

EXISTING CORE:
{existing_str}

RECENT SESSION ({len(exchanges)} exchanges):
{log_text}

OUTPUT — STRICT JSON:
{{
  "student_name": "{student_name}",
  "personality_summary": "3 sentences.",
  "optimal_modality": "visual | verbal | kinesthetic | mixed",
  "frustration_triggers": [],
  "successful_analogies": [],
  "mastered_concepts": [],
  "active_struggles": [],
  "logic_gaps": [{{"topic": "", "gap": "", "suggested_approach": ""}}],
  "emotional_patterns": {{"peaks": [], "valleys": []}},
  "next_session_opener": "Exact opening line for next session.",
  "teacher_personality_recommendation": "STRICT | PEER | EMPATHETIC | BALANCED",
  "consolidation_date": "{__import__('datetime').datetime.utcnow().isoformat()}"
}}
"""
    try:
        raw      = await call_ai_direct([
            {"role": "system", "content": psychologist_prompt},
            {"role": "user",   "content": "Generate the updated Semantic Core now."},
        ], temperature=0.2)
        new_core = json.loads(clean_json(raw))
        upsert_semantic_core(student_name, new_core)
        print(f"[Dreaming] ✅ Done. Struggles: {new_core.get('active_struggles', [])}")
    except Exception as e:
        print(f"[Dreaming Error] {e}")


# ═══════════════════════════════════════════════════════════════════
# 6.  CELERY TASK DEFINITIONS
# ═══════════════════════════════════════════════════════════════════
@celery_app.task(name="generate_ai_response")
def process_chat_in_background(
    student_name:     str,
    user_input:       str,
    chat_history_str: str,
    user_id:          str = None,
):
    return asyncio.run(
        run_ai_pipeline(student_name, user_input, chat_history_str, user_id)
    )


@celery_app.task(name="consolidate_memory")
def dreaming_phase(student_name: str):
    asyncio.run(_run_dreaming_phase(student_name))