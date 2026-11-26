/* ==========================================================================
   HIS · 前端运行配置 (config.js)
   对应部署规范：真实密钥不进仓库（.env / 平台环境变量）
   ========================================================================== */
window.HIS = window.HIS || {};
HIS.config = {
  APP_NAME: '医院信息系统',
  APP_VERSION: '3.0.0',
  API_BASE: '',                 // 后端地址，留空表示本地演示模式
  AI_ENDPOINT: '',              // 智能分诊 LLM 接口，留空走本地规则降级
  AI_KEY: '',                   // 绝不写入仓库；由部署环境注入
  AI_TIMEOUT: 10000,            // 10 秒超时兜底
  SESSION_HOURS: 8,             // 令牌有效期
  IDLE_MINUTES: 30,             // 空闲超时
  PBKDF2_ITER: 120000,          // 口令派生迭代次数（后端对应 bcrypt）
  TOKEN_SECRET: 'his-demo-signing-key-not-for-production'
};
