# Stage 5 — 沉浸式历史展厅实施记录

- 日期：2026-07-22
- 状态：Implemented；post-Stage-5 remediation 已完成
- PRD：[11-immersive-halls-prd.md](./11-immersive-halls-prd.md)
- UI / UX：[12-immersive-halls-design.md](./12-immersive-halls-design.md)
- 技术设计：[13-immersive-halls-tech-design.md](./13-immersive-halls-tech-design.md)

## 完成范围

1. SDK 新增 `ExhibitPack`、`HallSceneManifest`、`MuseumObject`、资产、四站路线和访问状态 Zod Schema。
2. 九个公开展厅均拥有不可变 `1.0.0` 内容包、主题 Token、核心物件、来源说明、人物关系标签和离场问题。
3. 九张源 PNG 派生为版本化 WebP，单张约 99–184 KB，位于 `/exhibits/{hallId}/1.0.0/scene.webp`。
4. 新增共享 `HallScene` 渲染器：入口主视觉、四站路线、物件展签抽屉、人物关系墙、离场问题和表现性质标识。
5. 新增 `/api/halls/:id`、`/api/halls/:id/progress`、`/api/exhibit-objects/:id`，并扩展 `/api/explore` 的 `sceneRef`、预览资产和核心物件名称。
6. 新增 `hall_visit_states` PostgreSQL migration；无数据库测试环境使用现有本地平台存储。
7. 人物入口、时期馆、关系/时间线、视觉模式选择和移动端路线已串成闭环。
8. 访问物件不发奖励；历史主题图片明确标注为艺术重建。

## 验证

- `npm run typecheck`：通过。
- `npm test`：Web 41、人物包 10、SDK 8，共 59 项通过。
- `npm run build`：Next.js 生产构建通过；展厅 API 与 `/museum` 路由成功生成。
- 首轮 Browser：九厅 API、九张 WebP、四站路线、展签、关系图、桌面和移动端均可达；无破图和 console error。
- 唯一 remediation：移动端专注页面隐藏重复固定底栏，并收敛显示设置按钮。

## 测试专用入口

`E2E_TEST_ACCOUNT=true` 只用于没有 PostgreSQL 的本地无头浏览器测试。生产 Render 不得配置该变量；正常生产仍必须经过邮箱账户登录。
