from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Product, ProductOption


router = APIRouter(
    prefix="/products",
    tags=["Products"],
)


@router.get("/")
def get_products(db: Session = Depends(get_db)):
    products = (
        db.query(Product)
        .filter(Product.is_active == True)
        .order_by(Product.id)
        .all()
    )

    return [
        {
            "id": product.id,
            "name": product.name,
            "description": product.description,
            "category": product.category,
            "base_price": float(product.base_price),
            "requires_pdf": product.requires_pdf,
            "requires_design": product.requires_design,
        }
        for product in products
    ]


@router.get("/{product_id}")
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
):
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

    return {
        "id": product.id,
        "name": product.name,
        "description": product.description,
        "category": product.category,
        "base_price": float(product.base_price),
        "requires_pdf": product.requires_pdf,
        "requires_design": product.requires_design,
    }


@router.get("/{product_id}/options")
def get_product_options(
    product_id: int,
    db: Session = Depends(get_db),
):
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

    options = (
        db.query(ProductOption)
        .filter(
            ProductOption.product_id == product_id,
            ProductOption.is_active == True,
        )
        .order_by(ProductOption.id)
        .all()
    )

    return [
        {
            "id": option.id,
            "product_id": option.product_id,
            "option_name": option.option_name,
            "price": float(option.price),
        }
        for option in options
    ]