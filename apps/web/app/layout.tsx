import "./globals.css";
import "./visitor.css";
export const metadata = { title: "AI Museum", description: "可追溯、可扩展的历史人物平台" };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="zh-CN"><body><nav><a href="/">AI MUSEUM</a><span><a href="/museum">人物馆</a><a href="/learning">学习地图</a><a href="/memories">记忆中心</a><a href="/agents">Agent 任务</a><a href="/studio">创作台</a></span></nav>{children}</body></html>; }
