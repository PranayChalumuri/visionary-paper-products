from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Customer,
    Inventory,
    Order,
    OrderItem,
    Product,
    ProductOption,
)
from app.schemas.order import OrderCreate
from app.services.auth import get_current_customer


router = APIRouter(
    prefix="/orders",
    tags=["Orders"],
)


# ============================================================
# CREATE ORDER
# ============================================================

@router.post("/")
def create_order(
    order_data: OrderCreate,
    customer_id: int = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Create one standard order and deduct stock atomically.

    Inventory is locked for the duration of the transaction. Quantities are
    aggregated per product so two selected options for the same product cannot
    each pass a stock check independently and overdraw the same inventory row.
    """
    try:
        customer = (
            db.query(Customer)
            .filter(Customer.id == customer_id, Customer.is_active.is_(True))
            .first()
        )
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        subtotal = Decimal("0.00")
        order_items_data = []
        inventory_by_product = {}
        required_by_product = {}
        product_by_id = {}

        for cart_item in order_data.items:
            product = (
                db.query(Product)
                .filter(Product.id == cart_item.product_id, Product.is_active.is_(True))
                .first()
            )
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {cart_item.product_id} not found")

            product_by_id[product.id] = product
            option = None
            if cart_item.product_option_id is not None:
                option = (
                    db.query(ProductOption)
                    .filter(
                        ProductOption.id == cart_item.product_option_id,
                        ProductOption.product_id == product.id,
                        ProductOption.is_active.is_(True),
                    )
                    .first()
                )
                if not option:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Selected option {cart_item.product_option_id} is not active for {product.name}",
                    )
                unit_price = option.price
                option_name = option.option_name
            else:
                has_options = (
                    db.query(ProductOption.id)
                    .filter(ProductOption.product_id == product.id, ProductOption.is_active.is_(True))
                    .first()
                )
                if has_options:
                    raise HTTPException(status_code=400, detail=f"Please select an option for {product.name}")
                unit_price = product.base_price
                option_name = None

            required_by_product[product.id] = required_by_product.get(product.id, 0) + cart_item.quantity
            item_total = unit_price * cart_item.quantity
            subtotal += item_total
            order_items_data.append({
                "product": product,
                "option": option,
                "option_name": option_name,
                "quantity": cart_item.quantity,
                "unit_price": unit_price,
                "item_total": item_total,
            })

        # Lock inventory rows in a stable product-ID order to avoid deadlocks
        # when concurrent customers order overlapping sets of products.
        for product_id in sorted(required_by_product):
            product = product_by_id[product_id]
            inventory = (
                db.query(Inventory)
                .filter(Inventory.product_id == product_id, Inventory.is_active.is_(True))
                .with_for_update()
                .first()
            )
            if not inventory:
                raise HTTPException(
                    status_code=400,
                    detail=f"Inventory not configured or inactive for {product.name}",
                )
            inventory_by_product[product_id] = inventory
            requested_quantity = required_by_product[product_id]
            if inventory.stock_quantity < requested_quantity:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Insufficient stock for {product.name}. "
                        f"Available: {inventory.stock_quantity}, Requested: {requested_quantity}"
                    ),
                )

        discount_percentage = Decimal("10.00")
        discount_amount = subtotal * discount_percentage / Decimal("100")
        total_amount = subtotal - discount_amount

        order = Order(
            customer_id=customer.id,
            status="Pending",
            subtotal=subtotal,
            discount_percentage=discount_percentage,
            discount_amount=discount_amount,
            total_amount=total_amount,
        )
        db.add(order)
        db.flush()

        for item_data in order_items_data:
            product = item_data["product"]
            option = item_data["option"]
            db.add(OrderItem(
                order_id=order.id,
                product_id=product.id,
                product_option_id=option.id if option else None,
                product_name=product.name,
                option_name=item_data["option_name"],
                quantity=item_data["quantity"],
                unit_price=item_data["unit_price"],
                item_total=item_data["item_total"],
            ))

        for product_id, requested_quantity in required_by_product.items():
            inventory_by_product[product_id].stock_quantity -= requested_quantity

        db.commit()
        db.refresh(order)

        return {
            "message": "Order created successfully",
            "order": {
                "id": order.id,
                "customer_id": order.customer_id,
                "status": order.status,
                "subtotal": float(order.subtotal),
                "discount_percentage": float(order.discount_percentage),
                "discount_amount": float(order.discount_amount),
                "total_amount": float(order.total_amount),
                "items": [
                    {
                        "product_id": item_data["product"].id,
                        "product_name": item_data["product"].name,
                        "product_option_id": item_data["option"].id if item_data["option"] else None,
                        "option_name": item_data["option_name"],
                        "quantity": item_data["quantity"],
                        "unit_price": float(item_data["unit_price"]),
                        "item_total": float(item_data["item_total"]),
                    }
                    for item_data in order_items_data
                ],
            },
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


# ============================================================
# GET MY ORDERS
# ============================================================

@router.get("/my-orders")
def get_my_orders(
    customer_id: int = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    orders = (
        db.query(Order)
        .filter(Order.customer_id == customer_id)
        .order_by(Order.created_at.desc())
        .all()
    )

    result = []

    for order in orders:

        items = (
            db.query(OrderItem)
            .filter(OrderItem.order_id == order.id)
            .all()
        )

        result.append(
            {
                "id": order.id,
                "status": order.status,
                "subtotal": float(order.subtotal),
                "discount_percentage": float(
                    order.discount_percentage
                ),
                "discount_amount": float(
                    order.discount_amount
                ),
                "total_amount": float(
                    order.total_amount
                ),
                "created_at": order.created_at,
                "items": [
                    {
                        "product_id": item.product_id,
                        "product_name": item.product_name,
                        "product_option_id": item.product_option_id,
                        "option_name": item.option_name,
                        "quantity": item.quantity,
                        "unit_price": float(item.unit_price),
                        "item_total": float(item.item_total),
                    }
                    for item in items
                ],
            }
        )

    return {
        "customer_id": customer_id,
        "orders": result,
    }


# ============================================================
# GET SINGLE ORDER - CUSTOMER PROTECTED
# ============================================================

@router.get("/{order_id}")
def get_order(
    order_id: int,
    customer_id: int = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    order = (
        db.query(Order)
        .filter(
            Order.id == order_id,
            Order.customer_id == customer_id,
        )
        .first()
    )

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found",
        )

    items = (
        db.query(OrderItem)
        .filter(OrderItem.order_id == order.id)
        .all()
    )

    return {
        "id": order.id,
        "customer_id": order.customer_id,
        "status": order.status,
        "subtotal": float(order.subtotal),
        "discount_percentage": float(
            order.discount_percentage
        ),
        "discount_amount": float(
            order.discount_amount
        ),
        "total_amount": float(
            order.total_amount
        ),
        "created_at": order.created_at,
        "items": [
            {
                "product_id": item.product_id,
                "product_name": item.product_name,
                "product_option_id": item.product_option_id,
                "option_name": item.option_name,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price),
                "item_total": float(item.item_total),
            }
            for item in items
        ],
    }