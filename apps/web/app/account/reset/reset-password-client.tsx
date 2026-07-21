"use client";

import { FormEvent, useState } from "react";

export default function ResetPasswordClient({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = new FormData(event.currentTarget);
    const password = String(values.get("password") ?? "");
    const confirmation = String(values.get("confirmation") ?? "");
    if (password !== confirmation) {
      setError("两次输入的密码不一致");
      setBusy(false);
      return;
    }
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || "无法重置密码，请重新申请链接");
      setBusy(false);
      return;
    }
    setDone(true);
    setBusy(false);
  }

  return (
    <main className="account-shell">
      <header className="account-intro">
        <p className="account-eyebrow">账户安全</p>
        <h1>设置新密码</h1>
        <p>完成后，其他设备上的旧登录会自动退出。</p>
      </header>
      <section className="account-card">
        {!token ? (
          <><p className="account-error">链接缺少重置凭证，请重新申请。</p><a className="account-primary" href="/account">返回账户页</a></>
        ) : done ? (
          <><h2>密码已经更新</h2><p>现在可以用新密码登录。</p><a className="account-primary" href="/account">前往登录</a></>
        ) : (
          <form className="account-form" onSubmit={submit}>
            <label>新密码<input name="password" type="password" autoComplete="new-password" minLength={15} maxLength={128} required /><small>使用至少 15 个字符。</small></label>
            <label>再次输入<input name="confirmation" type="password" autoComplete="new-password" minLength={15} maxLength={128} required /></label>
            <button className="account-primary" disabled={busy}>{busy ? "保存中…" : "保存新密码"}</button>
            {error && <p className="account-error" role="alert">{error}</p>}
          </form>
        )}
      </section>
    </main>
  );
}
