"""
FEHM.AI — Auth Routes
/auth/signup  →  create user
/auth/login   →  verify + return token
"""

import os
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import certifi
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

load_dotenv()

router = APIRouter(prefix="/auth", tags=["auth"])

# ── MongoDB ───────────────────────────────────────────────────────
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI is not set. Add it to your .env file.")

TOKEN_TTL = timedelta(days=7)

try:
    cluster = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
    db = cluster["tuition_center"]
    users_col = db["users"]
    users_col.create_index("email", unique=True)
    print("[Auth] ✅ Users collection ready.")
except Exception as e:
    print(f"[Auth Error] MongoDB failed: {e}")
    users_col = None

# ── Password hashing ──────────────────────────────────────────────
pwd_ctx = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

# ── Tokens (only the hash is stored in the DB) ────────────────────
def make_token() -> str:
    return secrets.token_hex(32)

def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

def now() -> datetime:
    return datetime.now(timezone.utc)

# ── Schemas ───────────────────────────────────────────────────────
class SignUpRequest(BaseModel):
    name:     str = Field(min_length=1, max_length=100)
    email:    EmailStr
    password: str = Field(min_length=8, max_length=128)

class LoginRequest(BaseModel):
    email:    EmailStr
    password: str = Field(max_length=128)

# ── Auth dependency: use this to protect other routes ─────────────
bearer = HTTPBearer()

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if users_col is None:
        raise HTTPException(500, detail="Database unavailable.")
    user = users_col.find_one({"token_hash": hash_token(creds.credentials)})
    if not user:
        raise HTTPException(401, detail="Invalid token.")
    expires = user.get("token_expires")
    if expires is None or expires.replace(tzinfo=timezone.utc) < now():
        raise HTTPException(401, detail="Session expired. Please log in again.")
    return user

# ── Routes ────────────────────────────────────────────────────────
@router.post("/signup")
def signup(req: SignUpRequest):
    if users_col is None:
        raise HTTPException(500, detail="Database unavailable.")

    email = req.email.lower()
    user = {
        "name":       req.name.strip(),
        "email":      email,
        "password":   hash_password(req.password),
        "created_at": now(),
    }
    try:
        users_col.insert_one(user)
    except DuplicateKeyError:
        raise HTTPException(400, detail="An account with this email already exists.")

    return {"message": "Account created successfully."}

@router.post("/login")
def login(req: LoginRequest):
    if users_col is None:
        raise HTTPException(500, detail="Database unavailable.")

    user = users_col.find_one({"email": req.email.lower()})
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(401, detail="Incorrect email or password.")

    token = make_token()
    users_col.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "token_hash":    hash_token(token),
            "token_expires": now() + TOKEN_TTL,
            "last_login":    now(),
        }},
    )

    return {
        "token": token,
        "user": {"name": user["name"], "email": user["email"]},
    }