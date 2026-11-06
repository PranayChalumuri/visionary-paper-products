# Visionary Paper Products — Admin Portal

The admin portal uses the same FastAPI backend and is intended for the business owner/operator.

## Local run

Serve the project with Node.js/`npx serve` or another static server. The dashboard automatically calls FastAPI on the same hostname at port `8000`.

Admin demo credentials for the current local build:

- Mobile: `9876543210`
- PIN: `654321`

## Dashboard functions

- Business overview
- Sales value for today, yesterday, a selected date, or a date range
- Live pending queue
- Complete pending orders
- Standard order management
- Custom order management
- Protected download of customer-uploaded PDFs/designs
- Inventory management
- Customer directory

Sales value is order value. Payment collection is not connected yet.
