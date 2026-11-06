# Fixes and verification status

## Source-level verification performed

- Repaired the UTF-8 mojibake found in maintained storefront/admin/login files.
- Confirmed all HTML pages declare UTF-8.
- Confirmed the rupee symbol is represented safely in JavaScript (`\u20B9`) and static HTML (`&#8377;`).
- Confirmed local admin logo references resolve to `website/assets/visionary-logo.svg`.
- Confirmed the Azure package has the same frontend and backend application source as the local project.
- Updated the service-worker cache key to invalidate stale browser assets.
- Updated standard order stock validation to aggregate quantities by product and lock inventory rows during order creation.
- Updated the browser basket so already-confirmed order lines are not submitted again after a partial multi-order failure.
- Updated catalogue seeding to preserve stock while reactivating existing inventory rows.
- Removed `.env` secrets, publish profiles, local virtual environments, logs, and user-uploaded sample PDFs from the release archive.
- Ran Python bytecode compilation, Node.js syntax checks for every frontend JavaScript file, UTF-8/mojibake scans, HTML local-asset reference checks, admin-logo path checks, and local/Azure source-copy consistency checks.

## Checks still requiring the user's environment

The ZIP cannot verify a live PostgreSQL instance, customer login, Azure Application Settings, Azure filesystem persistence, or a real customer order. Run the local checklist in `README.md` against the local database first. Do not point local tests at Azure production data.
