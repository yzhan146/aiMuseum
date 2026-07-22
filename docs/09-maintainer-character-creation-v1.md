# 维护者人物创建体验与对象模型 v1

## 1. 设计结论

维护者创建的核心单位是 `CharacterDraftObject`，正式发布的核心单位仍是不可变的 `CharacterPack`。两者不能混为一体：AI 可以补全草稿对象，但只有维护者确认、来源检查和发布审核后，草稿才能编译成人物包版本。

一次创建请求是 `CharacterCreationProject`，可以包含一个人物，也可以包含 2–24 人的一组人物。组不是人物本身，它只负责共享时期、地点、主题、可恢复任务和总体进度；每个人物仍有独立的草稿、失败状态和确认结果。

## 2. 用户流程

### 页面一：选择创建方式

页面只提供两个主要选择：

- 创建一个人物；
- 创建一组人物。

组模式适合“唐代诗人”“索尔维会议人物”等主题。维护者随时可以保存并离开。

### 页面二：告诉我们是谁

每个人物第一轮只要求姓名。为避免同名混淆，再提供可选的年代、国家或地区、身份、别名和一段补充说明。组模式使用可增删的简洁名单，同屏只展开当前正在编辑的一人。

系统先做重复人物与身份消歧。如果存在多个合理候选，只展示最多三个候选，让维护者选择；不能由 AI 静默猜测。

### 页面三：确认 AI 准备计划

系统用三个区块说明将要执行的工作：

1. 补充生平、影响、作品与教育主题；
2. 生成轻快版和典藏版头像；
3. 查找人物关系并记录公开来源或“模型建议”标记。

维护者可关闭网络检索、头像生成或关系建议。开始后创建可暂停、恢复、取消的 Agent Task；一个人物失败不阻断整组其他人物。

### 页面四：等待与邮件通知

任务卡显示“确认身份 → 整理资料 → 生成头像 → 建立关系 → 完整性检查”五步，不展示模型参数。全部人物达到可审核状态后发送一封邮件；部分失败时邮件明确列出需要补充的对象。

### 页面五：确认人物

每次只要求关注三个区块：

- 身份与生平；
- 两种头像与人物表达；
- 关系与来源。

AI 内容以“建议”显示。维护者可以修改、接受或拒绝；公开来源和模型常识必须区分，模型建议不能伪装成史料。确认邮件中的链接使用一次性哈希令牌，进入登录后的审核页，不直接发布。

### 页面六：完成添加

确认后生成私有人物草稿及 `0.1.0` 人物包。维护者可以私下试聊、补充资料和运行评测；公共发布仍需独立提交审核。

## 3. 数据边界

```text
CharacterCreationProject
  ├─ CharacterIdentityHint[]       用户最初提供的信息
  ├─ AgentTask[]                   可恢复的补全任务
  ├─ CharacterDraftObject[]        AI 与维护者共同完善的草稿
  │    ├─ profile                  生平、影响、作品、教育主题
  │    ├─ portraits                cartoon / realistic
  │    ├─ relationshipCandidates  带状态和来源的人物关系
  │    ├─ sources                  用户、公开网页、模型或生成媒体
  │    └─ completeness             缺项和阻断问题
  └─ CharacterConfirmation        邮件确认状态与哈希令牌
             ↓ creator confirms
         CharacterPack 0.1.0      私有、可试聊、尚未发布
```

建议生产表：

- `character_creation_projects`：所有者、单人/组模式、组名、策略、状态；
- `character_creation_items`：每个待创建人物及消歧输入；
- `character_draft_objects`：补全结果、完整度、revision；
- `portrait_candidates`：风格、对象存储键、生成参数、来源和权限；
- `relationship_candidates`：目标人物、关系类型、置信度、来源和审核状态；
- `character_confirmations`：收件邮箱、令牌哈希、过期时间和确认时间；
- 已有 `agent_tasks`、`agent_steps`、`source_assets` 继续复用。

## 4. API 草案

- `POST /api/studio/creation-projects`：创建单人或组项目；
- `POST /api/studio/creation-projects/:id/start`：确认计划并启动补全；
- `GET /api/studio/creation-projects/:id`：读取总体和逐人物进度；
- `PATCH /api/studio/character-drafts/:id`：修改建议字段，使用 revision 防并发覆盖；
- `POST /api/studio/character-drafts/:id/relationships/:relationId/review`：接受或拒绝关系；
- `POST /api/studio/creation-projects/:id/send-confirmation`：发送完成邮件；
- `POST /api/studio/creation-projects/:id/confirm`：消费一次性令牌并生成人物包草稿。

## 5. 不可妥协的规则

- 只有已故人物可以进入公共发布流程；
- AI 可以建议身份、关系和资料，不能自动确认或发布；
- 公开网络信息必须保存 URL、抓取时间和允许保存的摘录；
- 模型知识没有可核验来源时必须标为 `model-knowledge`；
- 两张头像分别保存生成来源和展示/再分发权限；
- 同名消歧、重复人物、缺少死亡依据、头像缺失或关系无来源会阻止完成确认；
- 邮件确认只确认草稿内容，不等于公共发布许可。
