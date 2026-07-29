# AI Museum 公开知识与运营指标 — Stage 3 本地验证

> 状态：实现候选已完成，本地自动化验证通过（2026-07-29）
> 上游方案：[24-public-knowledge-and-metrics-solution-definition.md](./24-public-knowledge-and-metrics-solution-definition.md)

## 1. 实现范围

- 建立无需登录、无需 Cookie、不会调用模型的公开知识层：主页、方法页、人物索引与详情、时期索引与详情、展厅详情。
- 为 36 位人物、3 个时期和 9 个展厅生成稳定 URL、canonical、metadata、内部链接与适用的 JSON-LD。
- 增加 `sitemap.xml` 与 `robots.txt`，只允许公开内容进入索引，并保护账户、对话、管理、API 和个人数据区域。
- 复用现有 Session 的 `last_seen_at` 实现 60 秒轻量 heartbeat，不引入 Redis、WebSocket、设备指纹或新的 presence 表。
- 增加仅管理员可见的注册、在线、新增与活跃指标；公开在线人数默认关闭，开启时也只显示达到隐私门槛后的分档值。

## 2. 自动化验证

本地候选需要同时通过以下门禁：

- 全工作区 TypeScript 类型检查；
- 全工作区单元与路由测试；
- 全工作区生产构建；
- 公开发现测试，覆盖 sitemap URL 集合、robots 私有路径规则与公开页面数据完整性；
- presence 与运营指标测试，覆盖认证、管理员授权、去重、时间窗口、排除测试账户、公开分档和数据库不可用降级；
- `git diff --check`。

关系合并测试中原有一个依赖毫秒先后顺序的场景，在全量并发时可能偶发失败。本次只将该测试改为固定时钟并明确推进一秒，使“重置前游客数据”的前置条件可重复；没有修改对应生产逻辑。

## 3. HTTP 烟雾验证

本地服务运行在 `http://localhost:3010`，使用本地测试账户配置，仅用于开发验证。已通过 HTTP 请求确认：

- `/`、`/about`、人物、时期、展厅、`/sitemap.xml`、`/robots.txt` 与公开 presence API 返回 200；
- 公开页面不设置身份 Cookie，并在首屏 HTML 中输出标题、正文、canonical 与 JSON-LD；
- sitemap 包含 52 个公开 URL；
- robots 明确允许公开抓取并禁止 `/api/`、`/admin`、`/account`、`/museum`、`/memories`、`/learning`、`/agents` 与 `/studio`；
- 登录产品页面带有 `noindex`；
- 未登录 heartbeat 返回 401。

## 4. 当前环境未执行项

- 当前内置浏览器的安全策略明确拒绝访问 `http://localhost:3010`，因此没有绕过策略，也没有将真实浏览器视觉验收标记为通过。
- 当前环境没有可用的本地 PostgreSQL/Docker 服务，因此迁移与真实 SQL 聚合尚未在 PostgreSQL 上执行；查询与路由已由单元测试覆盖。
- Search Console、Bing Webmaster、真实爬虫抓取、索引覆盖和 AI 引用只能在部署到公开域名后验证。

## 5. 本地验证结论

实现候选满足已批准的功能边界；自动化、生产构建和 HTTP 输出是本阶段的完成门槛。真实浏览器视觉检查、PostgreSQL 集成和生产索引观测继续保留为发布前门禁，不因本地限制被视为通过。
