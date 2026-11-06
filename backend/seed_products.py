from decimal import Decimal

from app.database import SessionLocal
from app.models import Product


products = [
    {
        "name": "Crown Size",
        "description": "Crown size paper/book product.",
        "category": "Standard",
        "base_price": Decimal("30.00"),
        "requires_pdf": False,
        "requires_design": False,
        "is_active": True,
    },
    {
        "name": "Regular Long",
        "description": "Regular long paper/book product.",
        "category": "Standard",
        "base_price": Decimal("50.00"),
        "requires_pdf": False,
        "requires_design": False,
        "is_active": True,
    },
    {
        "name": "Bar Long",
        "description": "Bar long paper/book product.",
        "category": "Standard",
        "base_price": Decimal("70.00"),
        "requires_pdf": False,
        "requires_design": False,
        "is_active": True,
    },
    {
        "name": "A4 Size Paper Set",
        "description": "A4 size paper set.",
        "category": "Paper",
        "base_price": Decimal("230.00"),
        "requires_pdf": False,
        "requires_design": False,
        "is_active": True,
    },
    {
        "name": "7kg Long Set Paper",
        "description": "7kg long set paper.",
        "category": "Paper",
        "base_price": Decimal("50.00"),
        "requires_pdf": False,
        "requires_design": False,
        "is_active": True,
    },
    {
        "name": "Maha Bar Long (8kg)",
        "description": "Maha bar long 8kg paper product.",
        "category": "Paper",
        "base_price": Decimal("90.00"),
        "requires_pdf": False,
        "requires_design": False,
        "is_active": True,
    },
    {
        "name": "OSR Sheets",
        "description": "OSR sheets for record sets.",
        "category": "Record",
        "base_price": Decimal("100.00"),
        "requires_pdf": False,
        "requires_design": False,
        "is_active": True,
    },
    {
        "name": "Thin OSR Sheets",
        "description": "Thin OSR sheets for records.",
        "category": "Record",
        "base_price": Decimal("40.00"),
        "requires_pdf": False,
        "requires_design": False,
        "is_active": True,
    },
    {
        "name": "Thick OSR Sheets",
        "description": "Thick OSR sheets for records.",
        "category": "Record",
        "base_price": Decimal("50.00"),
        "requires_pdf": False,
        "requires_design": False,
        "is_active": True,
    },
    {
        "name": "Files (Record)",
        "description": "Files for record purposes.",
        "category": "Record",
        "base_price": Decimal("60.00"),
        "requires_pdf": False,
        "requires_design": False,
        "is_active": True,
    },
]


def seed_products():
    db = SessionLocal()

    try:
        for product_data in products:
            existing_product = (
                db.query(Product)
                .filter(Product.name == product_data["name"])
                .first()
            )

            if existing_product:
                print(f"Already exists: {existing_product.name}")
                continue

            product = Product(**product_data)
            db.add(product)
            print(f"Added: {product_data['name']}")

        db.commit()
        print("\nProduct seeding completed successfully.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_products()