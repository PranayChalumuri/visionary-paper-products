# Visionary Paper Products

A full-stack e-commerce platform for a paper products business, featuring a responsive storefront, product catalogue, order management, inventory validation, and an administrative interface.

Built with **Python, FastAPI, PostgreSQL, SQLAlchemy, HTML, CSS, JavaScript, Bootstrap, and Microsoft Azure**.

## Project Overview

Visionary Paper Products provides a digital platform for customers to explore paper products, select available options, and place standard or customized orders. The application also includes administrative functionality for managing products, inventory, and orders.

## Features

### Customer Storefront
- Responsive product catalogue and product options.
- Shopping basket and order placement.
- Standard and customized order workflows.
- Customer order history.
- Indian Rupee (INR) price display.

### Backend and Database
- REST API built with FastAPI.
- PostgreSQL database integration using SQLAlchemy.
- Product, customer, order, and inventory management.
- Inventory validation during order processing.
- Configurable customer-upload storage.

### Administration
- Administrative login.
- Dashboard for operational management.
- Product, inventory, and order-related functionality.

### Deployment
- Azure App Service deployment package.
- Environment-based application configuration.
- Persistent upload storage configuration.
- UTF-8 response handling and frontend cache management.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | HTML5, CSS3, JavaScript, Bootstrap |
| Backend | Python, FastAPI, Uvicorn |
| Database | PostgreSQL, SQLAlchemy |
| Deployment | Microsoft Azure App Service |
| Development | Git, GitHub, PowerShell |

## Repository Structure

```text
visionary-paper-products/
├── backend/                 # Main FastAPI application
│   ├── app/
│   │   ├── models/
│   │   ├── routers/
│   │   ├── schemas/
│   │   └── services/
│   ├── .env.example
│   └── requirements.txt
│
├── website/                 # Main customer and admin frontend
│   ├── admin/
│   ├── assets/
│   ├── css/
│   ├── js/
│   └── index.html
│
├── azure-deploy/            # Azure App Service deployment package
│   ├── app/
│   ├── website/
│   ├── requirements.txt
│   └── startup.sh
│
├── .gitignore
├── .gitattributes
└── README.md
```

The `backend/` and `website/` directories contain the main development source. `azure-deploy/` contains the corresponding deployment-ready application package.

## Local Setup

### Prerequisites

- Python 3.12 or a compatible Python version.
- PostgreSQL.
- Node.js and npm (for serving the frontend locally).

### 1. Configure the backend

Open PowerShell in the repository root:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` with your local PostgreSQL connection and a unique application secret.

Example configuration format:

```env
DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/visionary_paper_db
SECRET_KEY=YOUR_UNIQUE_RANDOM_SECRET
UPLOAD_DIR=./uploads
```

Create the PostgreSQL database named `visionary_paper_db` before starting the application.

### 2. Initialize the catalogue

From the `backend/` directory:

```powershell
.\.venv\Scripts\python.exe -m seed_catalog
```

The catalogue seeding script can create missing inventory records with a default stock quantity. Use it only with the intended local database and verify inventory values before testing.

### 3. Start the backend

From the `backend/` directory:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

API documentation:

`http://127.0.0.1:8000/docs`

### 4. Start the frontend

Open a second PowerShell window:

```powershell
cd website
npx serve -l 5500
```

Open:

`http://localhost:5500`

Other local routes:

- Admin login: `http://localhost:5500/admin/login.html`
- API documentation: `http://127.0.0.1:8000/docs`

## Azure Deployment

The `azure-deploy/` directory is prepared as the application root for Azure App Service deployment.

Configure the following Application Settings in Azure:

| Setting | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string with SSL enabled |
| `SECRET_KEY` | Unique application secret |
| `UPLOAD_DIR` | Persistent upload directory, such as `/home/data/uploads` |
| `WEBSITES_PORT` | Set to `8000` if required by the hosting configuration |

Use `bash startup.sh` as the startup command if the App Service configuration requires it.

Never commit actual database credentials, application secrets, Azure publish profiles, or customer-uploaded documents.

## Configuration and Security

- Copy `backend/.env.example` to `backend/.env` for local configuration.
- Keep environment-specific secrets outside source control.
- Use unique secrets for each environment.
- Do not commit customer uploads or database backups.
- Configure persistent storage for uploads in production.

## Current Project Status

The project includes the customer-facing storefront, FastAPI backend, PostgreSQL integration, administrative pages, and an Azure deployment package.

Deployment and configuration should be verified against the target environment before making production changes.

## Author

**Pranay Kumar Chalumuri**

GitHub: [PranayChalumuri](https://github.com/PranayChalumuri)
