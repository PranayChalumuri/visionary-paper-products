from decimal import Decimal

from app.database import SessionLocal
from app.models import Inventory, Product, ProductOption


CATALOG = [
    ("Short Notes Book", "Plain white / ruled short notes book.", "Books", Decimal("0.00"), False, False,
     [("50 pages", Decimal("10.00")), ("100 pages", Decimal("20.00")), ("150 pages", Decimal("30.00")), ("200 pages", Decimal("40.00"))]),
    ("Crown Size", "Crown-size paper book.", "Standard", Decimal("30.00"), False, False, []),
    ("Regular Long", "Regular long paper book.", "Standard", Decimal("50.00"), False, False, []),
    ("Bar Long", "Bar long paper book.", "Standard", Decimal("70.00"), False, False, []),
    ("A4 Size Paper Set", "A4 size paper set.", "Paper", Decimal("230.00"), False, False, []),
    ("7kg Long Set Paper", "7kg long set paper.", "Paper", Decimal("50.00"), False, False, []),
    ("Maha Bar Long (8kg)", "Maha bar long 8kg paper product.", "Paper", Decimal("90.00"), False, False, []),
    ("OSR Sheets", "OSR sheets for record sets.", "Record", Decimal("100.00"), False, False, []),
    ("Thin OSR Sheets", "Thin OSR sheets for records.", "Record", Decimal("40.00"), False, False, []),
    ("Thick OSR Sheets", "Thick OSR sheets for records.", "Record", Decimal("50.00"), False, False, []),
    ("Files (Record)", "Files for record purposes.", "Record", Decimal("60.00"), False, False, []),
    ("Customized Books", "Customized books printed from customer-provided PDF.", "Custom", Decimal("1.00"), True, False, []),
    ("Exam Pads", "Customized exam pads with school or college title and logo/design.", "Custom", Decimal("0.00"), False, True,
     [("50 sets", Decimal("50.00")), ("100 sets", Decimal("100.00")), ("150 sets", Decimal("150.00")), ("200 sets", Decimal("200.00"))]),
    ("Rough Books", "Rough books made using recyclable newsprint.", "Books", Decimal("0.00"), False, False,
     [("50 pages", Decimal("50.00")), ("100 pages", Decimal("100.00")), ("150 pages", Decimal("150.00")), ("200 pages", Decimal("200.00"))]),
]


def seed_catalog(default_stock: int = 100, low_stock_threshold: int = 10):
    db = SessionLocal()
    try:
        for name, description, category, base_price, requires_pdf, requires_design, options in CATALOG:
            product = db.query(Product).filter(Product.name == name).first()
            if not product:
                product = Product(
                    name=name,
                    description=description,
                    category=category,
                    base_price=base_price,
                    requires_pdf=requires_pdf,
                    requires_design=requires_design,
                    is_active=True,
                )
                db.add(product)
                db.flush()
                print(f"Added product: {name}")
            else:
                product.description = description
                product.category = category
                product.base_price = base_price
                product.requires_pdf = requires_pdf
                product.requires_design = requires_design
                product.is_active = True
                print(f"Verified product: {name} (id={product.id})")

            for option_name, price in options:
                option = db.query(ProductOption).filter(
                    ProductOption.product_id == product.id,
                    ProductOption.option_name == option_name,
                ).first()
                if not option:
                    db.add(ProductOption(product_id=product.id, option_name=option_name, price=price, is_active=True))
                    print(f"  Added option: {option_name}")
                else:
                    option.price = price
                    option.is_active = True

            if not requires_pdf and not requires_design:
                inventory = db.query(Inventory).filter(Inventory.product_id == product.id).first()
                if not inventory:
                    db.add(Inventory(product_id=product.id, stock_quantity=default_stock, low_stock_threshold=low_stock_threshold, is_active=True))
                    print(f"  Added inventory: {default_stock}")
                else:
                    # Preserve the current stock count; only ensure the row is orderable.
                    inventory.is_active = True
                    if inventory.low_stock_threshold is None:
                        inventory.low_stock_threshold = low_stock_threshold

        db.commit()
        print("Catalog verification completed.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_catalog()
