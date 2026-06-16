"""
╔══════════════════════════════════════════════════════════════════╗
║         FEHM.AI  —  LAYER 4 AGENTS  v1.0                        ║
║         Critic + Self-Correction + Librarian                     ║
╚══════════════════════════════════════════════════════════════════╝

This file adds the three agents that make FEHM.AI self-evolving.

HOW THEY FIT TOGETHER:
─────────────────────────────────────────────────────────────────
After every Teacher response:

  Teacher responds
       │
       ▼
  Critic Agent         ← Was that response actually good?
       │
       ▼
  Self-Correction      ← If not, rewrite the Teacher's base prompt
       │
       ▼
  Semantic Core        ← Store the improved directive for next session

In parallel, when a student gets STUCK:

  Student stuck
       │
       ▼
  Librarian Agent      ← Find analogies that worked on similar students
       │
       ▼
  Teacher gets hint    ← "Try the 'water flow' analogy — worked 3x before"
─────────────────────────────────────────────────────────────────
"""

import json
import asyncio
import os
import certifi
from pymongo import MongoClient
from celery import Celery
from ai_core import call_ai_direct, clean_json
from dotenv import load_dotenv

load_dotenv()
# ═══════════════════════════════════════════════════════════════════
# 1.  SHARED INFRASTRUCTURE
# ═══════════════════════════════════════════════════════════════════
MONGO_URI = os.getenv("MONGO_URI")

try:
    cluster          = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
    db               = cluster["tuition_center"]
    semantic_col     = db["semantic_cores"]
    prompt_core_col  = db["prompt_cores"]      # stores evolved Teacher prompts
    critique_log_col = db["critique_logs"]     # stores every Critic verdict
    print("[Agents] ✅ MongoDB connected.")
except Exception as e:
    print(f"[Agents Error] MongoDB failed: {e}")
    semantic_col = prompt_core_col = critique_log_col = None

celery_app = Celery(
    "ai_tasks",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/1",
)


# ═══════════════════════════════════════════════════════════════════
# 2.  CRITIC AGENT
#     Reads a Teacher exchange and scores it.
#     Returns a structured verdict the Self-Correction loop acts on.
# ═══════════════════════════════════════════════════════════════════
CRITIC_PROMPT = """
FEHM.AI CRITIC AGENT v1.0
══════════════════════════

You are a ruthless but fair pedagogy expert. Your job is to evaluate
a single Teacher ↔ Student exchange and score the Teacher's response.

You are NOT the teacher. You NEVER respond to the student.
You ONLY evaluate what the Teacher said.

SCORING RUBRIC (score each 0.0–1.0):
- socratic_quality    : Did the Teacher ask a question that made the student THINK? (1.0 = perfect question, 0.0 = just gave the answer)
- empathy_score       : Did the Teacher acknowledge the student's emotion first? (1.0 = warm and human, 0.0 = cold and robotic)
- clarity_score       : Was the Teacher's question/nudge clear and focused? (1.0 = laser-focused, 0.0 = confusing or vague)
- engagement_score    : Would this response make the student MORE engaged or LESS? (1.0 = exciting, 0.0 = boring)
- overall_score       : Weighted average. Be honest. A 0.9 means almost perfect.

VERDICT OPTIONS:
- "EXCELLENT"   : overall_score >= 0.80. No changes needed.
- "ACCEPTABLE"  : overall_score >= 0.60. Minor improvements possible.
- "WEAK"        : overall_score >= 0.40. Teacher needs a new approach.
- "FAILURE"     : overall_score <  0.40. Completely wrong approach. Rewrite needed.

WHAT TO FIX (if verdict is WEAK or FAILURE):
Write 1–3 CONCRETE directives for the Teacher to follow next time.
Be specific. Not "be more empathetic" — instead:
"The student said 'I give up' — the Teacher ignored this completely.
Next time, ALWAYS mirror back the exact emotion before asking anything."

OUTPUT — STRICT JSON, no markdown:
{
  "verdict": "EXCELLENT | ACCEPTABLE | WEAK | FAILURE",
  "socratic_quality": 0.0,
  "empathy_score": 0.0,
  "clarity_score": 0.0,
  "engagement_score": 0.0,
  "overall_score": 0.0,
  "what_went_wrong": "Null if EXCELLENT/ACCEPTABLE. Specific diagnosis otherwise.",
  "correction_directives": [
    "Directive 1 — concrete instruction for Teacher",
    "Directive 2 — concrete instruction for Teacher"
  ],
  "praise": "One sentence on what the Teacher did well (even in failure, find something)."
}
"""

