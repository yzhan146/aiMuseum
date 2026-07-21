# Render、Resend 与自有域名部署

这份配置把网站访问域名与事务邮件域名分开。示例使用 `example.com`，部署时替换为自己的域名。

## 1. 当前无域名阶段

Render Web Service 使用以下配置：

- Build Command：`npm ci && npm run db:migrate && npm run build`
- Start Command：`npm run start -w @ai-museum/web`
- Health Check Path：`/api/health`
- `DATABASE_URL`：连接同区域 Render PostgreSQL 的 Internal Database URL
- `APP_BASE_URL`：当前完整 Render 地址，例如 `https://ai-museum.onrender.com`
- `AUTH_SESSION_SECRET`：至少 32 字符的随机值，生成后不要再更换
- `RESEND_API_KEY`：Resend API Key
- `AUTH_EMAIL_FROM`：`AI Museum <onboarding@resend.dev>`

`onboarding@resend.dev` 只适合测试，而且只能向 Resend 账户自己的邮箱发送。注册测试时必须填写这个邮箱。

## 2. 推荐的域名结构

- 网站：`museum.example.com`
- 事务邮件：`auth.example.com`
- 发件人：`AI Museum <account@auth.example.com>`

邮件使用独立子域可以隔离发信信誉，也不会与主域现有邮箱配置相互覆盖。

## 3. 网站 DNS

1. 在 Render Web Service 打开 **Settings → Custom Domains → Add Custom Domain**。
2. 输入 `museum.example.com`。
3. Render 会显示当前服务需要的 DNS 记录。到域名 DNS 服务商新增该记录；子域通常使用 CNAME，但必须以 Render 页面当时给出的主机名和值为准。
4. 删除同名的旧 A、AAAA 或 CNAME 冲突记录。
5. 回到 Render 点击验证并等待 TLS 证书签发。
6. HTTPS 可访问后，把 `APP_BASE_URL` 改为 `https://museum.example.com`，保存并重新部署。

不要在证书生效前修改 `APP_BASE_URL`，否则验证邮箱和重置密码邮件会指向尚不可访问的地址。

## 4. Resend 邮件 DNS

1. 在 Resend 打开 **Domains → Add Domain**，添加 `auth.example.com`。
2. Resend 会列出 DKIM 与 SPF 所需记录。在域名 DNS 服务商逐条复制 **Type、Name、Value、Priority**；不要手写或猜测记录值。
3. 同一主机名只能保留一条 SPF TXT。如果它已经存在，需要把机制合并进同一条记录，而不是再创建第二条 `v=spf1`。
4. 可新增 DMARC 监控记录：
   - Type：`TXT`
   - Name：`_dmarc.auth`
   - Value：`v=DMARC1; p=none; rua=mailto:dmarc@example.com; adkim=s; aspf=s; pct=100`
5. `rua` 邮箱必须真实存在或能接收聚合报告；如果暂时没有这个邮箱，可以先去掉 `rua` 部分。
6. 等待 DNS 传播后，在 Resend 点击 Verify。所有必需记录通过后再更换生产发件人。
7. Render 环境变量改为 `AUTH_EMAIL_FROM=AI Museum <account@auth.example.com>`，然后重新部署。

先以 `p=none` 观察 DMARC 报告。确认所有合法邮件都通过 SPF/DKIM 对齐后，再考虑改为 `quarantine` 或 `reject`。

## 5. 切换检查

- `https://museum.example.com/account` 可以打开。
- 注册邮件的链接以 `https://museum.example.com` 开头。
- 验证链接只能使用一次，过期后可以重新发送。
- 忘记密码邮件可以到达；重置后旧会话失效。
- Render 重新部署后，对话、人物收藏和账户仍存在。
- Resend Logs 中邮件显示 Delivered，邮件头中的 SPF 与 DKIM 均为 PASS。

## 6. 机密信息

以下内容只放进 Render Environment，不能提交到 Git：

- `DATABASE_URL`
- `AUTH_SESSION_SECRET`
- `RESEND_API_KEY`
- `MODEL_API_KEY`

一旦密钥曾出现在截图、Git 历史或公开日志中，应立即在对应服务后台撤销并重新生成。
