---
title: 门诊医生工作站
emoji: 🏥
colorFrom: blue
colorTo: green
sdk: docker
app_port: 8000
pinned: false
---

# 门诊医生工作站 · 第三章功能规范实现

按《医院信息系统基本功能规范》**第三章**实现的完整前后端系统：
**React + Vite** 前端、**FastAPI + SQLAlchemy + SQLite** 后端、**pytest** 测试、**Docker Compose** 部署、**GitHub Actions** CI。
只做第三章（门诊医生工作站），不含挂号、收费、药房、住院等其它分系统。

---

## 一、快速开始

### 方式 A：本地开发（两个终端）

```bash
# 1) 后端
cd server
python -m venv .venv && .venv\Scripts\activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2) 前端
cd web
pnpm install          # 或 npm install
pnpm dev              # → http://localhost:5173（自动代理 /api）
```

Windows 下可直接双击：`setup.bat`（首次安装）→ `dev.bat`（同时起前后端并打开浏览器）。

### 方式 B：Docker（一条命令）

```bash
cp .env.example .env          # 填 JWT_SECRET；不填也能起（演示默认值）
docker compose up -d --build  # → http://localhost:8080
```

`web` 由 nginx 托管并反代 `/api` 到 `api` 容器；SQLite 数据落在 `his_data` 卷。
需要 PostgreSQL 时：`docker compose --profile postgres up -d` 并把 `.env` 的 `DATABASE_URL` 指向 `db`。

### 账号

| 角色 | 账号 | 口令 | 能做什么 |
|---|---|---|---|
| 医生 | `doctor` | `Doctor@123` | 接诊、写病历、下诊断、开方、开申请单、作废 |
| 管理员 | `admin` | `Admin@123` | 只读查阅；审计日志、药品导入；开方返回 403 |

口令用 **bcrypt**（cost 12）哈希存储；登录签发 JWT（含角色、8 小时过期）；未授权统一 403/401。

---

## 二、功能（规范第三条第 1～11 款）

| # | 要求 | 实现 |
|---|---|---|
| 1 | 自动获取病人/诊疗/医生/费用/用药信息 | 患者卡、病历自动带入、费用实时核算 |
| 2 | 门诊记录、检查、检验、诊断、处方、处置、材料、手术、收入院 | 五个页签 + 住院证 / 手术申请 |
| 3 | 处方自动监测（剂量、相互作用、配伍禁忌、适应症） | 服务端五维审查：过敏 / 相互作用 / 剂量 / 禁忌 / 重复 |
| 4 | 字典与医嘱模板编辑 | 药品检索、模板套用 / 保存 / 删除 |
| 5 | 完整性审核、记录医生时间、确认后不可改、可作废 | 400 校验 + 提交事务 + 锁定 + 作废（重复作废 409） |
| 6 | 医嘱备注 | 病历备注 + 处方用法 |
| 7 | 历次就诊与检验检查结果比较 | 历史列表 + 同项目趋势与参考范围 |
| 8 | 自动核算费用、医保类别 | 服务端按字典单价计算，前端传价格无效 |
| 9 | 打印处方、检查检验申请单 | 处方笺 / 病历 / 申请单，含医师签名栏 |
| 10 | 医生权限管理 | doctor / admin RBAC，路由 + 动作双层校验 |
| 11 | 自动传送诊疗与费用信息 | 生成待收费处方、待采样检验、待检查影像 |

未实现项及理由见 `docs/功能点清单.md`。

---

## 三、API 一览

| 方法 | 路径 | 说明 | 角色 |
|---|---|---|---|
| POST | `/api/auth/login` | 登录，返回 JWT | 公开 |
| GET | `/api/auth/me` | 当前用户 | 登录 |
| GET | `/api/dicts` | ICD-10 / 药品 / 处置 / 材料 / 检验 / 检查字典 | 登录 |
| GET | `/api/patients?status=` | 患者队列 | 登录 |
| GET | `/api/patients/{id}` | 患者详情（身份证脱敏） | 登录 |
| GET | `/api/patients/{id}/history` | 历次就诊 + 处方 + 申请单 | 登录 |
| GET | `/api/patients/{id}/trend?code=` | 检验结果趋势 | 登录 |
| POST | `/api/review` | 服务端划价 + 用药审查 | 登录 |
| POST | `/api/visits` | 提交门诊病历（事务） | doctor |
| POST | `/api/prescriptions/{id}/void` | 作废处方 | doctor |
| GET/POST/DELETE | `/api/templates` | 医嘱模板 | doctor（读：登录） |
| GET | `/api/dashboard` | 工作台统计 | 登录 |
| GET | `/api/admin/audit` | 审计日志 | admin |
| POST | `/api/admin/drugs/import` | 药品 CSV 导入（逐行校验） | admin |
| POST | `/api/triage` | 智能分诊（固定 JSON + 降级 + 免责声明） | 登录 |
| GET | `/api/health` | 健康检查 | 公开 |

交互式文档：<http://localhost:8000/docs>。

---

## 四、测试

```bash
cd server && pytest -q          # 19 passed
```

覆盖：登录/令牌篡改（401）、管理员开方（403）、服务端划价（忽略前端价格）、五维审查、
缺主诉/诊断/明细（400）、提交事务（金额 116.50、处方待收费、检验检查生成、患者状态、审计）、
作废（200 / 重复 409）、模板 CRUD、历史与趋势、CSV 导入（成功 2 / 失败 1 / 重复 1）、分诊降级、审计权限。

前端构建校验：`cd web && pnpm build`（tsc 无，纯 vite build）。

