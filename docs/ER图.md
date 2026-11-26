# 数据模型与 ER 图（第三章）

技术栈：FastAPI + SQLAlchemy 2.x + SQLite（可切 PostgreSQL）。模型定义见 `server/app/models.py`。

```mermaid
erDiagram
    PATIENT ||--o{ VISIT : "历次就诊"
    PATIENT ||--o{ PRESCRIPTION : "处方"
    VISIT ||--o| PRESCRIPTION : "一次就诊一张处方"
    PRESCRIPTION ||--|{ RX_ITEM : "处方明细"
    DRUG ||--o{ RX_ITEM : "被开具"
    VISIT ||--o{ LAB_ORDER : "检验申请"
    VISIT ||--o{ EXAM : "检查申请"
    USER ||--o{ AUDIT_LOG : "操作留痕"
    USER ||--o{ TEMPLATE : "维护模板"

    PATIENT {
        string id PK
        string mrn "病案号"
        string card "就诊卡号"
        string name
        string sex
        int age
        string id_masked "430102********1037"
        string id_tail "仅后四位"
        string phone "掩码"
        string ins "医保类别"
        string allergy "过敏类别"
        string status "待诊/已完成"
        text complaint
        text present
        text past
        text exam
    }
    VISIT {
        string id PK
        string patient_id FK
        string date
        string time
        string dept
        string doctor
        text complaint
        text present
        text past
        text exam
        text note
        text diagnosis "ICD-10 文本"
        json diags "编码数组"
        float total "服务端计算"
        string status "已提交"
    }
    PRESCRIPTION {
        string id PK
        string visit_id FK
        string patient_id FK
        string doctor
        text diagnosis
        float total
        string status "待收费/已作废"
        text void_reason
        string void_by
        string void_at
        string created_at
    }
    RX_ITEM {
        int id PK
        string prescription_id FK
        string code
        string name
        string spec
        int qty
        float price "字典单价"
        float amount
        string usage
    }
    DRUG {
        string code PK
        string generic "通用名"
        string trade "商品名"
        string spec "规格"
        string form "剂型"
        string ins "医保类别"
        float price
        float max_dose "日剂量上限"
        string allergen
        text indication
        text contra
    }
    LAB_ORDER {
        string id PK
        string patient_id FK
        string visit_id FK
        json items "检验项目"
        string specimen "检体"
        string status "待采样/检验中/待审核/已发布"
        json results
        string created_at
    }
    EXAM {
        string id PK
        string patient_id FK
        string visit_id FK
        string item
        string part "检查部位"
        string status
        string created_at
    }
    TEMPLATE {
        string id PK
        string name
        string owner
        string dept
        json items
        text note
    }
    AUDIT_LOG {
        int id PK
        string username
        string name
        string role
        string action
        string object_type
        string object_id
        text detail
        string ip
        datetime created_at
    }
```

## 关系主线

患者 → 就诊（VISIT）→ 处方（PRESCRIPTION）→ 明细（RX_ITEM）→ 药品（DRUG）；
检验/检查申请挂在就诊上；模板与审计挂在用户上。

## 事务与约束

| 场景 | 事务内动作 | 失败处理 |
|---|---|---|
| `POST /api/visits` | ① 校验主诉/诊断/明细 ② 服务端划价 ③ 写就诊 ④ 写处方+明细（待收费）⑤ 写检验/检查 ⑥ 更新患者状态 ⑦ 写审计 | 任一异常 `rollback`，不产生半条记录 |
| `POST /api/prescriptions/{id}/void` | ① 校验状态「待收费」 ② 置「已作废」并记录原因/人/时间 ③ 写审计 | 非待收费 → 409 |

## 索引与约定

- `patients.status`、`visits.date`、`visits.patient_id`、`lab_orders.visit_id`、`audit_logs.created_at` 建索引。
- 全部金额两位小数；日期字符串 `YYYY-MM-DD`，时间 `YYYY-MM-DD HH:MM`。
- 隐私：不存完整身份证；`id_masked` + `id_tail`。
