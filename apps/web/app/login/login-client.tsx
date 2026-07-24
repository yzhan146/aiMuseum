"use client";

import { FormEvent, useState } from "react";

export default function LoginClient({
  next,
  verificationFailed,
  testAccount,
}: {
  next: string;
  verificationFailed: boolean;
  testAccount?: { email: string; password: string; displayName: string };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    verificationFailed ? "验证链接无效或已经过期，请重新注册或发送验证邮件。" : "",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: String(values.get("email") ?? ""),
          password: String(values.get("password") ?? ""),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "登录失败，请稍后再试");
      window.location.assign(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败");
      setBusy(false);
    }
  }

  return (
    <>
      {testAccount && (
        <aside className="auth-local-account" aria-label="本地测试账号">
          <strong>本地测试账号</strong>
          <span>邮箱：<code>{testAccount.email}</code></span>
          <span>密码：<code>{testAccount.password}</code></span>
          <small>仅在本地开发环境启用，表单已自动填入。</small>
        </aside>
      )}
      <form className="auth-form" onSubmit={submit}>
        <label>邮箱<input name="email" type="email" autoComplete="email" defaultValue={testAccount?.email} autoFocus required /></label>
        <label>密码<input name="password" type="password" autoComplete="current-password" defaultValue={testAccount?.password} required /></label>
        <button className="auth-primary" disabled={busy}>{busy ? "正在登录…" : "登录并进入博物馆"}</button>
      </form>
      {error && <p className="auth-alert" role="alert">{error}</p>}
      <div className="auth-links">
        <a href="/forgot-password">忘记密码？</a>
        <a href={`/register?next=${encodeURIComponent(next)}`}>创建新账户</a>
      </div>
    </>
  );
}
