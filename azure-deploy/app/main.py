from fastapi import Depends, FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from pathlib import Path

from app.database import Base, engine, get_db
from app.models import Customer, CustomOrder, Inventory, Order, OrderItem, Product, ProductOption
from app.routers.products import router as products_router
from app.routers.customers import router as customers_router
from app.routers.orders import router as orders_router
from app.routers.custom_orders import router as custom_orders_router
from app.routers.admin import router as admin_router
from app.routers.auth import router as auth_router
from app.routers.inventory import router as inventory_router


# Frontend location
APP_FILE = Path(__file__).resolve()
PROJECT_FRONTEND_DIR = APP_FILE.parents[2] / "website"
DEPLOY_FRONTEND_DIR = APP_FILE.parents[1] / "website"
DEPLOY_ROOT_DIR = APP_FILE.parents[1]

if DEPLOY_FRONTEND_DIR.is_dir():
    FRONTEND_DIR = DEPLOY_FRONTEND_DIR
elif PROJECT_FRONTEND_DIR.is_dir():
    FRONTEND_DIR = PROJECT_FRONTEND_DIR
else:
    FRONTEND_DIR = DEPLOY_ROOT_DIR


Base.metadata.create_all(bind=engine)

# Local-project migration: older databases do not have customer PIN hashes.
with engine.begin() as connection:
    connection.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255)"))
    connection.execute(text("ALTER TABLE custom_orders ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5,2) DEFAULT 10.00"))
    connection.execute(text("ALTER TABLE custom_orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0.00"))
    connection.execute(text("UPDATE custom_orders SET discount_percentage = 10.00 WHERE discount_percentage IS NULL"))
    connection.execute(text("UPDATE custom_orders SET discount_amount = 0.00 WHERE discount_amount IS NULL"))


app = FastAPI(
    title="Visionary Paper Products API",
    description="Backend API for Visionary Paper Products",
    version="2.0.0",
)

@app.middleware("http")
async def enforce_utf8_content_type(request, call_next):
    response = await call_next(request)
    content_type = response.headers.get("content-type", "")
    media_type = content_type.split(";", 1)[0].strip().lower()
    textual_types = {
        "application/javascript",
        "text/javascript",
        "application/json",
        "application/manifest+json",
        "image/svg+xml",
    }
    if (media_type.startswith("text/") or media_type in textual_types) and "charset=" not in content_type.lower():
        response.headers["content-type"] = f"{media_type}; charset=utf-8"
    response.headers["X-Content-Type-Options"] = "nosniff"
    request_path = request.url.path.lower()
    if request_path in {"/", "/index.html", "/sw.js"} or request_path.endswith((".html", ".js", ".css")):
        response.headers["Cache-Control"] = "no-cache"
    return response


# Local/LAN development CORS. Production should use the exact deployed frontend origin.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=(
        r"https?://(?:localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(?::\d+)?$"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")
app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")
app.mount("/login/assets", StaticFiles(directory=str(FRONTEND_DIR / "login" / "assets")), name="login-assets")
app.mount("/login/css", StaticFiles(directory=str(FRONTEND_DIR / "login" / "css")), name="login-css")
app.mount("/login/js", StaticFiles(directory=str(FRONTEND_DIR / "login" / "js")), name="login-js")
app.mount("/admin/css", StaticFiles(directory=str(FRONTEND_DIR / "admin" / "css")), name="admin-css")
app.mount("/admin/js", StaticFiles(directory=str(FRONTEND_DIR / "admin" / "js")), name="admin-js")

app.include_router(products_router)
app.include_router(customers_router)
app.include_router(orders_router)
app.include_router(custom_orders_router)
app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(inventory_router)


@app.get("/")
def root():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/login/login.html")
def customer_login_page():
    return FileResponse(FRONTEND_DIR / "login" / "login.html")


@app.get("/admin/login.html")
def admin_login_page():
    return FileResponse(FRONTEND_DIR / "admin" / "login.html")


@app.get("/admin/dashboard.html")
def admin_dashboard_page():
    return FileResponse(FRONTEND_DIR / "admin" / "dashboard.html")


@app.get("/manifest.webmanifest")
def manifest():
    return FileResponse(FRONTEND_DIR / "manifest.webmanifest")


@app.get("/sw.js")
def service_worker():
    return FileResponse(FRONTEND_DIR / "sw.js")


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/db-test")
def database_test(db: Session = Depends(get_db)):
    test_result = db.execute(text("SELECT 1")).scalar_one()
    server_encoding = None
    client_encoding = None
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        server_encoding = db.execute(text("SHOW server_encoding")).scalar_one_or_none()
        client_encoding = db.execute(text("SHOW client_encoding")).scalar_one_or_none()
    return {
        "database": "connected",
        "test_result": test_result,
        "server_encoding": server_encoding,
        "client_encoding": client_encoding,
        "rupee_sample": "₹",
        "rupee_codepoint": "U+20B9",
    }