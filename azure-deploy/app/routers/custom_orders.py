from decimal import Decimal
from io import BytesIO
from pathlib import Path
import os
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pypdf import PdfReader
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CustomOrder, Customer, Product, ProductOption
from app.services.auth import get_current_customer


router = APIRouter(prefix="/custom-orders", tags=["Custom Orders"])
BASE_UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(Path(__file__).resolve().parents[2] / "uploads"))).expanduser().resolve()
ALLOWED_EXAM_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".pdf"}


def customer_or_404(customer_id: int, db: Session):
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.is_active == True).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.post("/customized-book")
async def create_customized_book_order(
    copies: int = Form(...),
    pdf_file: UploadFile = File(...),
    customer_id: int = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    if copies <= 0:
        raise HTTPException(status_code=400, detail="Copies must be greater than zero")
    customer = customer_or_404(customer_id, db)
    filename = Path(pdf_file.filename or "").name
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Customized Books require a PDF file")

    file_data = await pdf_file.read()
    if not file_data:
        raise HTTPException(status_code=400, detail="Uploaded PDF is empty")
    if len(file_data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF file is too large. Maximum size is 25 MB.")

    try:
        page_count = len(PdfReader(BytesIO(file_data)).pages)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or unreadable PDF file")
    if page_count <= 0:
        raise HTTPException(status_code=400, detail="PDF must contain at least one page")

    product = db.query(Product).filter(Product.name == "Customized Books", Product.is_active == True).first()
    if not product:
        product = Product(
            name="Customized Books", description="Customized books printed from customer-provided PDF.",
            category="Custom", base_price=Decimal("1.00"), requires_pdf=True, requires_design=False, is_active=True,
        )
        db.add(product)
        db.flush()

    upload_dir = BASE_UPLOAD_DIR / "customized_books"
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_filename = f"{uuid4()}_{filename}"
    file_path = upload_dir / stored_filename
    file_path.write_bytes(file_data)

    unit_price = Decimal("1.00")
    subtotal = Decimal(page_count) * Decimal(copies) * unit_price
    discount_percentage = Decimal("10.00")
    discount_amount = subtotal * discount_percentage / Decimal("100")
    total_amount = subtotal - discount_amount
    custom_order = CustomOrder(
        customer_id=customer.id, order_type="Customized Book", product_id=product.id,
        file_name=filename, file_path=str(file_path), page_count=page_count, copies=copies,
        unit_price=unit_price, discount_percentage=discount_percentage,
        discount_amount=discount_amount, total_amount=total_amount, status="Pending",
    )
    db.add(custom_order)
    try:
        db.commit()
        db.refresh(custom_order)
    except Exception:
        db.rollback()
        raise

    return {
        "message": "Customized Book order created successfully",
        "custom_order": {
            "id": custom_order.id, "customer_id": customer.id, "order_type": custom_order.order_type,
            "file_name": custom_order.file_name, "page_count": page_count, "copies": copies,
            "price_per_page_per_copy": float(unit_price), "subtotal": float(subtotal),
            "discount_percentage": float(discount_percentage), "discount_amount": float(discount_amount),
            "total_amount": float(total_amount), "status": custom_order.status,
        },
    }


@router.post("/exam-pad")
async def create_exam_pad_order(
    product_option_id: int = Form(...),
    copies: int = Form(...),
    school_college_name: str = Form(...),
    design_file: UploadFile = File(...),
    customer_id: int = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    customer = customer_or_404(customer_id, db)
    if copies <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")
    school_college_name = school_college_name.strip()
    if not school_college_name:
        raise HTTPException(status_code=400, detail="School or college name is required")

    product = db.query(Product).filter(Product.name == "Exam Pads", Product.is_active == True).first()
    if not product:
        raise HTTPException(status_code=404, detail="Exam Pads product not found")
    option = db.query(ProductOption).filter(
        ProductOption.id == product_option_id,
        ProductOption.product_id == product.id,
        ProductOption.is_active == True,
    ).first()
    if not option:
        raise HTTPException(status_code=404, detail="Exam Pad option not found")

    filename = Path(design_file.filename or "").name
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXAM_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Exam Pad design must be PNG, JPG, JPEG, WEBP, or PDF")
    file_data = await design_file.read()
    if not file_data:
        raise HTTPException(status_code=400, detail="Uploaded design file is empty")
    if len(file_data) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Design file is too large. Maximum size is 15 MB.")

    if extension == ".pdf":
        try:
            page_count = len(PdfReader(BytesIO(file_data)).pages)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid or unreadable Exam Pad PDF")
        if page_count != 1:
            raise HTTPException(status_code=400, detail="Exam Pad PDF must contain exactly one page")

    upload_dir = BASE_UPLOAD_DIR / "exam_pads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_filename = f"{uuid4()}_{filename}"
    file_path = upload_dir / stored_filename
    file_path.write_bytes(file_data)

    subtotal = option.price * copies
    discount_percentage = Decimal("10.00")
    discount_amount = subtotal * discount_percentage / Decimal("100")
    total_amount = subtotal - discount_amount
    custom_order = CustomOrder(
        customer_id=customer.id, order_type="Exam Pad", product_id=product.id, product_option_id=option.id,
        file_name=filename, file_path=str(file_path), page_count=None, copies=copies,
        unit_price=option.price, discount_percentage=discount_percentage,
        discount_amount=discount_amount, total_amount=total_amount,
        school_college_name=school_college_name, status="Pending",
    )
    db.add(custom_order)
    try:
        db.commit()
        db.refresh(custom_order)
    except Exception:
        db.rollback()
        raise

    return {
        "message": "Exam Pad order created successfully",
        "custom_order": {
            "id": custom_order.id, "customer_id": customer.id, "order_type": custom_order.order_type,
            "school_college_name": school_college_name, "file_name": filename,
            "option_name": option.option_name, "quantity": copies,
            "unit_price": float(option.price), "subtotal": float(subtotal),
            "discount_percentage": float(discount_percentage), "discount_amount": float(discount_amount),
            "total_amount": float(custom_order.total_amount), "status": custom_order.status,
        },
    }


@router.get("/my-orders")
def get_my_custom_orders(customer_id: int = Depends(get_current_customer), db: Session = Depends(get_db)):
    rows = db.query(CustomOrder).filter(CustomOrder.customer_id == customer_id).order_by(CustomOrder.created_at.desc()).all()
    return [
        {
            "id": row.id, "order_type": row.order_type, "file_name": row.file_name,
            "page_count": row.page_count, "copies": row.copies, "school_college_name": row.school_college_name,
            "unit_price": float(row.unit_price), "discount_percentage": float(row.discount_percentage or 0),
            "discount_amount": float(row.discount_amount or 0), "total_amount": float(row.total_amount),
            "status": row.status, "created_at": row.created_at,
        }
        for row in rows
    ]


@router.get("/{custom_order_id}")
def get_custom_order(custom_order_id: int, customer_id: int = Depends(get_current_customer), db: Session = Depends(get_db)):
    row = db.query(CustomOrder).filter(CustomOrder.id == custom_order_id, CustomOrder.customer_id == customer_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Custom order not found")
    return {
        "id": row.id, "order_type": row.order_type, "file_name": row.file_name, "file_path": row.file_path,
        "page_count": row.page_count, "copies": row.copies, "school_college_name": row.school_college_name,
        "unit_price": float(row.unit_price), "discount_percentage": float(row.discount_percentage or 0),
        "discount_amount": float(row.discount_amount or 0), "total_amount": float(row.total_amount),
        "status": row.status, "created_at": row.created_at,
    }
