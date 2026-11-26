# AGENTS.md · 本仓库开发规约

> 范围：只做《医院信息系统基本功能规范》第三章（门诊医生工作站）。
> 技术栈：React 18 + Vite 5（`web/`）· FastAPI + SQLAlchemy + SQLite（`server/`）· pytest · Docker Compose。

## 1. 目录

```
server/app/        main · db · models · schemas · security · services · catalog · seed
server/app/routers auth · clinic · admin · ai
server/tests/      pytest（conftest 用临时 SQLite）
web/src/           api.js · App.jsx · pages/(Login, Workstation) · components · styles.css
web/public/        e2e-login.html（仅冒烟用）
docs/              功能点清单 · 范围 · 安全审查 · ER · 验收脚本 · 功能对照
legacy/            旧版纯静态实现，不参与构建
```

## 2. 命名与字段

- 接口路径 `/api/<模块>/<资源>`；前端字段 camelCase，通过 Pydantic `alias_generator=to_camel` 与后端 snake_case 对齐。
- 状态中文枚举集中：患者 `待诊 / 已完成`；处方 `待收费 / 已作废`。
- 金额：`price`（字典单价）、`amount`（行金额）、`total`（合计），两位小数。

## 3. 业务硬约束

1. 金额只由 `app/services.price_entries()` 按数据库字典价计算，忽略前端传入的 `price`。
2. `POST /api/visits` 必须单事务：就诊、处方、明细、检验、检查、患者状态同生共死；异常 `rollback`。
3. 完整性：主诉、诊断、明细缺一 → 400。
4. 提交即锁定（前端无编辑入口）；作废仅限「待收费」，否则 409。
5. 身份证只存掩码与后四位；手机号掩码；CSV 上传必须服务端逐行校验并返回失败明细。
6. 所有写操作调用 `security.audit()`。

## 4. 安全基线

- 口令 bcrypt（cost 12）；JWT HS256，含角色与过期时间；`JWT_SECRET` 由环境注入，仓库不留真值。
- RBAC：doctor 可开方，admin 只读 + 审计/导入；未授权 403，未登录 401。
- CORS 白名单来自 `ALLOW_ORIGINS`，禁止 `*`。
- 上传：限制列数与类型、单价/库存数值校验、医保类别枚举、同通用名同规格去重。

## 5. 改动流程

1. 一次只做一件可验证的事：改完先跑 `cd server && pytest -q`，再 `cd web && pnpm build`。
2. 改表结构写迁移脚本（Alembic 或显式 SQL），禁止删库重建；演示数据可删 `his.db` 重建。
3. 新增接口：`routers/` 加路由 + `security.require_roles` 声明角色 + `docs/功能对照.md` 更新。
4. 提交信息：`feat|fix|docs|test: 做了什么`。
