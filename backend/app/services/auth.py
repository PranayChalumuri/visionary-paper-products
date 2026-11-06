from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
import bcrypt

from app.database import settings


security = HTTPBearer()
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"



def hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_pin(pin: str, pin_hash: str) -> bool:
    try:
        return bcrypt.checkpw(pin.encode("utf-8"), pin_hash.encode("ascii"))
    except (ValueError, TypeError, UnicodeEncodeError):
        return False


def decode_token(credentials: HTTPAuthorizationCredentials):
    try:
        return jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired customer token")


def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(credentials)
    role = payload.get("role")
    subject = payload.get("sub")
    if role != "admin" or not subject:
        raise HTTPException(status_code=403, detail="Admin access required")
    return subject


def get_current_customer(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(credentials)
    role = payload.get("role")
    subject = payload.get("sub")
    if role != "customer" or not subject:
        raise HTTPException(status_code=403, detail="Customer access required")
    try:
        return int(subject)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired customer token")
