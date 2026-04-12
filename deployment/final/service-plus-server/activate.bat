@echo off
REM Activate virtual environment for Service Plus Server
echo Activating virtual environment...
call c:\projects\service-plus\env\Scripts\activate.bat
echo.
echo Virtual environment activated!
echo Python: %VIRTUAL_ENV%\Scripts\python.exe
echo.
echo To run the server, use:
echo   python -m uvicorn app.main:app --reload
echo.
echo To deactivate, type: deactivate
