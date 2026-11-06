from decimal import Decimal

from app.database import SessionLocal
from app.models import Product


def seed_customized_book():
    db = SessionLocal()

    try:
        existing_product = (
            db.query(Product)
            .filter(Product.name == "Customized Books")
            .first()
        )

        if existing_product:
            print("Customized Books already exists.")
            return

        product = Product(
            name="Customized Books",
            description="Customized books printed from customer-provided PDF.",
            category="Custom",
            base_price=Decimal("1.00"),
            requires_pdf=True,
            requires_design=False,
            is_active=True,
        )

        db.add(product)
        db.commit()

        print("Customized Books added successfully.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_customized_book()