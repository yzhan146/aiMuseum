function baseUrl() {
  const value = process.env.APP_BASE_URL?.trim().replace(/\/$/, "");
  if (!value) throw new Error("APP_BASE_URL is not configured");
  return value;
}

function sender() {
  return (
    process.env.AUTH_EMAIL_FROM?.trim() ||
    "AI Museum <onboarding@resend.dev>"
  );
}

async function send(
  to: string,
  subject: string,
  html: string,
  idempotencyKey: string,
) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({ from: sender(), to: [to], subject, html }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend returned ${response.status}: ${detail.slice(0, 200)}`);
  }
}

function template(title: string, body: string, href: string, action: string) {
  return `<!doctype html><html lang="zh-CN"><body style="font-family:system-ui,sans-serif;color:#18304b;line-height:1.6"><div style="max-width:560px;margin:auto;padding:28px"><h1 style="font-size:24px">${title}</h1><p>${body}</p><p><a href="${href}" style="display:inline-block;background:#c64031;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">${action}</a></p><p style="color:#687786;font-size:13px">如果不是你发起的操作，可以忽略这封邮件。请不要转发此链接。</p></div></body></html>`;
}

export async function sendVerificationEmail(email: string, token: string) {
  const href = `${baseUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  return send(
    email,
    "验证你的 AI Museum 邮箱",
    template(
      "欢迎来到 AI Museum",
      "点击下面的按钮完成邮箱验证，并保存你的对话、人物收藏与学习进度。",
      href,
      "验证邮箱",
    ),
    `verify/${token.slice(0, 24)}`,
  );
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const href = `${baseUrl()}/account/reset?token=${encodeURIComponent(token)}`;
  return send(
    email,
    "重置你的 AI Museum 密码",
    template(
      "重置密码",
      "这个链接将在 30 分钟后失效，并且只能使用一次。",
      href,
      "设置新密码",
    ),
    `reset/${token.slice(0, 24)}`,
  );
}
