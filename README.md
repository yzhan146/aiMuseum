# AI Museum

一个面向历史学习的开放平台：用统一的知识、记忆、对话与媒体框架承载可扩展历史人物。

AI Museum 不是把人物写死在应用里，也不为每个人物训练独立模型权重。人物由声明式人物包描述；公开回答只能使用已发布、人工审核且仍有有效来源的 Claim。社区可以贡献平台代码，也可以独立维护人物包、史料和媒体资产。

> 当前状态：`0.1.0` 本地开发基线。界面与主要数据流可运行；除示范内容外的人物仍属于预览目录，不能视为已经完成史料审核的公开人物包。

## 现在可以体验什么

- 按历史时期、地点和人物关系探索3组共36位样例人物；
- 在“轻快版”和“典藏版”之间切换，功能和史实不变；
- 与每位人物保持相互隔离的长期线程和关系记忆；
- 查看回答使用的 Claim、来源位置和人物包版本；
- 使用创作台、导入任务、审核接口和 Agent 任务框架；
- 在未配置模型时使用明确标注的规则模式，配置兼容 API 后使用 LLM 回答。

## 技术结构

```text
apps/web          Next.js 访客端、维护者创作台与 API
apps/worker       可恢复的后台任务 Worker
packages/sdk      人物包 Schema、适配器与公共类型
packages/characters  本地预览人物目录
infra/migrations  PostgreSQL 数据结构
docs              产品、设计、架构与许可文档
```

平台面向 PostgreSQL + pgvector、Redis 和 S3 兼容对象存储设计。本地默认可以使用内存演示仓库启动，不要求先购买数据库服务。

## 本地启动

要求 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

默认访问 `http://localhost:3000`。如果端口被占用，可以运行：

```bash
npm run dev -- -p 3010
```

### 接入兼容模型 API

将根目录的 `.env.example` 复制为 `apps/web/.env.local`，至少填写：

```dotenv
MODEL_API_URL=https://your-provider.example/v1
MODEL_API_KEY=replace-with-your-key
MODEL_NAME=your-model-name
```

不要提交 `.env`、`.env.local` 或任何 API Key。未同时配置 URL、Key 和模型名时，对话会降级为规则模式，并在界面中明确标注。

### 启动完整本地依赖

```bash
docker compose up -d
```

这会启动 PostgreSQL/pgvector、Redis 和 MinIO。数据库迁移位于 `infra/migrations`。

## 验证

```bash
npm run typecheck
npm test
npm run build
```

提交 Pull Request 前应至少运行以上三项。历史内容变更还必须提供来源、定位、许可和人工审核说明。

## 人物包

ZIP 根目录必须包含 `character.json`，可以包含 `graph.jsonld`、获准再发布的媒体和人物包说明。人物包：

- 只能包含声明式数据，不能携带脚本或可执行文件；
- 发布版本不可覆盖，修改必须创建新的语义版本；
- Fork 必须保留 `forkedFrom`、原作者和来源链；
- 每项正式 Claim 必须能追溯到具体来源位置；
- 没有再发布许可的完整网页、视频或其他素材不得进入导出包。

详细规则见 [人物包与素材许可](docs/licensing.md) 和 [技术设计](docs/04-tech-design-v6.md)。

## 开源与许可

平台代码及未另行声明的第一方文档采用 [Apache License 2.0](LICENSE)。选择 Apache-2.0 是因为它保持宽松使用与商业分发，同时提供明确的贡献者专利授权。

人物包、史料摘录、图片、录音、视频和生成媒体不自动继承平台代码许可。每项内容必须保存自己的许可、来源和允许用途。详见 [docs/licensing.md](docs/licensing.md) 与 [NOTICE](NOTICE)。

## 参与项目

- 开始贡献：[CONTRIBUTING.md](CONTRIBUTING.md)
- 社区行为规范：[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- 安全问题：[SECURITY.md](SECURITY.md)
- 项目治理与人物发布权责：[GOVERNANCE.md](GOVERNANCE.md)
- 使用与求助：[SUPPORT.md](SUPPORT.md)

请不要在公开 Issue 中提交 API Key、未成年人的个人信息、未授权肖像、受版权保护的完整材料或尚未公开的安全漏洞。
