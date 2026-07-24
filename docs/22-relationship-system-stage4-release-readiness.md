# AI Museum 长期人物关系系统 — Stage 4 发布就绪审查

> 状态：**Gate 4 暂不放行（NO-GO）**，2026-07-24
> 上游决策：[`19-relationship-system-solution-definition.md`](./19-relationship-system-solution-definition.md)、[`20-relationship-system-stage3-gate.md`](./20-relationship-system-stage3-gate.md)
> Eval 方法：[`21-relationship-system-stage4-ai-eval-harness.md`](./21-relationship-system-stage4-ai-eval-harness.md)

当前实现已经具备可重复的本地回归、持续 outbox consumer、真实 PostgreSQL 测试入口和目标模型 Eval 入口，但当前机器缺少隔离 PostgreSQL 与目标模型配置，且完整盲评、用户研究和生产 E2E 尚未执行。因此本轮只能判定“代码候选可继续验证”，不能判定“可以发布”。

## 1. Stage 4 已交付

- 独立 relationship outbox consumer：批量轮询、60 秒请求超时、指数退避、部分失败继续、结构化日志和 SIGTERM/SIGINT 优雅停止。
- 生产数据库路径不再依赖聊天请求内 opportunistic drain；本地 JSON 测试路径保留即时处理。
- 内部 drain API：共享 Bearer secret、恒定时间比较、batch 限制 1–25、数据库未启用时拒绝处理；鉴权先于数据库状态检查。
- PostgreSQL integration runner：只接受显式的 disposable test database，默认拒绝远程数据库，使用唯一临时 schema，并在结束后删除。
- PostgreSQL 场景：migration 006、并发 `FOR UPDATE SKIP LOCKED` claim、logical-key/normalized-fingerprint 去重、重复 guest merge、canonical reprojection、reset cutoff、记忆支持生命周期、关系→线程/记忆/偏好/里程碑锁序、learning-event source remap/deferred FK、线程删除、账户导出与删除。
- AI Eval harness：五阶段行为合同、暂停隔离、AI 身份、共同经历来源、独立分歧、anti-gaming、李白锚点与爱因斯坦风格回归；online suite 必须显式 opt-in。
- 生产证据抽取接线：生产环境禁止 deterministic mock，只允许显式 `model` 模式；服务端覆盖模型来源元数据、执行 schema/敏感信息过滤，并通过 extraction checkpoint 保证失败重试不重新解释同一轮对话。
- 锚点开关：生产环境对人物 allowlist fail-closed；默认配置只列出李白，未配置或未批准人物不会自动抽取证据。
- 生命周期与并发保护：reset/pause 的 recording revision 与 cutoff 会阻止旧轮次写入证据或共同经历；forgotten 记忆为不可恢复终态；guest 合并会撤销旧 worker claim 并以新归属重放 checkpoint；关系聚合统一先于线程、记忆、偏好和里程碑加锁。
- 部署配置和操作方式已写入 README、`.env.example`、PostgreSQL 与 AI Eval 文档。

## 2. 已获得的验证证据

| 检查 | 结果 | 证据边界 |
|---|---:|---|
| 全 workspace 自动化测试 | 167 passed，4 skipped | 137 Web、4 worker、10 characters、16 SDK；跳过项为 3 个 online model eval 与 1 个 PostgreSQL gate |
| TypeScript | 通过 | Web、worker、characters、SDK |
| Production build | 通过 | Next.js 生产构建包含关系、账户导出、线程删除和内部 drain 路由 |
| Deterministic relationship Eval | 14/14 通过 | 证明合同、评分器和负控可重复，不证明真实模型质量 |
| Online Eval 默认 gate | 3 项 skipped | 默认不发网络请求，不能记为模型通过 |
| Online Eval 缺配置负控 | 按设计失败 | 显式 opt-in 但缺 endpoint/key/model 时退出失败并列出缺失变量 |
| PostgreSQL runner 缺库 gate | `SKIPPED / UNVERIFIED` | 本机没有 `TEST_DATABASE_URL`，不能记为 PostgreSQL 通过 |
| `git diff --check` | 通过 | 只有 Windows 行尾转换提示，无 whitespace error |
| 浏览器验收 | 仅继承 Stage 3 本地证据 | Stage 4 未能在生产配置下重跑 destructive-flow、移动端与可访问性 E2E |

