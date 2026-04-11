@echo off
REM Run Service Plus Server with virtual environment
echo Starting Service Plus Server...
c:\projects\service-plus\env\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
