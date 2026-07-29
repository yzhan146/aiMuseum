"use client";

import { useState } from "react";

type Account = {
  userId: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
};

export default function AccountClient({ account, metricsAdmin = false }: { account: Account; metricsAdmin?: boolean }) {
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

  async function deleteAccount() {
    const confirmed = window.confirm(
      "删除账户会永久移除人物对话、关系、记忆与学习数据，且无法恢复。确定继续吗？",
    );
    if (!confirmed) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE_MY_ACCOUNT" }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "账户删除失败，请稍后再试");
      }
      window.location.assign("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "账户删除失败");
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
      <section className="account-card" aria-labelledby="account-data-title">
        <p className="account-eyebrow">数据与隐私</p>
        <h2 id="account-data-title">管理你的账户数据</h2>
        <p>
          导出文件包含对话、长期记忆和内部关系记录；公开页面仍不会显示关系门槛或权重。
        </p>
        <div className="account-actions">
          <a className="account-secondary" href="/api/account/export">
            导出账户数据
          </a>
          <button
            className="account-danger"
            onClick={deleteAccount}
            disabled={busy}
          >
            永久删除账户
          </button>
        </div>
      </section>
      {metricsAdmin && (
        <section className="account-card">
          <p className="account-eyebrow">管理员</p>
          <h2>运营指标</h2>
          <p>查看已验证注册账户、实时在线与近期活跃趋势，不读取用户私人内容。</p>
          <div className="account-actions">
            <a className="account-primary" href="/admin/metrics">打开实时指标</a>
          </div>
        </section>
      )}
    </main>
  );
}
