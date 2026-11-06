from decimal import Decimal

from app.database import SessionLocal
from app.models import Product, ProductOption


product_options = {
    "Short Notes Book": [
        ("50 pages", Decimal("10.00")),
        ("100 pages", Decimal("20.00")),
        ("150 pages", Decimal("30.00")),
        ("200 pages", Decimal("40.00")),
    ],
    "Exam Pads": [
        ("50 sets", Decimal("50.00")),
        ("100 sets", Decimal("100.00")),
        ("150 sets", Decimal("150.00")),
        ("200 sets", Decimal("200.00")),
    ],
    "Rough Books": [
        ("50 pages", Decimal("50.00")),
        ("100 pages", Decimal("100.00")),
        ("150 pages", Decimal("150.00")),
        ("200 pages", Decimal("200.00")),
    ],
}


def seed_products_and_options():
    db = SessionLocal()

    try:
        for product_name, options in product_options.items():

            product = (
                db.query(Product)
                .filter(Product.name == product_name)
                .first()
            )

            if not product:
                if product_name == "Exam Pads":
                    product = Product(
                        name="Exam Pads",
                        description="Customized exam pads with school or college title and logo/design.",
                        category="Custom",
                        base_price=Decimal("0.00"),
                        requires_pdf=False,
                        requires_design=True,
                        is_active=True,
                    )

                elif product_name == "Short Notes Book":
                    product = Product(
                        name="Short Notes Book",
                        description="Plain white or ruled short notes book.",
                        category="Books",
                        base_price=Decimal("0.00"),
                        requires_pdf=False,
                        requires_design=False,
                        is_active=True,
                    )

                elif product_name == "Rough Books":
                    product = Product(
                        name="Rough Books",
                        description="Rough books made using recyclable newsprint.",
                        category="Books",
                        base_price=Decimal("0.00"),
                        requires_pdf=False,
                        requires_design=False,
                        is_active=True,
                    )

                db.add(product)
                db.flush()

                print(f"Added product: {product_name}")

            else:
                print(f"Product already exists: {product_name}")

            for option_name, price in options:

                existing_option = (
                    db.query(ProductOption)
                    .filter(
                        ProductOption.product_id == product.id,
                        ProductOption.option_name == option_name,
                    )
                    .first()
                )

                if existing_option:
                    print(
                        f"  Option already exists: "
                        f"{product_name} - {option_name}"
                    )
                    continue

                option = ProductOption(
                    product_id=product.id,
                    option_name=option_name,
                    price=price,
                    is_active=True,
                )

                db.add(option)

                print(
                    f"  Added option: "
                    f"{option_name} - ₹{price}"
                )

        db.commit()

        print("\nProduct and option seeding completed successfully.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_products_and_options()