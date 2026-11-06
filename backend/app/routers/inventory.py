from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Inventory, Product
from app.services.auth import get_current_admin


router = APIRouter(
    prefix="/admin/inventory",
    tags=["Inventory"],
    dependencies=[Depends(get_current_admin)],
)


@router.get("/")
def get_inventory(
    db: Session = Depends(get_db),
):
    inventory_items = (
        db.query(Inventory, Product)
        .join(Product, Inventory.product_id == Product.id)
        .filter(
            Inventory.is_active == True,
            Product.is_active == True,
        )
        .order_by(Product.id)
        .all()
    )

    return [
        {
            "inventory_id": inventory.id,
            "product_id": product.id,
            "product_name": product.name,
            "stock_quantity": inventory.stock_quantity,
            "low_stock_threshold": inventory.low_stock_threshold,
            "low_stock": (
                inventory.stock_quantity
                <= inventory.low_stock_threshold
            ),
            "updated_at": inventory.updated_at,
        }
        for inventory, product in inventory_items
    ]


@router.post("/{product_id}")
def create_inventory(
    product_id: int,
    stock_quantity: int,
    low_stock_threshold: int = 10,
    db: Session = Depends(get_db),
):
    if stock_quantity < 0:
        raise HTTPException(
            status_code=400,
            detail="Stock quantity cannot be negative",
        )

    if low_stock_threshold < 0:
        raise HTTPException(
            status_code=400,
            detail="Low-stock threshold cannot be negative",
        )

    product = (
        db.query(Product)
        .filter(
            Product.id == product_id,
            Product.is_active == True,
        )
        .first()
    )

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found",
        )

    existing_inventory = (
        db.query(Inventory)
        .filter(Inventory.product_id == product_id)
        .first()
    )

    if existing_inventory:
        raise HTTPException(
            status_code=409,
            detail="Inventory already exists for this product",
        )

    inventory = Inventory(
        product_id=product_id,
        stock_quantity=stock_quantity,
        low_stock_threshold=low_stock_threshold,
    )

    db.add(inventory)
    db.commit()
    db.refresh(inventory)

    return {
        "message": "Inventory created successfully",
        "inventory": {
            "id": inventory.id,
            "product_id": product.id,
            "product_name": product.name,
            "stock_quantity": inventory.stock_quantity,
            "low_stock_threshold": inventory.low_stock_threshold,
        },
    }


@router.put("/{product_id}")
def update_inventory(
    product_id: int,
    stock_quantity: int,
    low_stock_threshold: int = 10,
    db: Session = Depends(get_db),
):
    if stock_quantity < 0:
        raise HTTPException(
            status_code=400,
            detail="Stock quantity cannot be negative",
        )

    if low_stock_threshold < 0:
        raise HTTPException(
            status_code=400,
            detail="Low-stock threshold cannot be negative",
        )

    inventory = (
        db.query(Inventory)
        .filter(
            Inventory.product_id == product_id,
            Inventory.is_active == True,
        )
        .first()
    )

    if not inventory:
        raise HTTPException(
            status_code=404,
            detail="Inventory not found",
        )

    inventory.stock_quantity = stock_quantity
    inventory.low_stock_threshold = low_stock_threshold

    db.commit()
    db.refresh(inventory)

    return {
        "message": "Inventory updated successfully",
        "inventory": {
            "id": inventory.id,
            "product_id": inventory.product_id,
            "stock_quantity": inventory.stock_quantity,
            "low_stock_threshold": inventory.low_stock_threshold,
        },
    }