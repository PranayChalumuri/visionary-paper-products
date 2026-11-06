from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from jose import jwt
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db, settings
from app.models import Customer
from app.services.auth import hash_pin, verify_pin


router = APIRouter(prefix="/auth", tags=["Authentication"])

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 180  # 3 hours
ADMIN_PHONE = "9876543210"
ADMIN_PIN = "654321"
LEGACY_CUSTOMER_PIN = "123456"


class CustomerLoginRequest(BaseModel):
    phone: str = Field(pattern=r"^\d{10}$")
    pin: str = Field(pattern=r"^\d{6}$")


def create_access_token(subject: str, role: str):
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def customer_payload(customer: Customer):
    return {
        "id": customer.id,
        "name": customer.name,
        "phone": customer.phone,
        "address": customer.address,
        "location": customer.location,
    }


@router.post("/admin/login")
def admin_login(phone: str, pin: str):
    if phone != ADMIN_PHONE or pin != ADMIN_PIN:
        raise HTTPException(status_code=401, detail="Invalid admin phone or PIN")
    return {
        "message": "Admin login successful",
        "access_token": create_access_token(subject=phone, role="admin"),
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


@router.post("/customer/login")
def customer_login(
    request: CustomerLoginRequest,
    user_agent: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    customer = db.query(Customer).filter(
        Customer.phone == request.phone,
        Customer.is_active == True,
    ).first()

    if not customer:
        raise HTTPException(
            status_code=404,
            detail="No customer account found with this mobile number. Please choose New User to create an account.",
        )

    if customer.pin_hash:
        valid = verify_pin(request.pin, customer.pin_hash)
    else:
        # Compatibility for accounts created before customer PINs were introduced.
        valid = request.pin == LEGACY_CUSTOMER_PIN
        if valid:
            customer.pin_hash = hash_pin(request.pin)
            db.commit()

    if not valid:
        raise HTTPException(status_code=401, detail="Invalid mobile number or PIN")

    return {
        "message": "Customer login successful",
        "access_token": create_access_token(subject=str(customer.id), role="customer"),
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "customer": customer_payload(customer),
    }
