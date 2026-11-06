from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Customer, CustomOrder, Order, OrderItem
from app.services.auth import get_current_admin


router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(get_current_admin)],
)

ALLOWED_STATUSES = {"Pending", "Confirmed", "Processing", "Ready", "Completed", "Cancelled"}
BUSINESS_TZ = ZoneInfo("Asia/Kolkata")


def customer_map(db: Session):
    return {c.id: c for c in db.query(Customer).all()}


def order_payload(order, customer, items):
    return {
        "id": order.id,
        "customer_id": order.customer_id,
        "customer": {
            "id": customer.id, "name": customer.name, "phone": customer.phone,
            "address": customer.address, "location": customer.location,
        } if customer else None,
        "status": order.status,
        "subtotal": float(order.subtotal),
        "discount_percentage": float(order.discount_percentage),
        "discount_amount": float(order.discount_amount),
        "total_amount": float(order.total_amount),
        "created_at": order.created_at,
        "items": [
            {"product_name": i.product_name, "option_name": i.option_name, "quantity": i.quantity,
             "unit_price": float(i.unit_price), "item_total": float(i.item_total)} for i in items
        ],
    }


def custom_payload(row, customer):
    return {
        "id": row.id, "customer_id": row.customer_id,
        "customer": {
            "id": customer.id, "name": customer.name, "phone": customer.phone,
            "address": customer.address, "location": customer.location,
        } if customer else None,
        "order_type": row.order_type, "product_id": row.product_id, "product_option_id": row.product_option_id,
        "file_name": row.file_name, "file_path": row.file_path, "page_count": row.page_count,
        "copies": row.copies, "unit_price": float(row.unit_price),
        "discount_percentage": float(row.discount_percentage or 0),
        "discount_amount": float(row.discount_amount or 0),
        "total_amount": float(row.total_amount),
        "school_college_name": row.school_college_name, "status": row.status, "created_at": row.created_at,
    }


@router.get("/orders")
def get_all_orders(db: Session = Depends(get_db)):
    customers = customer_map(db)
    orders = db.query(Order).order_by(Order.created_at.desc()).all()
    result = []
    for order in orders:
        items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
        result.append(order_payload(order, customers.get(order.customer_id), items))
    return result


@router.get("/orders/{order_id}")
def get_admin_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    return order_payload(order, customer, items)


@router.put("/orders/{order_id}/status")
def update_order_status(order_id: int, status: str, db: Session = Depends(get_db)):
    if status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid order status")
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = status
    db.commit()
    return {"message": "Order status updated successfully", "order_id": order.id, "status": order.status}


@router.get("/custom-orders")
def get_all_custom_orders(db: Session = Depends(get_db)):
    customers = customer_map(db)
    rows = db.query(CustomOrder).order_by(CustomOrder.created_at.desc()).all()
    return [custom_payload(row, customers.get(row.customer_id)) for row in rows]


@router.get("/custom-orders/{custom_order_id}/file")
def download_custom_order_file(custom_order_id: int, db: Session = Depends(get_db)):
    row = db.query(CustomOrder).filter(CustomOrder.id == custom_order_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Custom order not found")
    if not row.file_path:
        raise HTTPException(status_code=404, detail="Uploaded file is not available on the server")
    stored_path = Path(row.file_path)
    if not stored_path.is_absolute():
        stored_path = Path(__file__).resolve().parents[2] / stored_path
    if not stored_path.is_file():
        raise HTTPException(status_code=404, detail="Uploaded file is not available on the server")
    return FileResponse(path=str(stored_path), filename=row.file_name or stored_path.name)


@router.put("/custom-orders/{custom_order_id}/status")
def update_custom_order_status(custom_order_id: int, status: str, db: Session = Depends(get_db)):
    if status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid custom order status")
    row = db.query(CustomOrder).filter(CustomOrder.id == custom_order_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Custom order not found")
    row.status = status
    db.commit()
    return {"message": "Custom order status updated successfully", "custom_order_id": row.id, "status": row.status}


@router.get("/pending-orders")
def get_pending_orders(db: Session = Depends(get_db)):
    customers = customer_map(db)
    pending = []
    for order in db.query(Order).filter(Order.status == "Pending").order_by(Order.created_at.desc()).all():
        items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
        pending.append({"kind": "order", **order_payload(order, customers.get(order.customer_id), items)})
    for row in db.query(CustomOrder).filter(CustomOrder.status == "Pending").order_by(CustomOrder.created_at.desc()).all():
        pending.append({"kind": "custom", **custom_payload(row, customers.get(row.customer_id))})
    pending.sort(key=lambda x: x.get("created_at") or datetime.min, reverse=True)
    return pending


@router.get("/analytics/sales")
def sales_analytics(start_date: date, end_date: date | None = None, db: Session = Depends(get_db)):
    if end_date is None:
        end_date = start_date
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date cannot be before start_date")

    start_local = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=BUSINESS_TZ)
    end_local = datetime.combine(end_date + timedelta(days=1), datetime.min.time()).replace(tzinfo=BUSINESS_TZ)
    start_dt = start_local.astimezone(timezone.utc).replace(tzinfo=None)
    end_dt = end_local.astimezone(timezone.utc).replace(tzinfo=None)

    order_total = db.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(
        Order.created_at >= start_dt, Order.created_at < end_dt, Order.status != "Cancelled"
    ).scalar() or 0
    custom_total = db.query(func.coalesce(func.sum(CustomOrder.total_amount), 0)).filter(
        CustomOrder.created_at >= start_dt, CustomOrder.created_at < end_dt, CustomOrder.status != "Cancelled"
    ).scalar() or 0
    order_count = db.query(func.count(Order.id)).filter(
        Order.created_at >= start_dt, Order.created_at < end_dt, Order.status != "Cancelled"
    ).scalar() or 0
    custom_count = db.query(func.count(CustomOrder.id)).filter(
        CustomOrder.created_at >= start_dt, CustomOrder.created_at < end_dt, CustomOrder.status != "Cancelled"
    ).scalar() or 0

    return {
        "start_date": start_date,
        "end_date": end_date,
        "standard_order_sales": float(order_total),
        "custom_order_sales": float(custom_total),
        "sales_value": float(order_total + custom_total),
        "standard_order_count": int(order_count),
        "custom_order_count": int(custom_count),
        "order_count": int(order_count + custom_count),
        "note": "Sales value is based on order totals. Payment collection is not connected yet.",
    }


@router.get("/customers")
def get_all_customers(db: Session = Depends(get_db)):
    customers = db.query(Customer).order_by(Customer.created_at.desc()).all()
    return [
        {"id": c.id, "name": c.name, "phone": c.phone, "address": c.address,
         "location": c.location, "created_at": c.created_at, "is_active": c.is_active}
        for c in customers
    ]
