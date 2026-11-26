/* ==========================================================================
   HIS · 数据字典与种子数据（第三章 门诊医生工作站）
   字典：科室 / 医生 / ICD-10 / 药品 / 处置 / 卫生材料 / 检验 / 检查
   种子：患者（身份证脱敏）/ 历次就诊 / 检验检查 / 已传送处方 / 医嘱模板 / 用户
   ========================================================================== */
window.HIS = window.HIS || {};
(function (H) {
  'use strict';

  H.dict = H.dict || {};

  /* ---------------- 科室与医生（含职称等级，用于权限与排班展示） ---------------- */
  H.dict.depts = [
    { code: 'D01', name: '内科' },
    { code: 'D02', name: '外科' },
    { code: 'D03', name: '儿科' },
    { code: 'D04', name: '妇产科' },
    { code: 'D05', name: '骨科' },
    { code: 'D06', name: '心血管内科' },
    { code: 'D07', name: '神经内科' },
    { code: 'D08', name: '皮肤科' }
  ];

  H.dict.doctors = [
    { code: 'DR001', name: '陈志远', title: '主任医师', level: 3, dept: '内科', room: '3 诊室' },
    { code: 'DR002', name: '林晓雯', title: '副主任医师', level: 2, dept: '心血管内科', room: '6 诊室' },
    { code: 'DR003', name: '赵启明', title: '主治医师', level: 1, dept: '外科', room: '2 诊室' },
    { code: 'DR004', name: '周敏', title: '主治医师', level: 1, dept: '儿科', room: '8 诊室' }
  ];


  /* ---------------- ICD-10 诊断字典（门诊下达诊断用） ---------------- */
H.dict.icd = [
    { code: 'J06.900', name: '急性上呼吸道感染' },
    { code: 'J18.900', name: '肺炎' },
    { code: 'J45.900', name: '支气管哮喘' },
    { code: 'I10.x00', name: '高血压病' },
    { code: 'I25.103', name: '冠状动脉粥样硬化性心脏病' },
    { code: 'I50.900', name: '心力衰竭' },
    { code: 'E11.900', name: '2型糖尿病' },
    { code: 'K29.700', name: '慢性胃炎' },
    { code: 'K35.900', name: '急性阑尾炎' },
    { code: 'K80.200', name: '胆囊结石' },
    { code: 'N39.000', name: '泌尿道感染' },
    { code: 'M17.900', name: '膝关节骨性关节炎' },
    { code: 'S72.001', name: '股骨颈骨折' },
    { code: 'A09.900', name: '感染性腹泻' },
    { code: 'R50.900', name: '发热' },
    { code: 'R51.x00', name: '头痛' },
    { code: 'R10.400', name: '腹痛' },
    { code: 'J20.900', name: '急性支气管炎' },
    { code: 'H10.900', name: '结膜炎' },
    { code: 'L03.900', name: '蜂窝织炎' },
    { code: 'O80.000', name: '顺产' },
    { code: 'D50.900', name: '缺铁性贫血' },
    { code: 'N20.000', name: '肾结石' },
    { code: 'G43.900', name: '偏头痛' }
  ];

  /* ---------------- 药品字典（含别名、医保类别、剂量上限、过敏类别、相互作用） ---------------- */
H.dict.drugs = [
    { code: 'Y0001', name: '阿莫西林胶囊', alias: '羟氨苄青霉素', spec: '0.25g×24粒', unit: '盒', price: 18.50, cost: 12.20, mfr: '华北制药', supplier: '国药控股', cat: '西药', ptype: '口服', stock: 420, low: 80, batch: 'B240915', expiry: '2027-09-14', ins: '甲', otc: false, generic: '阿莫西林', allergen: '青霉素类', maxDose: 2, doseUnit: 'g/日', usage: '口服 0.5g/次 每8小时一次', indication: '敏感菌所致的呼吸道、泌尿道、皮肤软组织感染', contra: '青霉素过敏者禁用', interactions: ['甲氨蝶呤'] },
    { code: 'Y0002', name: '头孢曲松钠注射剂', alias: '菌必治', spec: '1.0g/支', unit: '支', price: 32.80, cost: 21.50, mfr: '罗氏制药', supplier: '国药控股', cat: '西药', ptype: '针剂', stock: 186, low: 60, batch: 'C241102', expiry: '2027-11-01', ins: '乙', otc: false, generic: '头孢曲松', allergen: '头孢类', maxDose: 4, doseUnit: 'g/日', usage: '静滴 2g 每日一次', indication: '敏感菌引起的下呼吸道、腹腔、泌尿系统感染', contra: '对头孢菌素过敏者禁用；高胆红素血症新生儿禁用', interactions: ['葡萄糖酸钙注射液', '复方氯化钠注射液'] },
    { code: 'Y0003', name: '注射用哌拉西林他唑巴坦', alias: '特治星', spec: '4.5g/支', unit: '支', price: 86.00, cost: 63.00, mfr: '辉瑞制药', supplier: '华润医药', cat: '西药', ptype: '针剂', stock: 64, low: 40, batch: 'P241018', expiry: '2026-12-30', ins: '乙', otc: false, generic: '哌拉西林他唑巴坦', allergen: '青霉素类', maxDose: 18, doseUnit: 'g/日', usage: '静滴 4.5g 每8小时一次', indication: '中重度院内感染、腹腔感染', contra: '青霉素类过敏者禁用', interactions: [] },
    { code: 'Y0004', name: '左氧氟沙星注射液', alias: '可乐必妥', spec: '0.5g/100ml', unit: '瓶', price: 45.60, cost: 30.10, mfr: '第一三共', supplier: '国药控股', cat: '西药', ptype: '输液', stock: 210, low: 60, batch: 'L240820', expiry: '2027-02-19', ins: '乙', otc: false, generic: '左氧氟沙星', allergen: '喹诺酮类', maxDose: 0.75, doseUnit: 'g/日', usage: '静滴 0.5g 每日一次', indication: '呼吸道、泌尿道感染', contra: '18岁以下、癫痫病史者禁用', interactions: ['碳酸钙D3片', '胺碘酮注射液'] },
    { code: 'Y0005', name: '阿奇霉素干混悬剂', alias: '希舒美', spec: '0.1g×6袋', unit: '盒', price: 28.90, cost: 19.40, mfr: '辉瑞制药', supplier: '华润医药', cat: '西药', ptype: '口服', stock: 156, low: 50, batch: 'A240701', expiry: '2027-06-30', ins: '乙', otc: false, generic: '阿奇霉素', allergen: '大环内酯类', maxDose: 0.5, doseUnit: 'g/日', usage: '口服 10mg/kg 每日一次 连用3日', indication: '支原体肺炎、敏感菌感染', contra: '对大环内酯类过敏者禁用', interactions: ['胺碘酮注射液'] },
    { code: 'Y0006', name: '布洛芬缓释胶囊', alias: '芬必得', spec: '0.3g×20粒', unit: '盒', price: 21.30, cost: 13.60, mfr: '中美史克', supplier: '国药控股', cat: '西药', ptype: '口服', stock: 380, low: 80, batch: 'B241010', expiry: '2028-10-09', ins: '甲', otc: true, generic: '布洛芬', allergen: 'NSAIDs', maxDose: 1.2, doseUnit: 'g/日', usage: '口服 0.3g 每日两次', indication: '发热、轻中度疼痛', contra: '活动性消化道溃疡禁用', interactions: ['阿司匹林肠溶片', '华法林钠片'] },
    { code: 'Y0007', name: '对乙酰氨基酚片', alias: '泰诺林', spec: '0.5g×20片', unit: '盒', price: 9.80, cost: 5.20, mfr: '强生制药', supplier: '上药控股', cat: '西药', ptype: '口服', stock: 520, low: 100, batch: 'P240905', expiry: '2028-09-04', ins: '甲', otc: true, generic: '对乙酰氨基酚', allergen: '', maxDose: 2, doseUnit: 'g/日', usage: '口服 0.5g 必要时', indication: '解热镇痛', contra: '严重肝肾功能不全者禁用', interactions: ['复方甘草片'] },
    { code: 'Y0008', name: '头孢呋辛酯片', alias: '西力欣', spec: '0.25g×12片', unit: '盒', price: 42.70, cost: 29.80, mfr: '葛兰素史克', supplier: '华润医药', cat: '西药', ptype: '口服', stock: 98, low: 50, batch: 'C240612', expiry: '2027-05-31', ins: '乙', otc: false, generic: '头孢呋辛', allergen: '头孢类', maxDose: 1, doseUnit: 'g/日', usage: '口服 0.25g 每日两次', indication: '呼吸道、泌尿道轻中度感染', contra: '头孢类过敏者禁用', interactions: [] },
    { code: 'Y0009', name: '氨溴索口服溶液', alias: '沐舒坦', spec: '100ml:0.6g', unit: '瓶', price: 26.50, cost: 17.00, mfr: '勃林格殷格翰', supplier: '国药控股', cat: '西药', ptype: '口服', stock: 240, low: 60, batch: 'A240418', expiry: '2027-04-17', ins: '乙', otc: true, generic: '氨溴索', allergen: '', maxDose: 0.09, doseUnit: 'g/日', usage: '口服 10ml 每日三次', indication: '痰液粘稠不易咳出', contra: '妊娠早期慎用', interactions: [] },
    { code: 'Y0010', name: '硝苯地平控释片', alias: '拜新同', spec: '30mg×7片', unit: '盒', price: 34.20, cost: 24.10, mfr: '拜耳医药', supplier: '上药控股', cat: '西药', ptype: '口服', stock: 132, low: 40, batch: 'N240730', expiry: '2027-07-29', ins: '甲', otc: false, generic: '硝苯地平', allergen: '', maxDose: 0.12, doseUnit: 'g/日', usage: '口服 30mg 每日一次', indication: '高血压、心绞痛', contra: '心源性休克禁用', interactions: ['辛伐他汀片'] },
    { code: 'Y0011', name: '苯磺酸氨氯地平片', alias: '络活喜', spec: '5mg×7片', unit: '盒', price: 29.60, cost: 19.30, mfr: '辉瑞制药', supplier: '国药控股', cat: '西药', ptype: '口服', stock: 168, low: 40, batch: 'A240928', expiry: '2027-09-27', ins: '甲', otc: false, generic: '氨氯地平', allergen: '', maxDose: 10, doseUnit: 'mg/日', usage: '口服 5mg 每日一次', indication: '高血压、慢性稳定性心绞痛', contra: '严重低血压禁用', interactions: ['辛伐他汀片'] },
    { code: 'Y0012', name: '美托洛尔缓释片', alias: '倍他乐克', spec: '47.5mg×7片', unit: '盒', price: 31.80, cost: 22.40, mfr: '阿斯利康', supplier: '华润医药', cat: '西药', ptype: '口服', stock: 74, low: 40, batch: 'M240815', expiry: '2027-08-14', ins: '乙', otc: false, generic: '美托洛尔', allergen: '', maxDose: 190, doseUnit: 'mg/日', usage: '口服 47.5mg 每日一次', indication: '高血压、心衰、心律失常', contra: '支气管哮喘、重度心动过缓禁用', interactions: ['胰岛素注射液'] },
    { code: 'Y0013', name: '辛伐他汀片', alias: '舒降之', spec: '20mg×7片', unit: '盒', price: 27.40, cost: 17.80, mfr: '默沙东', supplier: '国药控股', cat: '西药', ptype: '口服', stock: 116, low: 40, batch: 'S240606', expiry: '2027-06-05', ins: '甲', otc: false, generic: '辛伐他汀', allergen: '', maxDose: 40, doseUnit: 'mg/日', usage: '口服 20mg 每晚一次', indication: '高脂血症', contra: '活动性肝病禁用', interactions: ['克拉霉素片', '苯磺酸氨氯地平片'] },
    { code: 'Y0014', name: '阿司匹林肠溶片', alias: '拜阿司匹灵', spec: '100mg×30片', unit: '盒', price: 15.60, cost: 9.40, mfr: '拜耳医药', supplier: '上药控股', cat: '西药', ptype: '口服', stock: 300, low: 80, batch: 'A240712', expiry: '2028-07-11', ins: '甲', otc: false, generic: '阿司匹林', allergen: 'NSAIDs', maxDose: 0.3, doseUnit: 'g/日', usage: '口服 100mg 每日一次', indication: '抗血小板聚集', contra: '活动性出血、消化道溃疡禁用', interactions: ['华法林钠片', '布洛芬缓释胶囊'] },
    { code: 'Y0015', name: '华法林钠片', alias: '芬兰华法林', spec: '2.5mg×60片', unit: '盒', price: 22.80, cost: 14.20, mfr: 'Orion', supplier: '国药控股', cat: '西药', ptype: '口服', stock: 58, low: 30, batch: 'W240520', expiry: '2027-05-19', ins: '甲', otc: false, generic: '华法林', allergen: '', maxDose: 10, doseUnit: 'mg/日', usage: '口服 2.5mg 每日一次，监测INR', indication: '房颤、静脉血栓栓塞抗凝', contra: '妊娠、活动性出血禁用', interactions: ['阿司匹林肠溶片', '布洛芬缓释胶囊', '克拉霉素片'] },
    { code: 'Y0016', name: '地高辛片', alias: '狄戈辛', spec: '0.25mg×30片', unit: '盒', price: 19.20, cost: 11.60, mfr: '上海信谊', supplier: '上药控股', cat: '西药', ptype: '口服', stock: 46, low: 30, batch: 'D240311', expiry: '2027-03-10', ins: '甲', otc: false, generic: '地高辛', allergen: '', maxDose: 0.5, doseUnit: 'mg/日', usage: '口服 0.125mg 每日一次', indication: '慢性心力衰竭、房颤控制心室率', contra: '室颤、肥厚梗阻型心肌病禁用', interactions: ['呋塞米注射液'] },
    { code: 'Y0017', name: '呋塞米注射液', alias: '速尿', spec: '20mg/2ml', unit: '支', price: 3.60, cost: 1.90, mfr: '天津金耀', supplier: '国药控股', cat: '西药', ptype: '针剂', stock: 240, low: 60, batch: 'F240902', expiry: '2027-09-01', ins: '甲', otc: false, generic: '呋塞米', allergen: '磺胺类', maxDose: 1, doseUnit: 'g/日', usage: '静推 20mg 必要时', indication: '水肿性疾病、急性肺水肿', contra: '磺胺类过敏、低钾血症禁用', interactions: ['地高辛片'] },
    { code: 'Y0018', name: '氯化钾缓释片', alias: '补达秀', spec: '0.5g×24片', unit: '盒', price: 13.40, cost: 8.10, mfr: '广州迈特兴华', supplier: '华润医药', cat: '西药', ptype: '口服', stock: 190, low: 50, batch: 'K240805', expiry: '2027-08-04', ins: '甲', otc: false, generic: '氯化钾', allergen: '', maxDose: 6, doseUnit: 'g/日', usage: '口服 1g 每日两次', indication: '低钾血症', contra: '高钾血症、严重肾功能不全禁用', interactions: [] },
    { code: 'Y0019', name: '胰岛素注射液', alias: '常规胰岛素', spec: '400IU/10ml', unit: '支', price: 58.90, cost: 42.00, mfr: '诺和诺德', supplier: '国药控股', cat: '西药', ptype: '针剂', stock: 36, low: 20, batch: 'I240714', expiry: '2026-12-13', ins: '乙', otc: false, generic: '胰岛素', allergen: '', maxDose: 100, doseUnit: 'IU/日', usage: '皮下注射 按血糖调整', indication: '糖尿病', contra: '低血糖发作时禁用', interactions: ['美托洛尔缓释片'] },
    { code: 'Y0020', name: '二甲双胍缓释片', alias: '格华止', spec: '0.5g×30片', unit: '盒', price: 24.60, cost: 15.30, mfr: '中美上海施贵宝', supplier: '上药控股', cat: '西药', ptype: '口服', stock: 210, low: 50, batch: 'M240829', expiry: '2027-08-28', ins: '甲', otc: false, generic: '二甲双胍', allergen: '', maxDose: 2, doseUnit: 'g/日', usage: '口服 0.5g 每日两次 餐后', indication: '2型糖尿病', contra: 'eGFR<45、酮症酸中毒禁用', interactions: [] },
    { code: 'Y0021', name: '奥美拉唑肠溶胶囊', alias: '洛赛克', spec: '20mg×14粒', unit: '盒', price: 33.50, cost: 21.70, mfr: '阿斯利康', supplier: '国药控股', cat: '西药', ptype: '口服', stock: 260, low: 60, batch: 'O240723', expiry: '2027-07-22', ins: '甲', otc: false, generic: '奥美拉唑', allergen: '', maxDose: 40, doseUnit: 'mg/日', usage: '口服 20mg 每日一次 晨服', indication: '消化性溃疡、GERD', contra: '对PPI过敏者禁用', interactions: ['氯吡格雷片'] },
    { code: 'Y0022', name: '氯吡格雷片', alias: '波立维', spec: '75mg×7片', unit: '盒', price: 46.80, cost: 33.60, mfr: '赛诺菲', supplier: '华润医药', cat: '西药', ptype: '口服', stock: 88, low: 30, batch: 'C240918', expiry: '2027-09-17', ins: '乙', otc: false, generic: '氯吡格雷', allergen: '', maxDose: 75, doseUnit: 'mg/日', usage: '口服 75mg 每日一次', indication: '急性冠脉综合征、支架术后', contra: '活动性出血禁用', interactions: ['奥美拉唑肠溶胶囊'] },
    { code: 'Y0023', name: '克拉霉素片', alias: '克拉仙', spec: '0.25g×8片', unit: '盒', price: 39.20, cost: 26.50, mfr: '雅培制药', supplier: '国药控股', cat: '西药', ptype: '口服', stock: 72, low: 30, batch: 'K240607', expiry: '2027-06-06', ins: '乙', otc: false, generic: '克拉霉素', allergen: '大环内酯类', maxDose: 1, doseUnit: 'g/日', usage: '口服 0.25g 每日两次', indication: '呼吸道感染、幽门螺杆菌根除', contra: '大环内酯类过敏禁用', interactions: ['辛伐他汀片', '华法林钠片'] },
    { code: 'Y0024', name: '胺碘酮注射液', alias: '可达龙', spec: '150mg/3ml', unit: '支', price: 27.90, cost: 18.40, mfr: '赛诺菲', supplier: '上药控股', cat: '西药', ptype: '针剂', stock: 44, low: 20, batch: 'A240426', expiry: '2027-04-25', ins: '乙', otc: false, generic: '胺碘酮', allergen: '', maxDose: 1.2, doseUnit: 'g/日', usage: '静滴 150mg 负荷 后 1mg/min', indication: '室性/室上性心律失常', contra: '严重窦房结病变、甲状腺疾病禁用', interactions: ['左氧氟沙星注射液', '阿奇霉素干混悬剂'] },
    { code: 'Y0025', name: '复方甘草片', alias: '', spec: '100片/瓶', unit: '瓶', price: 8.60, cost: 4.30, mfr: '北京双鹤', supplier: '上药控股', cat: '西药', ptype: '口服', stock: 150, low: 40, batch: 'G240530', expiry: '2027-05-29', ins: '自费', otc: true, generic: '复方甘草', allergen: '', maxDose: 9, doseUnit: '片/日', usage: '含服 2片 每日三次', indication: '镇咳祛痰', contra: '醛固酮增多症禁用', interactions: ['地高辛片'] },
    { code: 'Y0026', name: '注射用盐酸吗啡', alias: '', spec: '10mg/1ml', unit: '支', price: 6.80, cost: 3.90, mfr: '东北制药', supplier: '国药控股', cat: '西药', ptype: '毒麻', stock: 28, low: 10, batch: 'M240101', expiry: '2027-01-01', ins: '甲', otc: false, generic: '吗啡', allergen: '', maxDose: 60, doseUnit: 'mg/日', usage: '皮下注射 10mg 必要时（麻醉药品处方）', indication: '中重度疼痛', contra: '呼吸抑制、颅内高压禁用', interactions: [] },
    { code: 'Y0027', name: '葡萄糖酸钙注射液', alias: '', spec: '1g/10ml', unit: '支', price: 4.20, cost: 2.20, mfr: '哈药集团', supplier: '华润医药', cat: '西药', ptype: '针剂', stock: 180, low: 40, batch: 'G240812', expiry: '2027-08-11', ins: '甲', otc: false, generic: '葡萄糖酸钙', allergen: '', maxDose: 2, doseUnit: 'g/日', usage: '静推 1g 缓慢', indication: '低钙血症、过敏辅助', contra: '高钙血症、洋地黄中毒禁用', interactions: ['头孢曲松钠注射剂'] },
    { code: 'Y0028', name: '连花清瘟胶囊', alias: '', spec: '0.35g×24粒', unit: '盒', price: 19.80, cost: 12.60, mfr: '石家庄以岭', supplier: '国药控股', cat: '中成药', ptype: '口服', stock: 320, low: 60, batch: 'L241020', expiry: '2028-10-19', ins: '乙', otc: true, generic: '连花清瘟', allergen: '', maxDose: 12, doseUnit: '粒/日', usage: '口服 4粒 每日三次', indication: '流行性感冒属热毒袭肺证', contra: '风寒感冒者不适用', interactions: [] },
    { code: 'Y0029', name: '丹参注射液', alias: '', spec: '10ml/支', unit: '支', price: 12.40, cost: 7.80, mfr: '神威药业', supplier: '华润医药', cat: '中成药', ptype: '针剂', stock: 96, low: 30, batch: 'D240915', expiry: '2027-09-14', ins: '乙', otc: false, generic: '丹参', allergen: '', maxDose: 20, doseUnit: 'ml/日', usage: '静滴 10-20ml 每日一次', indication: '活血化瘀，冠心病辅助治疗', contra: '有出血倾向者禁用', interactions: ['华法林钠片'] },
    { code: 'Y0030', name: '碳酸钙D3片', alias: '钙尔奇', spec: '600mg×60片', unit: '瓶', price: 42.00, cost: 28.50, mfr: '惠氏制药', supplier: '上药控股', cat: '西药', ptype: '口服', stock: 140, low: 40, batch: 'C240704', expiry: '2028-07-03', ins: '乙', otc: true, generic: '碳酸钙', allergen: '', maxDose: 1.2, doseUnit: 'g/日', usage: '口服 1片 每日一次', indication: '钙缺乏症、骨质疏松', contra: '高钙血症禁用', interactions: ['左氧氟沙星注射液'] }
  ];

  /* ---------------- 药物相互作用对照 ---------------- */
H.dict.interactions = [
    { a: '头孢曲松', b: '葡萄糖酸钙', level: '禁忌', note: '头孢曲松与含钙溶液同用可形成不溶性沉淀，禁止同瓶滴注（<48h 新生儿禁用）' },
    { a: '辛伐他汀', b: '克拉霉素', level: '禁忌', note: 'CYP3A4 强抑制，显著升高辛伐他汀血药浓度，增加横纹肌溶解风险' },
    { a: '胺碘酮', b: '左氧氟沙星', level: '禁忌', note: '两者均延长 QT 间期，合用可致尖端扭转型室速' },
    { a: '胺碘酮', b: '阿奇霉素', level: '禁忌', note: 'QT 间期叠加延长，心律失常风险显著升高' },
    { a: '华法林', b: '阿司匹林', level: '严重', note: '抗凝与抗血小板叠加，消化道出血风险明显上升，需监测 INR' },
    { a: '华法林', b: '克拉霉素', level: '严重', note: '抑制华法林代谢，INR 升高，需减量并加强监测' },
    { a: '地高辛', b: '呋塞米', level: '严重', note: '呋塞米致低钾，增加地高辛中毒风险，需补钾并监测血钾' },
    { a: '氯吡格雷', b: '奥美拉唑', level: '注意', note: '奥美拉唑抑制 CYP2C19，降低氯吡格雷活化，建议换用泮托拉唑' },
    { a: '左氧氟沙星', b: '碳酸钙', level: '注意', note: '钙剂络合喹诺酮，口服吸收下降，需间隔 2 小时以上' },
    { a: '美托洛尔', b: '胰岛素', level: '注意', note: 'β受体阻滞剂可掩盖低血糖症状，需加强血糖监测' },
    { a: '布洛芬', b: '阿司匹林', level: '注意', note: '布洛芬竞争性抑制阿司匹林抗血小板作用，且增加消化道损伤' },
    { a: '丹参', b: '华法林', level: '注意', note: '丹参可增强抗凝作用，联用需监测凝血功能' }
  ];

  /* ---------------- 检验项目（含参考范围） ---------------- */
H.dict.labItems = [
    { code: 'L01', name: '白细胞计数', short: 'WBC', unit: '10^9/L', lo: 3.5, hi: 9.5, specimen: '全血' },
    { code: 'L02', name: '中性粒细胞百分比', short: 'NEUT%', unit: '%', lo: 40, hi: 75, specimen: '全血' },
    { code: 'L03', name: '血红蛋白', short: 'HGB', unit: 'g/L', lo: 130, hi: 175, specimen: '全血' },
    { code: 'L04', name: '血小板计数', short: 'PLT', unit: '10^9/L', lo: 125, hi: 350, specimen: '全血' },
    { code: 'L05', name: 'C反应蛋白', short: 'CRP', unit: 'mg/L', lo: 0, hi: 10, specimen: '血清' },
    { code: 'L06', name: '丙氨酸氨基转移酶', short: 'ALT', unit: 'U/L', lo: 9, hi: 50, specimen: '血清' },
    { code: 'L07', name: '血肌酐', short: 'CREA', unit: 'μmol/L', lo: 57, hi: 111, specimen: '血清' },
    { code: 'L08', name: '血钾', short: 'K+', unit: 'mmol/L', lo: 3.5, hi: 5.3, specimen: '血清' },
    { code: 'L09', name: '血糖', short: 'GLU', unit: 'mmol/L', lo: 3.9, hi: 6.1, specimen: '血清' },
    { code: 'L10', name: '降钙素原', short: 'PCT', unit: 'ng/ml', lo: 0, hi: 0.05, specimen: '血清' }
  ];


  /* 药品档案五要素补全：通用名 + 商品名 + 规格 + 剂型 + 医保类别 */
  function formOf(d) {
    var n = d.name;
    if (/胶囊/.test(n)) return '胶囊剂';
    if (/片/.test(n)) return '片剂';
    if (/注射液|注射剂|注射用/.test(n)) return '注射剂';
    if (/溶液/.test(n)) return '口服溶液剂';
    if (/混悬/.test(n)) return '干混悬剂';
    if (/颗粒/.test(n)) return '颗粒剂';
    if (/口服液/.test(n)) return '口服液';
    if (/气雾|喷雾/.test(n)) return '气雾剂';
    return d.ptype || '其他';
  }
  H.dict.drugs.forEach(function (d) {
    d.trade = d.trade || d.alias || '';
    d.form = d.form || formOf(d);
    d.ins = d.ins || '自费';
  });

  /* 治疗处置项目与卫生材料（第三章：治疗处置、卫生材料） */
  H.dict.treatments = [
    { code: 'T01', name: '静脉输液', unit: '次', price: 18.0, ins: '甲' },
    { code: 'T02', name: '肌肉注射', unit: '次', price: 6.0, ins: '甲' },
    { code: 'T03', name: '雾化吸入', unit: '次', price: 22.0, ins: '乙' },
    { code: 'T04', name: '清创缝合（小）', unit: '次', price: 120.0, ins: '甲' },
    { code: 'T05', name: '换药', unit: '次', price: 35.0, ins: '甲' },
    { code: 'T06', name: '心电图检查', unit: '次', price: 25.0, ins: '甲' },
    { code: 'T07', name: '雾化用药指导', unit: '次', price: 10.0, ins: '自费' }
  ];

  H.dict.materials = [
    { code: 'M01', name: '一次性输液器', spec: '0.55mm', unit: '套', price: 4.5, ins: '甲' },
    { code: 'M02', name: '一次性注射器 5ml', spec: '5ml', unit: '支', price: 1.2, ins: '甲' },
    { code: 'M03', name: '无菌纱布块', spec: '8×8cm', unit: '块', price: 0.8, ins: '甲' },
    { code: 'M04', name: '医用绷带', spec: '10cm×6m', unit: '卷', price: 6.0, ins: '甲' },
    { code: 'M05', name: '留置针', spec: '22G', unit: '支', price: 28.0, ins: '乙' }
  ];

  H.dict.examItems = ['胸部正位DR', '胸部CT平扫', '头颅CT平扫', '腹部超声', '心脏彩超', '膝关节MRI', '颈椎MRI', '心电图'];

  /* ---------------- 患者（主索引 + 身份证脱敏） ---------------- */
  H.seed = {};

  H.seed.patients = [
    { id: 'P202611001', mrn: 'M0001231', name: '张建国', sex: '男', age: 63, phone: '138****2210', card: 'C88001231', ins: '职工医保', dept: '内科', doctor: '陈志远', status: '待诊', allergy: '青霉素类', complaint: '咳嗽咳痰 5 天，加重伴发热 1 天', present: '5 天前受凉后出现咳嗽，咳白色粘痰，自行服用止咳糖浆无缓解；1 天前发热，最高 38.6℃，伴乏力、纳差。', past: '高血压 10 年，规律服用苯磺酸氨氯地平；否认药物过敏史（青霉素皮试阳性）。', exam: '咽部充血，双肺呼吸音粗，右下肺可闻及少量湿啰音，心律齐，腹软。', temp: 38.6, bp: '148/92', pulse: 96, visit: '初诊' },
    { id: 'P202611002', mrn: 'M0001232', name: '李秀兰', sex: '女', age: 58, phone: '139****8821', card: 'C88001232', ins: '居民医保', dept: '心血管内科', doctor: '林晓雯', status: '待诊', allergy: '', complaint: '活动后胸闷气短 2 月，加重 3 天', present: '2 月来快步行走后胸闷，休息可缓解；3 天前症状加重，伴夜间阵发性呼吸困难。', past: '2 型糖尿病 6 年，口服二甲双胍，血糖控制欠佳。', exam: '双肺底少量湿啰音，心界稍大，心率 88 次/分，律齐，双下肢轻度水肿。', temp: 36.5, bp: '156/94', pulse: 88, visit: '复诊' },
    { id: 'P202611003', mrn: 'M0001233', name: '王小虎', sex: '男', age: 7, phone: '137****6612', card: 'C88001233', ins: '居民医保', dept: '儿科', doctor: '周敏', status: '待诊', allergy: '头孢类', complaint: '发热 2 天，最高 39.2℃，伴咽痛', present: '2 天前无明显诱因发热，伴咽痛、流涕，无抽搐、无皮疹，精神尚可。', past: '既往体健，否认抽搐史；对头孢类抗生素过敏。', exam: '咽充血，双侧扁桃体 II 度肿大，未见脓性分泌物；双肺呼吸音清。', temp: 38.9, bp: '96/62', pulse: 112, visit: '初诊' },
    { id: 'P202611007', mrn: 'M0001237', name: '孙玉梅', sex: '女', age: 45, phone: '130****5544', card: 'C88001237', ins: '自费', dept: '外科', doctor: '赵启明', status: '待诊', allergy: '', complaint: '右上腹疼痛伴恶心 1 天', present: '1 天前进食油腻后出现右上腹阵发性疼痛，向右肩背放射，伴恶心、呕吐 1 次。', past: '胆囊结石 3 年，间断发作；否认肝炎病史。', exam: '右上腹压痛，Murphy 征阳性，无反跳痛，肠鸣音正常。', temp: 37.8, bp: '126/78', pulse: 92, visit: '复诊' },
    { id: 'P202611008', mrn: 'M0001238', name: '周文彬', sex: '男', age: 52, phone: '131****9900', card: 'C88001238', ins: '职工医保', dept: '心血管内科', doctor: '林晓雯', status: '待诊', allergy: '', complaint: '阵发性心悸 3 月，加重伴头晕 1 天', present: '3 月来反复心悸，每次持续数分钟至数小时；1 天前心悸加重伴头晕、乏力。', past: '房颤病史 1 年，口服华法林，INR 近期未监测。', exam: '心律绝对不齐，心率 118 次/分，未闻及杂音，双肺清。', temp: 36.7, bp: '142/88', pulse: 118, visit: '复诊' },
    { id: 'P202611009', mrn: 'M0001239', name: '吴佳怡', sex: '女', age: 26, phone: '188****3322', card: 'C88001239', ins: '居民医保', dept: '内科', doctor: '陈志远', status: '已完成', allergy: '', complaint: '腹泻 3 天，每日 6-8 次水样便', present: '3 天前进食不洁食物后出现腹泻，水样便，无脓血，伴脐周隐痛。', past: '既往体健，无慢性病史。', exam: '腹软，脐周轻压痛，无反跳痛，肠鸣音活跃。', temp: 37.4, bp: '110/70', pulse: 90, visit: '初诊' },
    { id: 'P202611010', mrn: 'M0001240', name: '郑海峰', sex: '男', age: 40, phone: '159****4400', card: 'C88001240', ins: '职工医保', dept: '外科', doctor: '赵启明', status: '待诊', allergy: '', complaint: '转移性右下腹痛 12 小时', present: '12 小时前脐周疼痛，6 小时后转移至右下腹，呈持续性，伴恶心。', past: '既往体健，无手术史。', exam: '麦氏点压痛、反跳痛，腹肌紧张，肠鸣音减弱。', temp: 38.2, bp: '130/82', pulse: 100, visit: '初诊' }
  ];

  /* 身份证脱敏：只保存掩码与后四位 */
  H.seed.patients.forEach(function (p, i) {
    var tail = String(1000 + i * 137).slice(-4);
    p.idMasked = '430102********' + tail;
    p.idTail = tail;
  });

  /* ---------------- 历次就诊（用于"查询历次就诊与检验检查结果比较"） ---------------- */
  H.seed.visits = [
    {
      id: 'V20260812001', patientId: 'P202611001', date: '2026-08-12', dept: '内科', doctor: '陈志远',
      complaint: '咳嗽 3 天', diagnosis: '急性支气管炎（J20.900）',
      items: [{ code: 'Y0009', name: '氨溴索口服溶液', spec: '100ml:0.6g', qty: 1, price: 26.5, usage: '口服 10ml 每日三次' }],
      total: 26.5, labs: [{ code: 'L01', v: 9.1 }, { code: 'L05', v: 12.4 }], status: '已提交'
    },
    {
      id: 'V20261003002', patientId: 'P202611001', date: '2026-10-03', dept: '内科', doctor: '陈志远',
      complaint: '咳嗽复发伴低热', diagnosis: '急性支气管炎（J20.900）',
      items: [{ code: 'Y0008', name: '头孢呋辛酯片', spec: '0.25g×12片', qty: 1, price: 42.7, usage: '口服 0.25g 每日两次' }],
      total: 42.7, labs: [{ code: 'L01', v: 11.2 }, { code: 'L05', v: 24.6 }], status: '已提交'
    },
    {
      id: 'V20261110003', patientId: 'P202611002', date: '2026-11-10', dept: '心血管内科', doctor: '林晓雯',
      complaint: '活动后胸闷', diagnosis: '冠状动脉粥样硬化性心脏病（I25.103）',
      items: [{ code: 'Y0014', name: '阿司匹林肠溶片', spec: '100mg×30片', qty: 1, price: 15.6, usage: '口服 100mg 每日一次' }],
      total: 15.6, labs: [{ code: 'L07', v: 96 }, { code: 'L09', v: 7.8 }], status: '已提交'
    }
  ];

  /* ---------------- 检验 / 检查申请（门诊开具后进入医技科室队列） ---------------- */
  H.seed.labOrders = [
    {
      id: 'LB20261126001', patientId: 'P202611001', patient: '张建国', dept: '内科', doctor: '陈志远',
      items: ['L01', 'L02', 'L05', 'L10'], specimen: '全血', time: '2026-11-26 09:18', status: '待审核',
      results: [{ code: 'L01', v: 13.6 }, { code: 'L02', v: 86.2 }, { code: 'L05', v: 42.8 }, { code: 'L10', v: 0.62 }], tech: '赵敏', reviewer: '孙立'
    },
    {
      id: 'LB20261126002', patientId: 'P202611002', patient: '李秀兰', dept: '心血管内科', doctor: '林晓雯',
      items: ['L06', 'L07', 'L09', 'L08'], specimen: '血清', time: '2026-11-26 09:05', status: '检验中', results: [], tech: '钱伟', reviewer: ''
    }
  ];

  H.seed.exams = [
    { id: 'EX20261126001', patientId: 'P202611001', patient: '张建国', modality: 'DR', item: '胸部正位DR', part: '胸部', time: '2026-11-26 09:25', status: '待审核', report: '双肺纹理增粗，右下肺可见斑片状模糊影。', conclusion: '右下肺炎症可能', doctor: '许文', reviewer: '' },
    { id: 'EX20261126002', patientId: 'P202611007', patient: '孙玉梅', modality: 'US', item: '腹部超声', part: '肝胆胰脾', time: '2026-11-26 10:00', status: '已发布', report: '胆囊内可见多个强回声团，伴声影，最大约 1.2cm。', conclusion: '胆囊多发结石', doctor: '林芳', reviewer: '高翔' }
  ];

  /* 已提交处方：状态用于展示"已传送至收费与药房" */
  H.seed.prescriptions = [
    {
      id: 'RX20261126003', patientId: 'P202611009', patient: '吴佳怡', dept: '内科', doctor: '陈志远',
      time: '2026-11-26 10:05', status: '已发药', total: 28.6, diagnosis: '感染性腹泻（A09.900）',
      items: [{ code: 'Y0007', name: '对乙酰氨基酚片', spec: '0.5g×20片', qty: 1, price: 9.8, usage: '口服 0.5g 必要时' }, { code: 'Y0018', name: '氯化钾缓释片', spec: '0.5g×24片', qty: 1, price: 13.4, usage: '口服 1g 每日两次' }]
    }
  ];

  /* 医嘱/处方模板（第三章：常用临床项目字典、医嘱模板及编辑功能） */
  H.seed.templates = [
    {
      id: 'TPL01', name: '上呼吸道感染', owner: '陈志远', dept: '内科',
      items: [{ code: 'Y0009', qty: 1, usage: '口服 10ml 每日三次' }, { code: 'Y0007', qty: 1, usage: '口服 0.5g 必要时' }],
      note: '对症治疗，嘱多饮水、休息'
    },
    {
      id: 'TPL02', name: '高血压随访', owner: '林晓雯', dept: '心血管内科',
      items: [{ code: 'Y0011', qty: 2, usage: '口服 5mg 每日一次' }, { code: 'Y0014', qty: 1, usage: '口服 100mg 每日一次' }],
      note: '监测血压，2 周复诊'
    }
  ];

  /* ---------------- 用户（仅医生与管理员；口令为 PBKDF2 哈希） ---------------- */
  H.seed.users = [
    { id: 'U002', username: 'doctor', name: '陈志远', role: 'doctor', dept: '内科', title: '主任医师', salt: 'edea81bf63e211bbe47ef4e9ac0dec27', hash: '8b6985e3901901b866182bd34cbe96b6dd3faa090e94f3461f59ad2ea8079557', iter: 120000, locked: false },
    { id: 'U001', username: 'admin', name: '王建国', role: 'admin', dept: '信息科', title: '系统管理员', salt: 'f2d7575f41a40e4ab7f0a56a431d03e0', hash: '56f02f6d5e01a265e0b9ea0debc05abb329cc44474c4852b9b21d0ab7cef2db1', iter: 120000, locked: false }
  ];


})(window.HIS);
