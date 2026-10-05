@echo off
cd /d "%~dp0"
echo.
echo  Setting up PyroAQ. This takes a few minutes the first time.
echo.
where python >nul 2>nul || (echo Python is not installed. Install Python 3.11 or 3.12 from python.org and tick "Add python.exe to PATH". & pause & exit /b 1)
where npm >nul 2>nul || (echo Node.js is not installed. Install the LTS version from nodejs.org. & pause & exit /b 1)
cd backend
if not exist .venv python -m venv .venv
call .venv\Scripts\activate
python -m pip install --upgrade pip >nul
pip install -r requirements.txt || goto :fail
if not exist .env copy ..\.env.example .env >nul
if not exist data\raw\city_day.csv (python -m ml.make_demo_data || goto :fail)
python -m ml.build_dataset || goto :fail
python -m ml.train || goto :fail
cd ..\frontend
call npm install --no-audit --no-fund || goto :fail
cd ..
echo.
echo  Setup finished. Double-click run.bat to start PyroAQ.
pause
exit /b 0
:fail
echo.
echo  Setup stopped because of the error above.
pause
exit /b 1
