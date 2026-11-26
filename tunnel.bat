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

echo [1/2] 启动单服务（前端 + API）: http://localhost:8000
start "HIS API 8000" cmd /k "set STATIC_DIR=%~dp0web\dist&& cd /d %~dp0server && ..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
timeout /t 3 >nul

echo [2/2] 启动 Cloudflare 隧道，窗口里会打印 https://xxx.trycloudflare.com
if exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" (
  start "HIS 隧道" cmd /k "cd /d \"C:\Program Files (x86)\cloudflared\" && cloudflared.exe tunnel --url http://localhost:8000 --protocol http2 --edge 198.41.192.167:7844"
) else (
  echo 未找到 cloudflared，请先执行：
  echo   winget install --id Cloudflare.cloudflared -e
  pause
  exit /b 1
)
timeout /t 5 >nul
start "" http://localhost:8000
