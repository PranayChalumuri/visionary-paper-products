# Azure App Service package

Deploy the contents of this directory as the App Service application root. It contains the FastAPI package in `app/` and the matching frontend in `website/`. Configure `DATABASE_URL`, `SECRET_KEY`, and `UPLOAD_DIR=/home/data/uploads` in App Service Configuration. Use `bash startup.sh` as the startup command if needed.

The application serves frontend and API from the same origin. Text responses are explicitly marked UTF-8. Check `/db-test` after deployment; PostgreSQL `server_encoding` should be `UTF8`.
