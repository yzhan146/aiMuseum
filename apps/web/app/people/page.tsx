import type { Metadata } from "next";
import { catalogCharacters, historicalPeriods } from "@ai-museum/characters";
import { Breadcrumbs } from "@/components/public/JsonLd";

export const metadata: Metadata = {
  title: "历史人物馆藏",
  description: "浏览 AI Museum 收录的 36 位历史人物，了解他们的时代、经历、作品、关系和公开来源。",
  alternates: { canonical: "/people" },
  openGraph: { title: "历史人物馆藏", description: "36 位人物，3 个时代，9 座主题展厅。", url: "/people" },
};

export default function PeoplePage() {
  return <main className="public-page"><Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "人物馆藏" }]} /><header className="public-page-hero"><p className="public-eyebrow">36 位历史人物</p><h1>从一个人开始，<br />沿着关系走进历史。</h1><p className="public-lead">人物档案公开展示生平、影响、作品、相关人物、可探索问题与当前人物包来源。人物模型只在登录后的博物馆中使用。</p></header>{historicalPeriods.map((period) => <section className="public-section" key={period.id}><header className="public-section-heading"><div><p className="public-eyebrow">{period.years}</p><h2>{period.title}</h2></div><a href={`/periods/${period.id}`}>进入时期馆 →</a></header><div className="public-index-grid">{catalogCharacters.filter((character) => character.periodId === period.id).map((character) => <a className="public-index-card" href={`/people/${character.id}`} key={character.id}><img src={character.portraitVariants.cartoon.assetPath} alt="" /><span>{character.life}</span><h3>{character.name}</h3><p>{character.summary}</p></a>)}</div></section>)}</main>;
}
