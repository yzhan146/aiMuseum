# AI Museum 公开知识与运营指标 — Stage 4 发布准备

> 状态：本地候选完成，生产发布暂为 NO-GO（2026-07-29）
> 原因：仍需目标环境 PostgreSQL 迁移验证、真实浏览器验收与公开域名索引配置。

## 1. 发布内容

- 公开知识 URL、导航、metadata、canonical、JSON-LD、sitemap 和 robots；
- 登录用户的轻量 Session heartbeat；
- 管理员运营指标页与 API；
- 默认关闭的公开在线人数分档组件；
- presence 查询索引迁移 `007_presence_metrics_index.sql`；
- 环境变量、运行说明、设计与验证文档。

## 2. 发布前必须完成

1. 在目标 PostgreSQL 备份与迁移流程中执行 `npm run db:migrate`，确认新索引成功建立且现有 Session 查询无回归。
2. 设置生产 `APP_BASE_URL` 为唯一 HTTPS canonical 域名。
3. 设置 `ADMIN_EMAIL_ALLOWLIST`；按需设置 `METRICS_EXCLUDED_EMAILS` 与 `METRICS_TIME_ZONE`。
4. 保持 `PUBLIC_ONLINE_PRESENCE=false`，直至真实在线量达到展示门槛且运营方明确决定开启。
5. 使用真实浏览器检查桌面与移动端的主页、人物、时期、展厅、登录入口和管理员指标页。
6. 在未登录环境确认公开页面无 Cookie、无模型请求、无持久化写入；在普通账号环境确认无法访问管理员指标。
7. 复跑全量类型检查、测试和生产构建。

## 3. 上线后检查

- 请求抽查公开 canonical、JSON-LD、sitemap 与 robots 的生产域名；
- 向 Google Search Console 与 Bing Webmaster 提交 sitemap，并观察抓取错误和索引覆盖；
- 检查注册总数、当前在线、今日/7 日/30 日新增与活跃是否符合数据库抽样；
- 观察 heartbeat 请求量、数据库耗时和错误率；
- 观察公开内容访问到注册、邮箱验证与首次人物对话的漏斗；
- 记录来自搜索与 AI 引用来源的 referrer/UTM，但不采集私人对话内容。

## 4. 回滚策略

- 指标异常：关闭管理员页面入口或回滚应用版本；索引可保留，因为它只优化查询且不改变业务数据。
- heartbeat 压力异常：移除受保护页面中的 heartbeat 组件或延长间隔；Session 认证仍可独立工作。
- 公开在线造成负面体验：将 `PUBLIC_ONLINE_PRESENCE` 设为 `false`，无需回滚公开知识页。
- SEO 输出错误：修正 `APP_BASE_URL` 或回滚公开路由；在确认 canonical 与 sitemap 正确前暂停提交搜索平台。
- 公开知识内容错误：按人物或展厅包修正版本化资料，保持 URL 稳定。

## 5. Go / No-Go 标准

只有在下列条件全部满足后改为 GO：

- 目标 PostgreSQL 迁移及指标抽样通过；
- 真实浏览器桌面与移动验收通过；
- 生产 canonical、robots、sitemap 与 noindex 边界正确；
- 管理员 allowlist 和普通用户拒绝路径通过；
- 全量自动化验证通过；
- 已指定上线后观测负责人和回滚执行人。

当前候选可以进入部署环境验证，但不应把尚未执行的生产门禁解释为已经通过。
