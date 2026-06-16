"""
FEHM.AI — Auth Routes
/auth/signup  →  create user
/auth/login   →  verify + return token
"""

import os
import secrets
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
import certifi
from pymongo import MongoClient

router = APIRouter(prefix="/auth", tags=["auth"])

# ── MongoDB ───────────────────────────────────────────────────────
MONGO_URI = "mongodb+srv://tahaahmedkhari9_db_user:S8sefS8nhFuQAu4J@cluster0.qmmdkxq.mongodb.net/?appName=Cluster0"

try:
    cluster = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
    db = cluster["tuition_center"]
    users_col = db["users"]
    users_col.create_index("email", unique=True)
    print("[Auth] ✅ Users collection ready.")
except Exception as e:
    print(f"[Auth Error] MongoDB failed: {e}")
    users_col = None

# ── Password hashing – using sha256_crypt (no 72‑byte limit) ─────
pwd_ctx = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

def make_token() -> str:
    return secrets.token_hex(32)

# ── Schemas ───────────────────────────────────────────────────────
class SignUpRequest(BaseModel):
    name:     str
    email:    EmailStr
    password: str

class LoginRequest(BaseModel):
    email:    EmailStr
    password: str

# ── Routes ────────────────────────────────────────────────────────
@router.post("/signup")
def signup(req: SignUpRequest):
    if users_col is None:
        raise HTTPException(500, detail="Database unavailable.")

    if len(req.password) < 8:
        raise HTTPException(400, detail="Password must be at least 8 characters.")

    existing = users_col.find_one({"email": req.email})
    if existing:
        raise HTTPException(400, detail="An account with this email already exists.")

    token = make_token()
    user = {
        "name":       req.name.strip(),
        "email":      req.email.lower(),
        "password":   hash_password(req.password),
        "token":      token,
        "created_at": datetime.utcnow(),
    }

    try:
        users_col.insert_one(user)
    except Exception:
        raise HTTPException(400, detail="An account with this email already exists.")

    return {"message": "Account created successfully."}

@router.post("/login")
def login(req: LoginRequest):
    if users_col is None:
        raise HTTPException(500, detail="Database unavailable.")

    user = users_col.find_one({"email": req.email.lower()})
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(401, detail="Incorrect email or password.")

    new_token = make_token()
    users_col.update_one(
        {"_id": user["_id"]},
        {"$set": {"token": new_token, "last_login": datetime.utcnow()}},
    )

    return {
        "token": new_token,
        "user": {
            "name":  user["name"],
            "email": user["email"],
        },
    }