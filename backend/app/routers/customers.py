from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Customer
from app.schemas.customer import CustomerProfileUpdateRequest, CustomerRegisterRequest
from app.services.auth import get_current_customer, hash_pin


router = APIRouter(prefix="/customers", tags=["Customers"])


@router.post("/register")
def register_customer(request: CustomerRegisterRequest, db: Session = Depends(get_db)):
    phone = request.phone.strip()
    existing_customer = db.query(Customer).filter(Customer.phone == phone).first()
    if existing_customer:
        raise HTTPException(
            status_code=409,
            detail="This mobile number is already registered. Please login with the same number and your PIN.",
        )

    customer = Customer(
        name=request.name.strip(),
        phone=phone,
        pin_hash=hash_pin(request.pin),
        address=request.address.strip(),
        location=request.location.strip() if request.location else None,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)

    return {
        "message": "Customer account created successfully",
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "address": customer.address,
            "location": customer.location,
            "created_at": customer.created_at,
        },
    }


@router.get("/me/profile")
def get_my_profile(customer_id: int = Depends(get_current_customer), db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.is_active == True).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {
        "id": customer.id,
        "name": customer.name,
        "phone": customer.phone,
        "address": customer.address,
        "location": customer.location,
        "created_at": customer.created_at,
    }


@router.put("/me/profile")
def update_my_profile(
    request: CustomerProfileUpdateRequest,
    customer_id: int = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.is_active == True).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer.address = request.address.strip()
    customer.location = request.location.strip() if request.location else None
    db.commit()
    db.refresh(customer)

    return {
        "message": "Address updated successfully",
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "address": customer.address,
            "location": customer.location,
            "created_at": customer.created_at,
        },
    }
