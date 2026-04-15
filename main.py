import os
import json
import certifi
from datetime import datetime
from fastapi import FastAPI, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pymongo import MongoClient
from dotenv import load_dotenv

from celery.result import AsyncResult
from worker import celery_app, process_chat_in_background
from ai_core import get_model_health, check_rate_limit, call_ai_direct, clean_json

# Load environment variables
load_dotenv()

# Create FastAPI app – only ONCE
app = FastAPI(title="Fehm-AI Elite Cognitive Engine")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URI = "mongodb+srv://tahaahmedkhari9_db_user:S8sefS8nhFuQAu4J@cluster0.qmmdkxq.mongodb.net/?appName=Cluster0"
try:
    print("[System] 🔌 Connecting to MongoDB Atlas...")
    cluster = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
    db = cluster["tuition_center"]
    collection = db["evaluations"]
    semantic_collection = db["semantic_cores"]
    print("[System] ✅ Database Connected Successfully!\n")
except Exception as e:
    print(f"[System Error] MongoDB Connection Failed: {e}")
    collection = semantic_collection = None

# Import and include auth router
# Make sure you have renamed Auth.py → auth.py (lowercase)
from auth import router as auth_router
app.include_router(auth_router)

# --- Pydantic models ---
class EvaluateRequest(BaseModel):
    student_name: str
    user_id: str
    user_input: str
    chat_history: list[str]

# --- Routes ---
@app.post("/chat")
async def chat_endpoint(
    student_name: str = Form("Unknown Student"),
    user_id: str = Form("default_user"),
    user_input: str = Form(...),
    chat_history: str = Form(...)
):
    # ✅ FIX: Use user_id for isolation, not name
    allowed, time_left = check_rate_limit(user_id) 
    
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={
                "message": _professional_limit_message(time_left),
                "retry_after": time_left
            }
        )
    task = process_chat_in_background.delay(student_name, user_input, chat_history, user_id)
    return {
        "status": "processing",
        "task_id": task.id,
        "message": "FEHM.AI is synthesizing a response..."
    }

@app.post("/memorize")
async def memorize_endpoint(request: EvaluateRequest):
    return await evaluate_endpoint(request)

@app.get("/chat/status/{task_id}")
async def get_chat_status(task_id: str):
    task_result = AsyncResult(task_id, app=celery_app)
    if task_result.state == 'PENDING':
        return {"status": "processing", "message": "Still in queue..."}
    elif task_result.state == 'SUCCESS':
        return {"status": "complete", "result": task_result.result}
    elif task_result.state == 'FAILURE':
        return {"status": "error", "message": str(task_result.info)}
    else:
        return {"status": task_result.state}

@app.get("/health")
async def health_check():
    try:
        health_status = get_model_health()
        return {
            "status": "online",
            "engine": "Fehm-AI v7.0",
            "models": health_status,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {"status": "degraded", "error": str(e)}

@app.post("/evaluate")
async def evaluate_endpoint(request: EvaluateRequest):
    final_transcript = "\n".join(request.chat_history)
    existing_core = semantic_collection.find_one({"student_name": request.student_name})
    old_memory_str = json.dumps(existing_core.get("semantic_core", {})) if existing_core else "No prior memory."
    distiller_prompt = """
    FEHM.AI COGNITIVE DISTILLER v7.0
    Extract fundamental truths about the student.
    OUTPUT STRICTLY IN JSON.
    """
    try:
        ass_content = await call_ai_direct([
            {"role": "system", "content": distiller_prompt},
            {"role": "user", "content": f"OLD MEMORY:\n{old_memory_str}\n\nTRANSCRIPT:\n{final_transcript}"}
        ], temperature=0.1)
        new_semantic_core = json.loads(clean_json(ass_content))
        semantic_collection.update_one(
            {"student_name": request.student_name},
            {"$set": {"semantic_core": new_semantic_core, "last_updated": datetime.utcnow()}},
            upsert=True
        )
        return {"status": "success", "semantic_core": new_semantic_core}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Distiller error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)