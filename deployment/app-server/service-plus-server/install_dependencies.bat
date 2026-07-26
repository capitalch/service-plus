@echo off
REM Install dependencies in virtual environment
echo Installing dependencies...
c:\projects\service-plus\env\Scripts\python.exe -m pip install -r requirements.txt
echo.
echo Dependencies installed successfully!
pause
