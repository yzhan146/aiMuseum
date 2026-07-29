import "./globals.css";
import "./visitor.css";
import "./public-site.css";
import type { Metadata } from "next";
import { siteOrigin } from "@/lib/public-museum";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: "AI Museum｜有来源的历史人物学习博物馆",
    template: "%s｜AI Museum",
  },
  description: "从历史时期、人物关系与可追溯史料出发，理解历史人物的处境、选择和影响。",
  applicationName: "AI Museum",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "AI Museum",
    title: "AI Museum｜有来源的历史人物学习博物馆",
    description: "从历史时期、人物关系与可追溯史料出发，理解历史人物的处境、选择和影响。",
    url: "/",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <nav className="site-nav" aria-label="主导航">
          <a className="site-brand" href="/">AI MUSEUM</a>
          <span className="site-links">
            <a href="/periods">历史时期</a>
            <a href="/people">人物馆藏</a>
            <a href="/about">如何运作</a>
            <a className="site-enter" href="/museum">进入我的博物馆</a>
          </span>
        </nav>
        {children}
        <footer className="site-footer">
          <div>
            <a className="site-brand" href="/">AI MUSEUM</a>
            <p>把人物放回时代、关系与证据之中。</p>
          </div>
          <div>
            <a href="/about">方法与安全</a>
            <a href="/people">人物馆藏</a>
            <a href="/periods">历史时期</a>
            <a href="/login">登录</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