async def run_critic(
    student_input:   str,
    teacher_response: str,
    student_emotion:  str,
    frustration_index: float,
) -> dict:
    """
    Evaluate a single Teacher response.
    Returns the full critic verdict dict.
    """
    exchange = f"""
STUDENT EMOTION:    {student_emotion} (frustration: {frustration_index:.2f}/1.0)
STUDENT SAID:       {student_input}
TEACHER RESPONDED:  {teacher_response}
"""
    print("[Critic] 🔍 Evaluating Teacher response...")
    try:
        raw     = await call_ai_direct([
            {"role": "system", "content": CRITIC_PROMPT},
            {"role": "user",   "content": exchange},
        ], temperature=0.1)
        verdict = json.loads(clean_json(raw))
        score   = verdict.get("overall_score", 0.5)
        label   = verdict.get("verdict", "ACCEPTABLE")
        print(f"[Critic] ✅ Verdict: {label} (score: {score:.2f})")
        return verdict
    except Exception as e:
        print(f"[Critic Error] {e}")
        return {"verdict": "ACCEPTABLE", "overall_score": 0.5, "correction_directives": []}


# ═══════════════════════════════════════════════════════════════════
# 3.  SELF-CORRECTION LOOP
#     Takes a Critic verdict and, if the score is low enough,
#     rewrites the Teacher's evolved prompt stored in MongoDB.
#
#     The Teacher's prompt has two layers:
#       - BASE PROMPT  : the universal identity (never touched)
#       - EVOLVED CORE : a per-student addendum that grows over time
#                        and gets rewritten here
# ═══════════════════════════════════════════════════════════════════
SELF_CORRECTION_THRESHOLD = 0.60   # below this → rewrite is triggered

SELF_CORRECTION_PROMPT = """
FEHM.AI SELF-CORRECTION ENGINE v1.0
═════════════════════════════════════

You are rewriting a Teacher AI's evolved directive for a specific student.
The Critic found the Teacher's approach was weak or failing.
Your job: produce a NEW evolved directive that fixes the problem.

RULES:
1. Be SURGICAL. Only fix what the Critic identified.
2. Keep what was already working (from the existing directive).
3. Write in imperative form: "ALWAYS...", "NEVER...", "WHEN... THEN..."
4. Max 5 bullet directives. Concise > comprehensive.
5. This directive will be injected into every future Teacher prompt for this student.

OUTPUT — STRICT JSON, no markdown:
{
  "new_evolved_directive": "The full rewritten directive as a single string with \\n between rules.",
  "change_summary": "One sentence: what changed and why.",
  "confidence": 0.85
}
"""

