"use client";

import { FormEvent, useState } from "react";
import { AuthFrame } from "../../auth-frame";

const isStrongPassword = (password: string) =>
  password.length >= 8 &&
  password.length <= 128 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9\s]/.test(password);

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
    if (!isStrongPassword(password)) {
      setError("密码需要包含大写字母、小写字母、数字和特殊字符");
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
    <AuthFrame eyebrow="账户安全" title="设置新密码" description="完成后，其他设备上的旧登录会自动退出。">
        {!token ? (
          <><p className="auth-alert">链接缺少重置凭证，请重新申请。</p><a className="auth-secondary" href="/forgot-password">重新申请</a></>
        ) : done ? (
          <><p className="auth-success">密码已经更新，现在可以用新密码登录。</p><a className="auth-primary" href="/login">前往登录</a></>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <label>新密码<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /><small>至少8个字符，并包含大小写字母、数字和特殊字符。</small></label>
            <label>再次输入<input name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
            <button className="auth-primary" disabled={busy}>{busy ? "保存中…" : "保存新密码"}</button>
            {error && <p className="auth-alert" role="alert">{error}</p>}
          </form>
        )}
    </AuthFrame>
  );
}
