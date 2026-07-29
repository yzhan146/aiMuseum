import type { Metadata } from "next";
import { historicalPeriods } from "@ai-museum/characters";
import { Breadcrumbs } from "@/components/public/JsonLd";

export const metadata: Metadata = {
  title: "历史时期与主题展厅",
  description: "从盛唐与东亚交流、欧洲文艺复兴到现代物理革命，沿着历史问题进入 AI Museum。",
  alternates: { canonical: "/periods" },
  openGraph: { title: "历史时期与主题展厅", description: "三个时期、九座展厅和三十六位人物。", url: "/periods" },
};

export default function PeriodsPage() {
  return <main className="public-page"><Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "历史时期" }]} /><header className="public-page-hero"><p className="public-eyebrow">不是年代目录，而是问题地图</p><h1>每个时代，<br />都有尚未结束的问题。</h1><p className="public-lead">从城市、旅行、证据、战争、艺术赞助与科学责任进入历史，再认识处于其中的人。</p></header><div className="public-period-grid" style={{marginTop: 38}}>{historicalPeriods.map((period) => <a className={`public-period-card ${period.theme}`} href={`/periods/${period.id}`} key={period.id}><span>{period.years} · {period.place}</span><b>{period.mark}</b><h3>{period.title}</h3><p>{period.inquiry}</p><em>{period.halls.length} 个展厅 · {period.characters.length} 位人物</em></a>)}</div></main>;
}
