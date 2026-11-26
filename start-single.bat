@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo 未找到虚拟环境，请先运行 setup.bat
  pause
  exit /b 1
)
if not exist web\dist\index.html (
  echo 正在构建前端...
  pushd web
  call npm run build
  popd
)
echo.
echo   单服务模式：http://localhost:8000  （前端 + API 同一个端口）
echo   需要公网地址时，另开窗口执行：
echo     cloudflared tunnel --url http://localhost:8000
echo.
set STATIC_DIR=%~dp0web\dist
cd server
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
pause
