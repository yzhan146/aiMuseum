import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, JsonLd } from "@/components/public/JsonLd";
import { absoluteSiteUrl, publicCharacter, publicCharacterIds } from "@/lib/public-museum";

export const dynamicParams = false;

export function generateStaticParams() {
  return publicCharacterIds().map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = publicCharacter(id);
  if (!data) return {};
  const { character, period } = data;
  const description = `${character.name}（${character.life}）：${character.exhibit.overview}了解生平、作品、影响、相关人物与公开来源。`;
  return {
    title: `${character.name}｜人物档案`,
    description,
    alternates: { canonical: `/people/${id}` },
    openGraph: { type: "profile", title: `${character.name}｜人物档案`, description, url: `/people/${id}`, images: character.portraitVariants.realistic.assetPath ? [{ url: character.portraitVariants.realistic.assetPath, alt: character.portraitVariants.realistic.alt }] : undefined },
    other: { "museum:period": period.title },
  };
}

export default async function CharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = publicCharacter(id);
  if (!data) notFound();
  const { character, period, pack } = data;
  const related = character.relationCharacterIds.map(publicCharacter).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const halls = period.halls.filter((hall) => hall.characterIds.includes(character.id));
  const image = character.portraitVariants.realistic.assetPath ? absoluteSiteUrl(character.portraitVariants.realistic.assetPath) : undefined;
  const breadcrumbJson = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "首页", item: absoluteSiteUrl("/") },
      { "@type": "ListItem", position: 2, name: "人物馆藏", item: absoluteSiteUrl("/people") },
      { "@type": "ListItem", position: 3, name: character.name, item: absoluteSiteUrl(`/people/${id}`) },
    ],
  };
  const personJson = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: character.name,
    description: character.exhibit.overview,
    birthDate: character.bornAt,
    deathDate: character.diedAt,
    image,
    url: absoluteSiteUrl(`/people/${id}`),
    subjectOf: { "@type": "Article", headline: `${character.name}人物档案`, inLanguage: "zh-CN", url: absoluteSiteUrl(`/people/${id}`) },
  };

  return <main className="public-page">
    <JsonLd data={[personJson, breadcrumbJson]} />
    <Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "人物馆藏", href: "/people" }, { label: character.name }]} />
    <header className="public-page-hero"><p className="public-eyebrow">{period.title} · {character.curatorRole}</p><h1>{character.name}</h1><p className="public-lead">{character.exhibit.overview}</p><div className="public-stat-row"><span><strong>{character.life}</strong><small>生卒年代</small></span><span><strong>{related.length}</strong><small>馆藏关系</small></span><span><strong>{halls.length}</strong><small>相关展厅</small></span></div></header>
    <div className="public-content-grid">
      <article className="public-article">
        <section><p className="public-eyebrow">一生中的关键转折</p><h2>{character.name}经历了什么？</h2><ol>{character.exhibit.biography.map((event) => <li key={event}>{event}</li>)}</ol></section>
        <section><div className="public-question"><h3>这位人物改变了什么？</h3><p>{character.exhibit.influence}</p></div><div className="public-question"><h3>为什么今天仍在谈论这位人物？</h3><p>{character.exhibit.legacy}</p></div></section>
        {character.exhibit.works.length > 0 && <section><h2>作品、事件与思想</h2><div className="public-tag-list">{character.exhibit.works.map((work) => <span key={work}>{work}</span>)}</div></section>}
        {character.exhibit.discoveries.length > 0 && <section><h2>从这些线索继续探索</h2>{character.exhibit.discoveries.map((discovery) => <div className="public-question" key={discovery.id}><p className="public-eyebrow">{discovery.kind}</p><h3>{discovery.title}</h3><p>{discovery.content}</p></div>)}</section>}
        <section><h2>可以继续问什么？</h2><p>这些问题来自人物馆藏的策展入口。公开页不会调用模型；登录后可以在人物时代与来源边界内继续交流。</p><div className="public-tag-list">{character.exhibit.conversationStarters.map((question) => <span key={question}>{question}</span>)}</div></section>
        <section><h2>与 {character.name} 相连的人</h2><div className="public-link-list">{related.map(({ character: relation }) => <a href={`/people/${relation.id}`} key={relation.id}><b>{relation.name}</b><br /><small>{relation.summary}</small></a>)}</div></section>
        <section><h2>公开来源</h2><p>以下来源来自当前发布的人物包。来源质量与定位粒度不完全相同；AI Museum 会如实展示，而不把通用索引写成已完成的逐条史料审核。</p><div className="public-source-list">{pack.sources.map((source) => <article key={source.id}><b>{source.title}</b>{source.creator && <span> · {source.creator}</span>}<p>{source.kind} · {source.locator ?? "未提供具体定位"} · {source.license.code}</p>{source.url && <a href={source.url} rel="noreferrer">访问来源 ↗</a>}</article>)}</div></section>
        <section><h2>关于 AI 人物演绎</h2><p>{pack.persona.disclaimer}</p><p>当前人物知识边界截止到 {pack.boundaries.knowledgeCutoff}。公开档案是策展内容，不是人物真实发言，也不会在访问时调用模型。</p></section>
      </article>
      <aside><div className="public-aside-card"><img src={character.portraitVariants.realistic.assetPath} alt={character.portraitVariants.realistic.alt} /><p className="public-eyebrow">{character.portraitVariants.realistic.sourceLabel}</p><h2>{character.name}</h2><p>{character.life} · {period.place}</p><div className="public-link-list">{halls.map((hall) => <a href={`/halls/${hall.id}`} key={hall.id}>{hall.title}</a>)}<a href={`/periods/${period.id}`}>返回{period.title}</a></div><div className="public-actions"><a className="public-button primary" href="/login?next=/museum">登录后进入人物馆</a></div></div></aside>
    </div>
  </main>;
}
