#!/bin/bash
cd /Users/oladimejishodipe/retomY/backend
source /Users/oladimejishodipe/retomY/.venv/bin/activate
exec python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
