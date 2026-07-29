# AI Museum 公开知识与运营指标 — Stage 2 Solution Definition

> 状态：Stage 2 已批准并进入实施（2026-07-29）
> 上游决策：[`23-public-knowledge-and-metrics-outcome-definition.md`](./23-public-knowledge-and-metrics-outcome-definition.md)
> 批准说明：用户明确确认轻量 heartbeat 足够、其余方案合理，并授权完成实现。

## 1. 信息架构

```text
/
├─ /about
├─ /people
│  └─ /people/[characterId]
├─ /periods
│  └─ /periods/[periodId]
├─ /halls/[hallId]
├─ /login, /register
└─ /museum                         登录产品

/admin/metrics                     管理员运营面板
/api/presence/heartbeat            登录 Session heartbeat
/api/admin/metrics                 精确指标，仅管理员
/api/public/presence               可选公开分桶
```

公开实体页由 `@ai-museum/characters` 的版本化 catalog、exhibit 和 hall pack 在服务端生成。登录产品继续使用现有 API 和持久化层。

## 2. 页面合同

### 首页

- 第一屏清楚说明“有来源的历史人物学习与长期关系”；
- 展示三个时期入口、代表人物、方法与安全承诺；
- 主要 CTA 为浏览人物，次要 CTA 为登录进入博物馆；
- 在线分桶仅在配置开启且人数达到 10 时出现。

### 人物页

- 主体：姓名、年代、时代、策展摘要；
- 生平关键转折、影响、后世评价、作品与发现；
- 相关人物和所属展厅使用普通链接；
- “可以继续追问”采用已有 conversation starters，但不在公开页调用模型；
- 来源区展示人物包中真实 title、creator、URL、locator 和授权信息；
- 明示这是教育性 AI 演绎，公开页内容不等于人物真实发言。

### 时期与展厅页

- 时期页组织 inquiry、展厅和完整人物名册；
- 展厅页展示核心问题、导览、主题物件、意义、人物网络、反思问题和内容提示；
- 所有实体通过可抓取链接互联。

### 方法页

- 回答 AI Museum 是什么、来源如何使用、模型知道什么、关系和记忆如何工作、儿童边界是什么；
- 采用清楚标题和直接答案，但不制造批量 FAQ 页面。

## 3. SEO / AEO / GEO 合同

- Next.js server components + `generateStaticParams`；
- 每页 `generateMetadata` 输出 title、description、canonical、Open Graph；
- 根 layout 配置 `metadataBase`，生产由 `APP_BASE_URL` 决定；
- sitemap 包含首页、方法页、索引页和全部公开实体；
- robots 允许公开页面与 OAI-SearchBot，保护 `/api/`、`/admin/`、`/account/`、`/museum/`、`/memories/`、`/agents/`、`/studio/`；
- 人物页输出 `Person` 与 `BreadcrumbList` JSON-LD，首页输出 `Organization`/`WebSite`；
- JSON-LD 只复述页面可见且有依据的内容；
- 未知实体返回真实 404。

## 4. Presence 与指标

### Heartbeat

- 客户端组件只在存在登录账户的 layout 中启用；
- 页面可见时立即发送，之后每 60 秒发送；重新可见时立即发送；
- `POST /api/presence/heartbeat` 只从 HttpOnly Session Cookie 解析账户；
- 复用 `auth_sessions.last_seen_at`，无额外 presence 表；
- heartbeat 请求不返回用户信息。

### 统计查询

- `registeredTotal`：verified credential + non-deleted user；
- `onlineNow`：有效未撤销 Session 在最近 2 分钟出现过，按 `user_id` 去重；
- `newToday/new7d/new30d`：按 `email_verified_at`；
- `activeToday/active7d/active30d`：按 `last_seen_at` 去重；
- 多 Session 与多设备不重复计数；
- 本地无数据库时返回明确 unavailable 状态，不伪造数据。

### 管理员授权

- MVP 使用 `ADMIN_EMAIL_ALLOWLIST`，逗号分隔并规范化邮箱；
- 页面与 API 都在服务端校验 current account；
- 失败返回 404 或 403，不将指标数据嵌入普通页面；
- 后续如需多角色管理再引入 RBAC，不在本次预埋。

### 公开在线分桶

- `PUBLIC_ONLINE_PRESENCE=true` 才启用；
- `<10` 返回 `null`；10–99 向下取整到 10，100–999 向下取整到 50，1000 以上向下取整到 100；
- 公共响应缓存 30 秒，只暴露 label 与更新时间；
- UI 文案为“X+ 位探索者正在馆内”，不显示注册总数。

## 5. 安全、隐私与失败处理

- heartbeat 使用现有 same-origin 保护；
- 管理员 API 不接受 email/userId 查询参数；
- 不采集页面轨迹、IP、设备指纹或匿名持久标识；
- 数据库不可用时管理员页显示不可用，公开在线组件自动隐藏；
- 统计查询不读取消息、记忆、关系证据等私人表；
- robots 是索引提示而非访问控制，私人页面继续依赖真实认证。

## 6. 验证计划

- 单元测试：分桶、allowlist、统计语义、公开内容解析；
- Route 测试：heartbeat 未登录/同源/成功、管理员拒绝、公共开关；
- 静态输出：全部 36 人、3 时期、9 展厅生成；
- `sitemap.xml` 与 `robots.txt` 快照/语义测试；
- 生产构建确认所有公开实体可预渲染；
- 浏览器验收：公开首页 → 时期 → 展厅 → 人物 → 登录；管理员指标页；移动端与无数据库降级。
