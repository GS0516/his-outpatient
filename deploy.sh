#!/usr/bin/env bash
# ==========================================================================
# HIS · 门诊医生工作站 · 一键部署（阿里云 / 腾讯云 / 任意 Linux）
#   用法：bash deploy.sh [安装目录]
#   默认安装到 /opt/his-outpatient，监听 8080
# ==========================================================================
set -euo pipefail

DIR="${1:-/opt/his-outpatient}"
REPO="${REPO:-https://github.com/GS0516/his-outpatient.git}"
PORT=8080

say() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }

say "1/5 检查 Docker"
if ! command -v docker >/dev/null 2>&1; then
  echo "未安装 Docker，使用阿里云镜像安装..."
  curl -fsSL https://get.docker.com | bash -s -- --mirror Aliyun
  systemctl enable --now docker
fi
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "Docker Compose 不可用，尝试安装插件..."
  dnf install -y docker-compose-plugin 2>/dev/null || apt-get install -y docker-compose-plugin 2>/dev/null || true
  DC="docker compose"
fi

say "2/5 获取代码"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  mkdir -p "$(dirname "$DIR")"
  git clone --depth 1 "$REPO" "$DIR"
fi
cd "$DIR"

say "3/5 生成配置"
if [ ! -f .env ]; then
  cp .env.example .env
  SECRET=$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | cut -c1-48)
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${SECRET}|" .env
  sed -i "s|^ALLOW_ORIGINS=.*|ALLOW_ORIGINS=http://localhost:${PORT}|" .env
  echo "已生成 .env（JWT_SECRET 随机 48 位）"
else
  echo ".env 已存在，跳过"
fi

say "4/5 构建并启动"
$DC up -d --build
sleep 6
$DC ps

say "5/5 检查"
if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
  echo "本机健康检查通过"
else
  echo "健康检查未通过，查看日志：$DC logs --tail 80 api"
fi

# 系统防火墙（若开启）
if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --add-port=${PORT}/tcp --permanent >/dev/null && firewall-cmd --reload >/dev/null
  echo "已放行 firewalld ${PORT}/tcp"
fi

IP=$(curl -s --max-time 5 https://ifconfig.me || true)
echo
echo "=========================================================="
echo " 部署完成"
echo " 访问地址：http://${IP:-<你的公网IP>}:${PORT}"
echo " 账号：doctor / Doctor@123   admin / Admin@123"
echo
echo " 如果打不开，去云控制台「安全组」放行 ${PORT} 端口"
echo " 常用命令：cd $DIR && $DC logs -f api   /   $DC restart"
echo "=========================================================="
