import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, JsonLd } from "@/components/public/JsonLd";
import { absoluteSiteUrl, publicPeriod, publicPeriodIds } from "@/lib/public-museum";

export const dynamicParams = false;
export function generateStaticParams() { return publicPeriodIds().map((id) => ({ id })); }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params; const period = publicPeriod(id); if (!period) return {};
  const description = `${period.title}（${period.years}）：${period.inquiry}浏览主题展厅与相关历史人物。`;
  return { title: period.title, description, alternates: { canonical: `/periods/${id}` }, openGraph: { title: period.title, description, url: `/periods/${id}` } };
}
export default async function PeriodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const period = publicPeriod(id); if (!period) notFound();
  return <main className="public-page"><JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: period.title, description: period.inquiry, url: absoluteSiteUrl(`/periods/${id}`), inLanguage: "zh-CN" }} /><Breadcrumbs items={[{label:"首页",href:"/"},{label:"历史时期",href:"/periods"},{label:period.title}]} /><header className="public-page-hero"><p className="public-eyebrow">{period.years} · {period.place}</p><h1>{period.title}</h1><p className="public-lead">{period.inquiry}</p><div className="public-stat-row"><span><strong>{period.halls.length}</strong><small>主题展厅</small></span><span><strong>{period.characters.length}</strong><small>历史人物</small></span></div></header><section className="public-section"><header className="public-section-heading"><div><p className="public-eyebrow">从真实问题开始</p><h2>主题展厅</h2></div></header><div className="public-index-grid">{period.halls.map((hall,index)=><a className="public-index-card" href={`/halls/${hall.id}`} key={hall.id}><span>展厅 {index+1}</span><h2>{hall.title}</h2><p>{hall.question}</p></a>)}</div></section><section className="public-section"><header className="public-section-heading"><div><p className="public-eyebrow">完整人物名册</p><h2>{period.characters.length} 位人物</h2></div></header><div className="public-index-grid">{period.characters.map(character=><a className="public-index-card" href={`/people/${character.id}`} key={character.id}><img src={character.portraitVariants.cartoon.assetPath} alt=""/><span>{character.life}</span><h3>{character.name}</h3><p>{character.summary}</p></a>)}</div></section></main>;
}
