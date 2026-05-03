#!/bin/bash
sudo nginx &
export APP_ENV=production
cd /usr/share/nginx/html/service-plus-server && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
