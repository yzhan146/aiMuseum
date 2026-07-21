"use client";

import { FormEvent, useState } from "react";

export default function ForgotPasswordClient() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: String(values.get("email") ?? "") }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "发送失败，请稍后再试");
      setNotice(data.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "发送失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="auth-form" onSubmit={submit}>
        <label>注册邮箱<input name="email" type="email" autoComplete="email" autoFocus required /></label>
        <button className="auth-primary" disabled={busy}>{busy ? "正在发送…" : "发送重置邮件"}</button>
      </form>
      {notice && <p className="auth-success" role="status">{notice}</p>}
      {error && <p className="auth-alert" role="alert">{error}</p>}
      <div className="auth-links"><a href="/login">返回登录</a></div>
    </>
  );
}
