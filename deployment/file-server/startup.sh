#!/bin/bash
export APP_ENV=production/app/
cd /app/service-plus-file-server && uvicorn app.main:app --host 0.0.0.0 --port 9000 --reload