---

## 五、目录结构

```
医院信息系统/
├─ index.html              启动引导页（说明开发/容器两种运行方式）
├─ server/                 FastAPI 后端
│  ├─ app/
│  │  ├─ main.py           应用装配、CORS、健康检查、启动建表与种子
│  │  ├─ db.py             SQLAlchemy 引擎/会话（SQLite，可用 DATABASE_URL 切 PG）
│  │  ├─ models.py         用户/患者/就诊/处方/明细/检验/检查/模板/审计
│  │  ├─ schemas.py        请求模型（camelCase 与前端一致）
│  │  ├─ security.py       bcrypt、JWT、RBAC 依赖、审计写入
│  │  ├─ services.py       服务端划价 + 五维审查
│  │  ├─ catalog.py        ICD-10、检验项目、相互作用、分诊规则
│  │  ├─ seed.py           种子数据
│  │  └─ routers/          auth · clinic · admin · ai
│  ├─ tests/               pytest（19 项）
│  ├─ requirements.txt · Dockerfile · pytest.ini
├─ web/                    React + Vite 前端
│  ├─ src/
│  │  ├─ api.js            统一请求封装（Bearer Token、错误码）
│  │  ├─ App.jsx           登录态路由
│  │  ├─ pages/Login.jsx · Workstation.jsx
│  │  ├─ components/Modal.jsx
│  │  └─ styles.css        亮色医疗蓝设计令牌与组件
│  ├─ public/e2e-login.html  仅本地/CI 冒烟用的登录辅助页
│  ├─ nginx.conf · Dockerfile · vite.config.js · package.json
├─ docker-compose.yml      web + api（+ 可选 postgres/profile）
├─ .env.example · .github/workflows/ci.yml
├─ docs/                   功能点清单 / 范围 / 安全审查 / ER / 验收脚本 / 功能对照
└─ legacy/                 旧版纯静态实现（已归档，不参与构建）
```

---

## 六、部署与 CI

- **完整步骤见 [`docs/部署手册.md`](docs/部署手册.md)**：本机没有 Docker 也能交（Render 单服务 / Vercel+Render / CI 推 GHCR / 本机 Docker 四条路线）。
- **单镜像**：根目录 `Dockerfile` 先构建前端再把 `dist` 交给 FastAPI 托管，同域访问无 CORS，适合 Render 一键部署。
- **镜像**：`server/Dockerfile`（python:3.12-slim + uvicorn + healthcheck）、`web/Dockerfile`（node 构建 → nginx）。
- **编排**：`docker-compose.yml`，`web:8080 → api:8000`，SQLite 数据卷 `his_data`；`--profile postgres` 启用 PostgreSQL 16。
- **环境变量**：`JWT_SECRET`、`DATABASE_URL`、`ALLOW_ORIGINS`、`AI_ENDPOINT/AI_KEY`，模板见 `.env.example`，`.env` 已 gitignore。
- **CI**（`.github/workflows/ci.yml`）：后端 pytest → 前端 pnpm 构建 → 明文密钥扫描 → 构建两个镜像。
- **上线建议**：`api` 部署 Render/Fly（或任意 VPS 的 compose），`web` 部署 Vercel/Netlify 或同机 nginx；`ALLOW_ORIGINS` 改成真实域名，`JWT_SECRET` 用 32 字节随机值。

---

## 七、课程要求对照

| 要求 | 落地 |
|---|---|
| React + Vite + FastAPI + SQLite | `web/`（Vite 构建）、`server/`（FastAPI + SQLAlchemy + SQLite） |
| 登录 + 角色 + 权限（第 7 课） | bcrypt + JWT；doctor/admin；403 拦截并写审计 |
| 金额服务端计算（第 6 课） | `services.price_entries()` 只读数据库字典价 |
| 事务（第 5/6 课） | `POST /api/visits` 单事务写就诊/处方/明细/检验/检查/患者状态，异常回滚 |
| 审计（第 10 课） | `security.audit()` 记录人/角色/动作/对象/详情/IP/时间 |
| ICD-10 与药品五要素（第 10 课） | 诊断字典；药品含通用名/商品名/规格/剂型/医保类别 |
| CSV 批量导入（第 10 课） | `POST /api/admin/drugs/import`：逐行校验、错行不影响、去重、错误明细 |
| 测试（第 8 课） | pytest 19 项，覆盖钱、库存外的关键路径（提交/作废/权限/导入） |
| 部署与 CI（第 9 课） | Dockerfile ×2、compose、healthcheck、GitHub Actions、`.env.example` |
| AI 增强与伦理（第 11 课） | `POST /api/triage`：固定 JSON、10s 超时、规则降级、界面免责声明 |
| 验收（第 12 课） | `docs/验收演示脚本.md` |

---

## 八、边界说明

- 库存扣减/收费/发药属于第十、十二章，本期不含；`POST /api/visits` 只生成“待收费处方”并传送。
- 智能分诊默认走本地规则；配置 `AI_ENDPOINT` 后才调用大模型，失败/超时自动降级，界面固定展示免责声明。
- 演示数据在容器卷或 `server/data/his.db`；删除该文件即可重建种子数据。
- `legacy/` 为早期纯静态版本，仅留档，不参与构建、不对外提供。


- `web/public/e2e-login.html` 只用于本地/CI 冒烟，生产 nginx 已对该路径返回 404。
- 本地开发机未安装 Docker，镜像构建由 CI（ubuntu runner）验证；本地请用 setup.bat + dev.bat 运行。
