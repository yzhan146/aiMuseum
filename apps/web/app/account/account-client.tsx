"use client";

import { FormEvent, useEffect, useState } from "react";

type Account = {
  userId: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
};
type View = "login" | "register" | "forgot";

async function post(path: string, body: Record<string, string>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "操作失败，请稍后再试");
  return data;
}

export default function AccountClient() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [view, setView] = useState<View>("login");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") === "1") {
      setNotice("邮箱验证完成，你的参观进度现在会保存在账户中。");
    } else if (params.get("verification") === "failed") {
      setError("验证链接无效或已过期，请重新发送验证邮件。");
    }
    fetch("/api/account")
      .then(async (response) =>
        response.ok ? ((await response.json()).account as Account) : null,
      )
      .then(setAccount)
      .finally(() => setLoadingAccount(false));
  }, []);

  function begin() {
    setBusy(true);
    setNotice("");
    setError("");
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    begin();
    const values = new FormData(event.currentTarget);
    try {
      await post("/api/auth/login", {
        email: String(values.get("email") ?? ""),
        password: String(values.get("password") ?? ""),
      });
      window.location.assign("/museum");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败");
      setBusy(false);
    }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    begin();
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "");
    try {
      const result = await post("/api/auth/register", {
        displayName: String(values.get("displayName") ?? ""),
        email,
        password: String(values.get("password") ?? ""),
      });
      setPendingEmail(email);
      setNotice(result.message);
    } catch (reason) {
      setPendingEmail(email);
      setError(reason instanceof Error ? reason.message : "注册失败");
    } finally {
      setBusy(false);
    }
  }

  async function forgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    begin();
    const values = new FormData(event.currentTarget);
    try {
      const result = await post("/api/auth/forgot-password", {
        email: String(values.get("email") ?? ""),
      });
      setNotice(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "发送失败");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!pendingEmail) return;
    begin();
    try {
      const result = await post("/api/auth/resend-verification", {
        email: pendingEmail,
      });
      setNotice(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "发送失败");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    begin();
    try {
      await post("/api/auth/logout", {});
      setAccount(null);
      setNotice("你已经安全退出。未登录时仍可继续体验，但新进度只保存在当前浏览器中。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "退出失败");
    } finally {
      setBusy(false);
    }
  }

  if (loadingAccount) {
    return <main className="account-shell"><p>正在确认账户状态…</p></main>;
  }

  if (account) {
    return (
      <main className="account-shell">
        <section className="account-card account-profile">
          <div className="account-mark" aria-hidden="true">
            {account.displayName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="account-eyebrow">参观账户</p>
            <h1>{account.displayName}</h1>
            <p>{account.email}</p>
          </div>
        </section>
        <section className="account-card">
          <h2>你的进度已安全保存</h2>
          <p>人物对话、已获得人物、学习线索和记忆会跟随这个账户。</p>
          <div className="account-actions">
            <a className="account-primary" href="/museum">继续参观</a>
            <button className="account-secondary" onClick={logout} disabled={busy}>退出账户</button>
          </div>
          {notice && <p className="account-notice" role="status">{notice}</p>}
          {error && <p className="account-error" role="alert">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="account-shell">
      <header className="account-intro">
        <p className="account-eyebrow">保存你的博物馆旅程</p>
        <h1>{view === "register" ? "创建账户" : view === "forgot" ? "找回密码" : "欢迎回来"}</h1>
        <p>登录后，不同设备也能继续同一段人物对话与学习进度。</p>
      </header>

      <section className="account-card">
        {view !== "forgot" && (
          <div className="account-tabs" aria-label="账户操作">
            <button className={view === "login" ? "active" : ""} onClick={() => setView("login")}>登录</button>
            <button className={view === "register" ? "active" : ""} onClick={() => setView("register")}>注册</button>
          </div>
        )}

        {view === "login" && (
          <form onSubmit={login} className="account-form">
            <label>邮箱<input name="email" type="email" autoComplete="email" required /></label>
            <label>密码<input name="password" type="password" autoComplete="current-password" required /></label>
            <button className="account-primary" disabled={busy}>{busy ? "登录中…" : "登录并继续"}</button>
            <button type="button" className="account-text" onClick={() => setView("forgot")}>忘记密码？</button>
          </form>
        )}

        {view === "register" && (
          <form onSubmit={register} className="account-form">
            <label>怎么称呼你<input name="displayName" autoComplete="nickname" maxLength={40} required /></label>
            <label>邮箱<input name="email" type="email" autoComplete="email" required /></label>
            <label>密码<input name="password" type="password" autoComplete="new-password" minLength={15} maxLength={128} required /><small>使用至少 15 个字符；可以是一句容易记住的话。</small></label>
            <button className="account-primary" disabled={busy}>{busy ? "创建中…" : "创建账户"}</button>
          </form>
        )}

        {view === "forgot" && (
          <form onSubmit={forgot} className="account-form">
            <label>注册邮箱<input name="email" type="email" autoComplete="email" required /></label>
            <button className="account-primary" disabled={busy}>{busy ? "发送中…" : "发送重置邮件"}</button>
            <button type="button" className="account-text" onClick={() => setView("login")}>返回登录</button>
          </form>
        )}

        {notice && <p className="account-notice" role="status">{notice}</p>}
        {error && <p className="account-error" role="alert">{error}</p>}
        {pendingEmail && <button className="account-secondary account-resend" onClick={resend} disabled={busy}>重新发送验证邮件</button>}
      </section>

      <p className="account-guest"><a href="/museum">暂不登录，继续参观</a></p>
    </main>
  );
}
