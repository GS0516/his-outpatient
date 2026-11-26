#!/usr/bin/env bash
# ==========================================================================
# HIS · 无 Docker 部署（低配服务器 / 1G 内存）
#   适用：阿里云 Alibaba Cloud Linux 3、CentOS 8+、Anolis 8（python3.6 老系统）
#   用法：把仓库放到 /opt/his 后执行  bash deploy-native.sh
#   产出：systemd 服务 his，监听 8080，SQLite 在 /opt/his/data/his.db
# ==========================================================================
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-8080}"
PY="${PY:-python3.11}"

say() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }

say "1/5 检查 Python 3.11"
if ! command -v "$PY" >/dev/null 2>&1; then
  if command -v dnf >/dev/null 2>&1; then
    dnf install -y python3.11 python3.11-pip
  else
    echo "请先安装 python3.11 后重试"; exit 1
  fi
fi
"$PY" -V

say "2/5 创建虚拟环境并安装依赖（清华源）"
cd "$DIR"
[ -d venv ] || "$PY" -m venv venv
./venv/bin/pip install -q -i https://pypi.tuna.tsinghua.edu.cn/simple --upgrade pip
./venv/bin/pip install -q -i https://pypi.tuna.tsinghua.edu.cn/simple -r server/requirements.txt

say "3/5 准备前端产物"
if [ ! -f web/dist/index.html ]; then
  echo "缺少 web/dist，请在本机构建后上传（pnpm build），或用 Docker 方案"
  exit 1
fi

say "4/5 写入 systemd 服务"
mkdir -p "$DIR/data"
if [ ! -f /etc/his.env ]; then
  SECRET=$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | cut -c1-48)
  cat > /etc/his.env <<EOF
DATABASE_URL=sqlite:///$DIR/data/his.db
STATIC_DIR=$DIR/web/dist
JWT_SECRET=$SECRET
ALLOW_ORIGINS=http://127.0.0.1:$PORT
PYTHONUNBUFFERED=1
EOF
  chmod 600 /etc/his.env
fi

cat > /etc/systemd/system/his.service <<EOF
[Unit]
Description=HIS Outpatient Workstation
After=network.target

[Service]
Type=simple
WorkingDirectory=$DIR/server
EnvironmentFile=/etc/his.env
ExecStart=$DIR/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now his

say "5/5 健康检查"
sleep 5
systemctl is-active his
curl -fsS "http://127.0.0.1:$PORT/api/health" && echo

IP=$(curl -s --max-time 5 https://ifconfig.me || true)
echo
echo "=========================================================="
echo " 访问地址：http://${IP:-<公网IP>}:$PORT"
echo " 账号：doctor / Doctor@123   admin / Admin@123"
echo " 记得在云控制台安全组放行 $PORT 端口"
echo " 日志：journalctl -u his -f"
echo " 重启：systemctl restart his"
echo "=========================================================="
