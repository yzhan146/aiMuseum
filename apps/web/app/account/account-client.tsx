"use client";

import { useState } from "react";

type Account = {
  userId: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
};

export default function AccountClient({ account }: { account: Account }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("退出失败，请稍后再试");
      window.location.assign("/login");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "退出失败");
      setBusy(false);
    }
  }

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
        <h2>你的博物馆旅程</h2>
        <p>人物对话、人物收藏、学习线索和长期记忆会跟随这个账户。</p>
        <div className="account-actions">
          <a className="account-primary" href="/museum">返回博物馆</a>
          <button className="account-secondary" onClick={logout} disabled={busy}>
            {busy ? "正在退出…" : "安全退出"}
          </button>
        </div>
        {error && <p className="account-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