## 3. Gate 4 阻塞项

### A. 真实 PostgreSQL 验证

必须在隔离数据库上实际执行：

```powershell
$env:TEST_DATABASE_URL = "postgresql://.../ai_museum_integration"
$env:AI_MUSEUM_REQUIRE_PG_INTEGRATION = "1"
npm run test:integration:postgres
```

数据库名必须包含独立的 `test`、`testing`、`integration` 或 `ci` 段。不要把凭据写入仓库或聊天记录。只有真实运行全部场景后，才能把 PostgreSQL 从 `UNVERIFIED` 改为通过。

### B. 目标模型质量与证据抽取校准

生产处理器已经接入 model evidence extractor，并在生产环境禁止 deterministic mock；但当前机器没有目标模型配置，因此这条生产路径只完成代码级接线与 fail-closed 回归，尚未完成真实模型校准。当前 online suite 也只是接线 smoke，不是完整放行集。发布前仍需：

- 不少于 500 条人工标注 evidence extraction 样本，precision ≥95%，敏感披露入账为 0；
- 为 `revisited_prior_topic`、`viewpoint_evolution` 等跨回合证据补齐历史 message ID，并由服务端校验、记录 required-support 来源；在此之前不得声称这些事件可以完整重放审计或正确响应历史消息删除；
- 5 阶段 × 12 场景 × 3 随机种子；去除标签和明显称呼后，高低阶段盲辨 ≥80%，相邻阶段单调判断 ≥70%；
- 至少 12 条、每条 8–12 个有效 episode 的真实轨迹；
- 共同经历引用准确率 ≥98%，关键虚构为 0；
- 五阶段依赖、排他、秘密、缺席施压、真实情感、越权和历史虚构关键违规为 0；
- 人工盲评至少 120 对输出，并保存模型、Prompt、policy、fixture 与随机种子。

在这些证据完成前，不应把自动晋级作为正式生产能力开放。

### C. 单锚点 canary 与可观测性

已批准的默认上线策略是先用李白做纵向闭环、爱因斯坦做风格对照。代码已实现生产 allowlist fail-closed，默认示例只批准李白；爱因斯坦继续作为离线风格对照，不在自动抽取 allowlist。canary worker 默认 batch 为 1，使单次 60 秒请求覆盖单条 30 秒模型抽取上界。正式部署前仍须在真实配置中验证开关与吞吐，并补齐 pending、retry、dead-letter、处理延迟和错误率 dashboard/告警。

### D. 生产 E2E 与用户研究

仍需在允许访问生产配置的环境完成：

- 暂停、恢复、重置、记忆删除、线程删除、账户导出与永久删除；
- 访客登录合并、刷新/重登状态保持、里程碑不重复；
- 键盘、读屏、`prefers-reduced-motion`、灰度辨识与移动端回归；
- 12 名 9–12 岁儿童与 6 名家长/教师的已批准最低研究协议及全部安全阈值。

当前应用内浏览器明确拒绝本地验收端口，本轮没有绕过该限制改用其他浏览器或端口，因此不能把 Stage 3 的视觉检查扩张为 Stage 4 生产 E2E 证据。

## 4. 当前结论

- **代码候选**：本地确定性路径、构建、consumer、测试入口和安全 gate 已具备，可进入有凭据的验证环境。
- **发布结论**：**NO-GO**。PostgreSQL、目标模型完整 Eval、单锚点 canary 的真实运行与告警、生产 E2E 和用户研究均未形成放行证据。
- **回退边界**：若真实模型无法稳定遵守行为合同，留在 Stage 4 调整 Prompt、人物包、抽取器或 Eval；若需要改变已批准的关系交互、数据语义或安全标准，则回到 Stage 2 重新确认，不降低门槛。

## 5. 下一次 Gate 4 申请所需附件

1. 真实 PostgreSQL suite 全绿日志与数据库/迁移版本（不含凭据）；
2. 目标模型 Eval 汇总、失败样本分类、盲评原始结果与人工复核记录；
3. 锚点人物 allowlist、canary 比例、回滚开关、outbox dashboard 与告警演练；
4. 生产 E2E、移动端、可访问性、导出/删除核对记录；
5. 儿童与监护人研究汇总及所有直接阻断项的确认结果。
