@echo off
cd /d "%~dp0"
if not exist backend\.venv (echo Run setup.bat first. & pause & exit /b 1)
start "PyroAQ API" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"
start "PyroAQ Web" cmd /k "cd /d "%~dp0frontend" && npm run dev"
echo Starting PyroAQ... the browser opens in a few seconds.
timeout /t 7 /nobreak >nul
start "" http://localhost:5173
