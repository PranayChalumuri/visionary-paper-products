from decimal import Decimal

from pydantic import BaseModel, Field


class OrderItemCreate(BaseModel):
    product_id: int
    product_option_id: int | None = None
    quantity: int = Field(gt=0)


class OrderCreate(BaseModel):
    items: list[OrderItemCreate] = Field(min_length=1)


class OrderItemResponse(BaseModel):
    product_id: int
    product_name: str
    product_option_id: int | None
    option_name: str | None
    quantity: int
    unit_price: Decimal
    item_total: Decimal


class OrderResponse(BaseModel):
    id: int
    customer_id: int
    status: str
    subtotal: Decimal
    discount_percentage: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    items: list[OrderItemResponse]