async def run_self_correction(
    student_name:      str,
    critic_verdict:    dict,
    student_input:     str,
    teacher_response:  str,
) -> bool:
    """
    If the Critic verdict is weak/failing, rewrite the Teacher's
    evolved prompt in MongoDB.

    Returns True if a rewrite happened, False if not needed.
    """
    overall = critic_verdict.get("overall_score", 1.0)
    verdict = critic_verdict.get("verdict", "ACCEPTABLE")

    # Log every critique regardless of verdict
    if critique_log_col is not None:
        critique_log_col.insert_one({
            "student_name":    student_name,
            "verdict":         verdict,
            "overall_score":   overall,
            "student_input":   student_input,
            "teacher_response": teacher_response,
            "full_verdict":    critic_verdict,
            "ts":              __import__("datetime").datetime.utcnow(),
        })

    # Only rewrite if score is below threshold
    if overall >= SELF_CORRECTION_THRESHOLD:
        print(f"[Self-Correction] Score {overall:.2f} ≥ threshold. No rewrite needed.")
        return False

    print(f"[Self-Correction] 🔧 Score {overall:.2f} < {SELF_CORRECTION_THRESHOLD}. Rewriting directive...")

    # Fetch existing evolved directive
    existing_doc  = prompt_core_col.find_one({"student_name": student_name}) if prompt_core_col else None
    existing_core = existing_doc.get("evolved_directive", "No prior directive.") if existing_doc else "No prior directive."

    directives_str = "\n".join(
        f"- {d}" for d in critic_verdict.get("correction_directives", [])
    )

    correction_input = f"""
EXISTING EVOLVED DIRECTIVE:
{existing_core}

CRITIC'S DIAGNOSIS:
{critic_verdict.get("what_went_wrong", "General weakness.")}

SPECIFIC CORRECTIONS NEEDED:
{directives_str}

CONTEXT:
Student said:    {student_input}
Teacher replied: {teacher_response}
"""
    try:
        raw    = await call_ai_direct([
            {"role": "system", "content": SELF_CORRECTION_PROMPT},
            {"role": "user",   "content": correction_input},
        ], temperature=0.2)
        result = json.loads(clean_json(raw))
        new_directive = result.get("new_evolved_directive", "")
        summary = result.get("change_summary", "")

        # ✅ CORRECT (Added the :)
        if new_directive and prompt_core_col is not None:
            prompt_core_col.update_one(
                {"student_name": student_name},
                {"$set": {
                    "evolved_directive": new_directive,
                    "last_updated":      __import__("datetime").datetime.utcnow(),
                    "last_change":       summary,
                    "rewrite_count":     (existing_doc.get("rewrite_count", 0) + 1) if existing_doc else 1,
                }},
                upsert=True,
            )
            print(f"[Self-Correction] ✅ Directive rewritten: {summary}")
            return True

    except Exception as e:
        print(f"[Self-Correction Error] {e}")

    return False


def fetch_evolved_directive(student_name: str) -> str:
    """
    Called by tasks.py to inject the evolved directive into the Teacher prompt.
    Returns empty string if no directive exists yet.
    """
    if prompt_core_col is None:
        return ""
    doc = prompt_core_col.find_one({"student_name": student_name})
    return doc.get("evolved_directive", "") if doc else ""


# ═══════════════════════════════════════════════════════════════════
# 4.  LIBRARIAN AGENT
#     When a student is STUCK, search ALL semantic cores for students
#     who struggled with the SAME concept — and find what worked.
#
#     This is cross-student generalization.
#     The system learns not just from one student, but from everyone.
# ═══════════════════════════════════════════════════════════════════
LIBRARIAN_PROMPT = """
FEHM.AI LIBRARIAN AGENT v1.0
══════════════════════════════

You are a pattern-matching librarian. You have been given:
1. The current student's bottleneck (what they're stuck on).
2. A collection of semantic cores from OTHER students who also struggled.

Your job: find the BEST analogy or teaching approach that worked for similar students.

SEARCH STRATEGY:
- Look for students who had the same concept in their 'active_struggles' or 'mastered_concepts'.
- Extract their 'successful_analogies' that helped them break through.
- Find patterns: did a visual approach work? A real-world metaphor? A simpler sub-problem?

OUTPUT — STRICT JSON, no markdown:
{
  "found_pattern": true,
  "recommended_analogy": "The specific analogy or approach to try, in 1–2 sentences.",
  "source_count": 3,
  "confidence": 0.80,
  "fallback_strategy": "If no pattern found, what general approach to try instead.",
  "reasoning": "Why this analogy should work for this student."
}
"""

