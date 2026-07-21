"use client";

import { FormEvent, useMemo, useState } from "react";

const checks = (password: string) => ({
  length: password.length >= 8,
  upper: /[A-Z]/.test(password),
  lower: /[a-z]/.test(password),
  number: /\d/.test(password),
  special: /[^A-Za-z0-9\s]/.test(password),
});

export default function RegisterClient({ next }: { next: string }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const rules = useMemo(() => checks(password), [password]);

  async function request(path: string, body: Record<string, string>) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "操作失败，请稍后再试");
    return data;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "");
    const confirmation = String(values.get("confirmation") ?? "");
    if (password !== confirmation) {
      setError("两次输入的密码不一致");
      setBusy(false);
      return;
    }
    if (!Object.values(rules).every(Boolean)) {
      setError("请完成全部密码要求");
      setBusy(false);
      return;
    }
    try {
      const data = await request("/api/auth/register", {
        displayName: String(values.get("displayName") ?? ""),
        email,
        password,
      });
      setPendingEmail(email);
      setNotice(`${data.message} 验证完成后会自动进入博物馆。`);
    } catch (reason) {
      setPendingEmail(email);
      setError(reason instanceof Error ? reason.message : "注册失败");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError("");
    try {
      const data = await request("/api/auth/resend-verification", { email: pendingEmail });
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
        <label>怎么称呼你<input name="displayName" autoComplete="nickname" maxLength={40} autoFocus required /></label>
        <label>邮箱<input name="email" type="email" autoComplete="email" required /></label>
        <label>密码<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required />
          <span className="password-rules" aria-label="密码要求">
            <span className={rules.length ? "met" : ""}>至少8个字符</span>
            <span className={rules.upper ? "met" : ""}>大写字母</span>
            <span className={rules.lower ? "met" : ""}>小写字母</span>
            <span className={rules.number ? "met" : ""}>数字</span>
            <span className={rules.special ? "met" : ""}>特殊字符</span>
          </span>
        </label>
        <label>再次输入密码<input name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
        <button className="auth-primary" disabled={busy}>{busy ? "正在创建…" : "创建账户"}</button>
      </form>
      {notice && <p className="auth-success" role="status">{notice}</p>}
      {error && <p className="auth-alert" role="alert">{error}</p>}
      {pendingEmail && <button className="auth-secondary" onClick={resend} disabled={busy}>重新发送验证邮件</button>}
      <div className="auth-links"><a href={`/login?next=${encodeURIComponent(next)}`}>已经有账户？返回登录</a></div>
    </>
  );
}
