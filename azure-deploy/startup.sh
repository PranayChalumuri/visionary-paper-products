
#!/usr/bin/env bash
set -eu

APP_DIR="${APP_PATH:-/home/site/wwwroot}"

echo "===== APPLICATION STARTUP ====="
echo "APP_DIR=$APP_DIR"

echo "===== NORMALIZING APPLICATION PATHS ====="

python - "$APP_DIR" <<'PY'
import os
import sys

root = os.path.abspath(sys.argv[1])
fixed = 0

for current, dirs, files in os.walk(root, topdown=False):
    for name in dirs + files:
        if "\\" not in name:
            continue

        source = os.path.join(current, name)
        parts = [p for p in name.split("\\") if p not in ("", ".", "..")]

        if not parts:
            continue

        destination = os.path.join(current, *parts)
        os.makedirs(os.path.dirname(destination), exist_ok=True)

        if not os.path.exists(destination):
            os.replace(source, destination)
            print("Normalized:", name)
            fixed += 1

print("Total normalized paths:", fixed)
PY

if [ ! -f "$APP_DIR/app/main.py" ]; then
    echo "ERROR: app/main.py not found."
    echo "Application directory contents:"
    ls -la "$APP_DIR"
    exit 1
fi

cd "$APP_DIR"

export PYTHONPATH="$APP_DIR:${PYTHONPATH:-}"
export UPLOAD_DIR="${UPLOAD_DIR:-/home/data/uploads}"

mkdir -p "$UPLOAD_DIR"

echo "Application directory verified."
echo "Starting FastAPI..."

exec python -m uvicorn app.main:app --app-dir "$APP_DIR" --host 0.0.0.0 --port "${PORT:-8000}"
