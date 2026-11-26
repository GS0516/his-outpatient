@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   HIS · 环境初始化（只需运行一次）
echo   --------------------------------------------
echo   [1/3] 创建 Python 虚拟环境
if not exist .venv (
  py -m venv .venv || python -m venv .venv
)
echo   [2/3] 安装后端依赖
call .venv\Scripts\python.exe -m pip install --upgrade pip >nul
call .venv\Scripts\python.exe -m pip install -r server\requirements.txt
echo   [3/3] 安装前端依赖
cd web
if exist pnpm-lock.yaml (
  call pnpm install
) else (
  call npm install
)
cd ..
echo.
echo   完成。双击 dev.bat 启动。
pause
