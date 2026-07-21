export function AuthFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <header className="auth-brand-bar">
        <span className="auth-brand-mark" aria-hidden="true">M</span>
        <a href="/login">AI Museum</a>
        <small>安全访问</small>
      </header>
      <div className="auth-layout">
        <section className="auth-story" aria-label="AI Museum 介绍">
          <p className="auth-kicker">一座会记得你的博物馆</p>
          <h1>每次回来，<br />继续上次的历史旅程。</h1>
          <p>你的长期人物对话、历史发现、学习进度和人物收藏会保存在同一个账户里。</p>
          <div className="auth-story-notes">
            <span>人物对话彼此独立</span>
            <span>进度跨设备保存</span>
            <span>密码不会以明文保存</span>
          </div>
        </section>
        <section className="auth-panel">
          <p className="auth-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="auth-description">{description}</p>
          {children}
        </section>
      </div>
      <footer className="auth-footer">AI Museum · 开源历史人物学习平台</footer>
    </main>
  );
}