async def run_librarian(
    current_student:  str,
    bottleneck_topic: str,
    student_modality: str = "mixed",
) -> dict:
    """
    Search all other students' semantic cores for patterns that solved
    the same bottleneck. Returns a recommended analogy/approach.
    """
    print(f"[Librarian] 📚 Searching for patterns on: '{bottleneck_topic}'...")

    if semantic_col is None:
        return {"found_pattern": False, "recommended_analogy": "", "confidence": 0.0}

    # Fetch all other students' cores (exclude current student)
    all_cores = list(semantic_col.find(
        {"student_name": {"$ne": current_student}},
        {"student_name": 1, "semantic_core": 1, "_id": 0}
    ).limit(20))   # cap at 20 to keep prompt size sane

    if not all_cores:
        print("[Librarian] No other student cores found yet.")
        return {
            "found_pattern":      False,
            "recommended_analogy": "",
            "confidence":         0.0,
            "fallback_strategy":  "Use the Parallel Sandbox: create a simpler real-world version of the concept.",
            "reasoning":          "No cross-student data available yet.",
        }

    # Build a compressed knowledge base for the prompt
    knowledge_base = []
    for doc in all_cores:
        core = doc.get("semantic_core", {})
        struggles  = core.get("active_struggles", [])
        mastered   = core.get("mastered_concepts", [])
        analogies  = core.get("successful_analogies", [])
        modality   = core.get("optimal_modality", "mixed")

        # Only include students who touched the relevant topic
        topic_lower = bottleneck_topic.lower()
        relevant = any(
            topic_lower in str(item).lower()
            for item in struggles + mastered + analogies
        )
        if relevant or len(knowledge_base) < 5:   # always include at least 5
            knowledge_base.append({
                "student":            doc["student_name"],
                "modality":           modality,
                "struggled_with":     struggles,
                "mastered":           mastered,
                "analogies_that_worked": analogies,
            })

    search_input = f"""
CURRENT STUDENT: {current_student}
CURRENT BOTTLENECK: {bottleneck_topic}
CURRENT STUDENT MODALITY: {student_modality}

KNOWLEDGE BASE FROM OTHER STUDENTS:
{json.dumps(knowledge_base, indent=2)}
"""

    try:
        raw    = await call_ai_direct([
            {"role": "system", "content": LIBRARIAN_PROMPT},
            {"role": "user",   "content": search_input},
        ], temperature=0.2)
        result = json.loads(clean_json(raw))
        found  = result.get("found_pattern", False)
        count  = result.get("source_count", 0)
        print(f"[Librarian] ✅ Pattern {'found' if found else 'not found'} "
              f"(searched {len(knowledge_base)} students, matched {count}).")
        return result
    except Exception as e:
        print(f"[Librarian Error] {e}")
        return {
            "found_pattern":      False,
            "recommended_analogy": "",
            "confidence":         0.0,
            "fallback_strategy":  "Use the Parallel Sandbox method.",
            "reasoning":          f"Librarian error: {str(e)[:60]}",
        }


# ═══════════════════════════════════════════════════════════════════
# 5.  CELERY TASKS  (background wrappers)
# ═══════════════════════════════════════════════════════════════════
@celery_app.task(name="run_critic_background")
def critic_task(
    student_name:      str,
    student_input:     str,
    teacher_response:  str,
    student_emotion:   str,
    frustration_index: float,
):
    """
    Fire-and-forget after every Teacher response.
    Evaluates quality and triggers self-correction if needed.
    """
    async def _run():
        verdict = await run_critic(
            student_input, teacher_response, student_emotion, frustration_index
        )
        await run_self_correction(
            student_name, verdict, student_input, teacher_response
        )
    asyncio.run(_run())


@celery_app.task(name="run_librarian_background")
def librarian_task(student_name: str, bottleneck: str, modality: str = "mixed"):
    """
    Called when state == STUCK.
    Result is stored in Redis so the NEXT Teacher call can use it.
    """
    import redis as redis_lib
    r = redis_lib.Redis(host="localhost", port=6379, db=0, decode_responses=True)

    async def _run():
        result = await run_librarian(student_name, bottleneck, modality)
        # Cache for 10 minutes — Teacher reads this on next request
        r.setex(
            f"librarian:{student_name}",
            600,
            json.dumps(result),
        )
        print(f"[Librarian] 💾 Cached result for {student_name}.")
    asyncio.run(_run())