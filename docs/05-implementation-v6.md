# Stage 5 v6 — 本地工程实现

- 日期：2026-07-16
- 状态：Completed; first Browser review performed
- 技术基线：[04-tech-design-v6.md](./04-tech-design-v6.md)
- 浏览器评审：[05-browser-review.md](./05-browser-review.md)
- 本地地址：`http://localhost:3010`

## 已完成

- 建立3个历史时期、9个展厅、36个唯一人物的统一 Catalog；
- 每组12人，卡级分布均为白3、蓝3、紫3、橙2、金1；
- 36位人物均通过同一人物包 Repository 暴露给线程 Runtime；
- 增加服务端收藏、学习事件、探索星、史料碎片和抽取事务；
- 首次相遇奖励幂等，首次免费抽取保证未拥有；
- 抽取结果在响应和揭晓前提交，刷新后从服务端恢复；
- 增加 `/api/explore`、`/api/exploration-events`、`/api/draws` 和 reveal API；
- 用 v6 完整旅程替换旧 `/museum` 双栏聊天界面；
- 增加儿童/成人表现模式、时期馆、展厅、人物资料、悬浮关系搜索、卡包、卡册和长期线程；
- 已获得人物进入原有唯一线程，历史消息、人物记忆和引用继续生效；
- 增加 OpenAI-compatible 服务端模型通道：`MODEL_API_URL`, `MODEL_API_KEY`, `MODEL_NAME`；
- 未配置 Key 时持续显示规则模式，不宣称执行模型能力；
- Studio、Memory、Learning 和 Agent 页面继续保留为独立产品区域。

## 本地存储说明

本地开发使用 `data/runtime/platform.json` 作为 Repository 适配器，验证刷新和服务重启恢复。生产架构仍以 PostgreSQL、事务、revision 和幂等唯一约束为准；JSON 文件不支持多实例并发。

## 验证结果

- `npm run typecheck`：通过；
- `npm test`：32项测试通过；
- `npm run build`：Next.js 生产构建通过；
- Browser：桌面儿童/成人模式、390px窄屏、核心旅程、抽卡恢复、关系搜索、长期线程和引用均已测试；
- 应用控制台：0条 error/warn；
- npm audit：2个中等级依赖告警，未执行破坏性 `--force` 升级，需在后续依赖维护中单独处理。

## 当前限制

- 当前环境未配置真实模型 Key，因此 Browser 对话验证运行在明确标记的规则模式；
- 35个新增人物包是本地 UI/线程样例，只含最小简介，不满足公开发布所需的20条 Claim、3个来源和完整评测门槛；
- PostgreSQL、对象存储、OCR/转录和真实媒体生成不属于本切片。
