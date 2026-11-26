"""种子数据：用户、患者、药品/处置/材料字典、历史就诊、模板。"""
import os
import secrets

from sqlalchemy.orm import Session

from .config import IS_PROD
from .models import Drug, Exam, LabOrder, Material, Patient, Template, Treatment, User, Visit
from .security import hash_password, verify_password

# 演示口令：仅用于开发/演示；生产由 SEED_* 环境变量注入，未注入则随机生成
DEMO_PASSWORDS = {"doctor": "Doctor@123", "admin": "Admin@123"}


def _initial_password(env_key: str, demo: str) -> str:
    value = (os.getenv(env_key) or "").strip()
    if value:
        return value
    if IS_PROD:
        generated = secrets.token_urlsafe(15)
        print(f"[seed] 未设置 {env_key}，已生成随机初始口令（仅本次打印）：{generated}")
        return generated
    return demo


def weak_accounts(db: Session) -> list[str]:
    """返回仍在使用演示口令的账号，供启动自检告警。"""
    out: list[str] = []
    for user in db.query(User).all():
        demo = DEMO_PASSWORDS.get(user.username)
        if demo and verify_password(demo, user.password_hash):
            out.append(user.username)
    return out


def seed(db: Session) -> None:
    if db.query(User).count() == 0:
        db.add_all([
            User(id="U001", username="doctor", name="陈志远", role="doctor", dept="内科",
                 title="主任医师",
                 password_hash=hash_password(_initial_password("SEED_DOCTOR_PASSWORD", DEMO_PASSWORDS["doctor"]))),
            User(id="U002", username="admin", name="王建国", role="admin", dept="信息科",
                 title="系统管理员",
                 password_hash=hash_password(_initial_password("SEED_ADMIN_PASSWORD", DEMO_PASSWORDS["admin"]))),
        ])

    if db.query(Drug).count() == 0:
        rows = [
            ("Y0001", "阿莫西林", "再林", "0.25g×24粒", "胶囊剂", "盒", 18.5, 12.2, "甲", 420, 80, "青霉素类", 2, "g/日", "口服 0.5g 每8小时一次", "敏感菌所致呼吸道、泌尿道感染", "青霉素过敏者禁用"),
            ("Y0002", "头孢曲松", "菌必治", "1.0g/支", "注射剂", "支", 32.8, 21.5, "乙", 186, 60, "头孢类", 4, "g/日", "静滴 2g 每日一次", "下呼吸道、腹腔、泌尿系统感染", "头孢菌素过敏者禁用"),
            ("Y0004", "左氧氟沙星", "可乐必妥", "0.5g/100ml", "注射液", "瓶", 45.6, 30.1, "乙", 210, 60, "喹诺酮类", 0.75, "g/日", "静滴 0.5g 每日一次", "呼吸道、泌尿道感染", "18 岁以下、癫痫病史者禁用"),
            ("Y0006", "布洛芬", "芬必得", "0.3g×20粒", "胶囊剂", "盒", 21.3, 13.6, "甲", 380, 80, "NSAIDs", 1.2, "g/日", "口服 0.3g 每日两次", "发热、轻中度疼痛", "活动性消化道溃疡禁用"),
            ("Y0007", "对乙酰氨基酚", "泰诺林", "0.5g×20片", "片剂", "盒", 9.8, 5.2, "甲", 520, 100, "", 2, "g/日", "口服 0.5g 必要时", "解热镇痛", "严重肝肾功能不全者禁用"),
            ("Y0009", "氨溴索", "沐舒坦", "100ml:0.6g", "口服溶液剂", "瓶", 26.5, 17.0, "乙", 240, 60, "", 0.09, "g/日", "口服 10ml 每日三次", "痰液粘稠不易咳出", "妊娠早期慎用"),
            ("Y0011", "氨氯地平", "络活喜", "5mg×7片", "片剂", "盒", 29.6, 19.3, "甲", 168, 40, "", 10, "mg/日", "口服 5mg 每日一次", "高血压、心绞痛", "严重低血压禁用"),
            ("Y0013", "辛伐他汀", "舒降之", "20mg×7片", "片剂", "盒", 27.4, 17.8, "甲", 116, 40, "", 40, "mg/日", "口服 20mg 每晚一次", "高脂血症", "活动性肝病禁用"),
            ("Y0014", "阿司匹林", "拜阿司匹灵", "100mg×30片", "片剂", "盒", 15.6, 9.4, "甲", 300, 80, "NSAIDs", 0.3, "g/日", "口服 100mg 每日一次", "抗血小板聚集", "活动性出血、消化道溃疡禁用"),
            ("Y0015", "华法林", "芬兰华法林", "2.5mg×60片", "片剂", "盒", 22.8, 14.2, "甲", 58, 30, "", 10, "mg/日", "口服 2.5mg 每日一次，监测 INR", "房颤、静脉血栓栓塞抗凝", "妊娠、活动性出血禁用"),
            ("Y0016", "地高辛", "狄戈辛", "0.25mg×30片", "片剂", "盒", 19.2, 11.6, "甲", 46, 30, "", 0.5, "mg/日", "口服 0.125mg 每日一次", "慢性心衰、房颤控制心室率", "室颤、肥厚梗阻型心肌病禁用"),
            ("Y0017", "呋塞米", "速尿", "20mg/2ml", "注射剂", "支", 3.6, 1.9, "甲", 240, 60, "磺胺类", 1, "g/日", "静推 20mg 必要时", "水肿性疾病、急性肺水肿", "磺胺类过敏、低钾血症禁用"),
            ("Y0019", "胰岛素", "诺和灵R", "400IU/10ml", "注射剂", "支", 58.9, 42.0, "乙", 36, 20, "", 100, "IU/日", "皮下注射 按血糖调整", "糖尿病", "低血糖发作时禁用"),
            ("Y0021", "奥美拉唑", "洛赛克", "20mg×14粒", "胶囊剂", "盒", 33.5, 21.7, "甲", 260, 60, "", 40, "mg/日", "口服 20mg 每日一次 晨服", "消化性溃疡、GERD", "对 PPI 过敏者禁用"),
            ("Y0022", "氯吡格雷", "波立维", "75mg×7片", "片剂", "盒", 46.8, 33.6, "乙", 88, 30, "", 75, "mg/日", "口服 75mg 每日一次", "急性冠脉综合征、支架术后", "活动性出血禁用"),
            ("Y0023", "克拉霉素", "克拉仙", "0.25g×8片", "片剂", "盒", 39.2, 26.5, "乙", 72, 30, "大环内酯类", 1, "g/日", "口服 0.25g 每日两次", "呼吸道感染、幽门螺杆菌根除", "大环内酯类过敏禁用"),
            ("Y0024", "胺碘酮", "可达龙", "150mg/3ml", "注射剂", "支", 27.9, 18.4, "乙", 44, 20, "", 1.2, "g/日", "静滴 150mg 负荷 后 1mg/min", "室性/室上性心律失常", "严重窦房结病变、甲状腺疾病禁用"),
            ("Y0027", "葡萄糖酸钙", "", "1g/10ml", "注射剂", "支", 4.2, 2.2, "甲", 180, 40, "", 2, "g/日", "静推 1g 缓慢", "低钙血症、过敏辅助", "高钙血症、洋地黄中毒禁用"),
            ("Y0030", "碳酸钙", "钙尔奇", "600mg×60片", "片剂", "瓶", 42.0, 28.5, "乙", 140, 40, "", 1.2, "g/日", "口服 1片 每日一次", "钙缺乏症、骨质疏松", "高钙血症禁用"),
        ]
        db.add_all([
            Drug(code=r[0], generic=r[1], trade=r[2], spec=r[3], form=r[4], unit=r[5], price=r[6], cost=r[7],
                 ins=r[8], stock=r[9], low=r[10], allergen=r[11], max_dose=r[12], dose_unit=r[13],
                 usage=r[14], indication=r[15], contra=r[16], batch="B2409", expiry="2027-09-30")
            for r in rows
        ])

    if db.query(Treatment).count() == 0:
        db.add_all([
            Treatment(code="T01", name="静脉输液", unit="次", price=18.0, ins="甲"),
            Treatment(code="T02", name="肌肉注射", unit="次", price=6.0, ins="甲"),
            Treatment(code="T03", name="雾化吸入", unit="次", price=22.0, ins="乙"),
            Treatment(code="T04", name="清创缝合（小）", unit="次", price=120.0, ins="甲"),
            Treatment(code="T05", name="换药", unit="次", price=35.0, ins="甲"),
        ])

    if db.query(Material).count() == 0:
        db.add_all([
            Material(code="M01", name="一次性输液器", spec="0.55mm", unit="套", price=4.5, ins="甲"),
            Material(code="M02", name="一次性注射器 5ml", spec="5ml", unit="支", price=1.2, ins="甲"),
            Material(code="M03", name="无菌纱布块", spec="8×8cm", unit="块", price=0.8, ins="甲"),
            Material(code="M04", name="医用绷带", spec="10cm×6m", unit="卷", price=6.0, ins="甲"),
        ])

    if db.query(Patient).count() == 0:
        rows = [
            ("P202611001", "M0001231", "C88001231", "张建国", "男", 63, "138****2210", "1037", "职工医保", "青霉素类",
             "待诊", "内科", "陈志远", "咳嗽咳痰 5 天，加重伴发热 1 天",
             "5 天前受凉后咳嗽，咳白色粘痰；1 天前发热 38.6℃，伴乏力、纳差。",
             "高血压 10 年，规律服用氨氯地平；青霉素皮试阳性。",
             "咽部充血，双肺呼吸音粗，右下肺可闻及少量湿啰音。", 38.6, 96, "148/92"),
            ("P202611002", "M0001232", "C88001232", "李秀兰", "女", 58, "139****8821", "2041", "居民医保", "",
             "待诊", "心血管内科", "林晓雯", "活动后胸闷气短 2 月，加重 3 天",
             "快步行走后胸闷，休息可缓解；3 天前加重，夜间阵发性呼吸困难。",
             "2 型糖尿病 6 年，口服二甲双胍。", "双肺底少量湿啰音，双下肢轻度水肿。", 36.5, 88, "156/94"),
            ("P202611003", "M0001233", "C88001233", "王小虎", "男", 7, "137****6612", "3052", "居民医保", "头孢类",
             "待诊", "儿科", "周敏", "发热 2 天，最高 39.2℃，伴咽痛",
             "2 天前发热，伴咽痛、流涕，无抽搐、无皮疹。", "既往体健；头孢类过敏。",
             "咽充血，双侧扁桃体 II 度肿大。", 38.9, 112, "96/62"),
            ("P202611007", "M0001237", "C88001237", "孙玉梅", "女", 45, "130****5544", "4473", "自费", "",
             "待诊", "外科", "赵启明", "右上腹疼痛伴恶心 1 天",
             "进食油腻后右上腹阵发性疼痛，向右肩背放射。", "胆囊结石 3 年。",
             "右上腹压痛，Murphy 征阳性。", 37.8, 92, "126/78"),
            ("P202611009", "M0001239", "C88001239", "吴佳怡", "女", 26, "188****3322", "5084", "居民医保", "",
             "已完成", "内科", "陈志远", "腹泻 3 天，每日 6-8 次水样便",
             "进食不洁食物后腹泻，水样便，伴脐周隐痛。", "既往体健。",
             "腹软，脐周轻压痛，肠鸣音活跃。", 37.4, 90, "110/70"),
        ]
        db.add_all([
            Patient(id=r[0], mrn=r[1], card=r[2], name=r[3], sex=r[4], age=r[5], phone=r[6],
                    id_masked="430102********" + r[7], id_tail=r[7], ins=r[8], allergy=r[9],
                    status=r[10], dept=r[11], doctor=r[12], complaint=r[13], present=r[14],
                    past=r[15], exam=r[16], temp=r[17], pulse=r[18], bp=r[19])
            for r in rows
        ])

    if db.query(Visit).count() == 0:
        db.add_all([
            Visit(id="V20260812001", patient_id="P202611001", patient_name="张建国", date="2026-08-12",
                  time="2026-08-12 09:20", dept="内科", doctor="陈志远", complaint="咳嗽 3 天",
                  diagnosis="急性支气管炎（J20.900）", diags=["J20.900"], total=26.5, status="已提交"),
            Visit(id="V20261003002", patient_id="P202611001", patient_name="张建国", date="2026-10-03",
                  time="2026-10-03 10:10", dept="内科", doctor="陈志远", complaint="咳嗽复发伴低热",
                  diagnosis="急性支气管炎（J20.900）", diags=["J20.900"], total=42.7, status="已提交"),
            Visit(id="V20261110003", patient_id="P202611002", patient_name="李秀兰", date="2026-11-10",
                  time="2026-11-10 15:40", dept="心血管内科", doctor="林晓雯", complaint="活动后胸闷",
                  diagnosis="冠状动脉粥样硬化性心脏病（I25.103）", diags=["I25.103"], total=15.6, status="已提交"),
        ])

    if db.query(LabOrder).count() == 0:
        db.add_all([
            LabOrder(id="LB20261126001", patient_id="P202611001", visit_id="V20261003002",
                     items=["L01", "L05"], specimen="全血", status="待审核",
                     results=[{"code": "L01", "v": 11.2}, {"code": "L05", "v": 24.6}], created_at="2026-10-03 10:20"),
            LabOrder(id="LB20260812001", patient_id="P202611001", visit_id="V20260812001",
                     items=["L01", "L05"], specimen="全血", status="已发布",
                     results=[{"code": "L01", "v": 9.1}, {"code": "L05", "v": 12.4}], created_at="2026-08-12 09:35"),
        ])

    if db.query(Exam).count() == 0:
        db.add(Exam(id="EX20261126001", patient_id="P202611001", visit_id="V20261003002",
                    item="胸部正位DR", part="胸部", status="待检查", created_at="2026-10-03 10:22"))

    if db.query(Template).count() == 0:
        db.add_all([
            Template(id="TPL01", name="上呼吸道感染", owner="陈志远", dept="内科",
                     items=[{"code": "Y0009", "qty": 1, "usage": "口服 10ml 每日三次"},
                            {"code": "Y0007", "qty": 1, "usage": "口服 0.5g 必要时"}],
                     note="对症治疗，多饮水", created_at="2026-11-01 08:00"),
            Template(id="TPL02", name="高血压随访", owner="林晓雯", dept="心血管内科",
                     items=[{"code": "Y0011", "qty": 2, "usage": "口服 5mg 每日一次"}],
                     note="监测血压，2 周复诊", created_at="2026-11-02 08:00"),
        ])

    db.commit()
