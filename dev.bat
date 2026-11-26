@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo 未找到虚拟环境，请先运行 setup.bat
  pause
  exit /b 1
)
start "HIS API :8000" cmd /k "cd /d %~dp0server && ..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
start "HIS Web :5173" cmd /k "cd /d %~dp0web && npm run dev"
timeout /t 3 >nul
start "" http://localhost:5173
