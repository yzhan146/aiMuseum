import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, JsonLd } from "@/components/public/JsonLd";
import { absoluteSiteUrl, publicHall, publicHallIds } from "@/lib/public-museum";

export const dynamicParams = false;

export function generateStaticParams() {
  return publicHallIds().map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = publicHall(id);
  if (!data) return {};
  const { pack } = data;
  const description = `${pack.hall.title}：${pack.hall.question}${pack.hall.guideText}`;
  const image = pack.assets.find((asset) => asset.id === pack.hall.theme.lightAssetId) ?? pack.assets[0];
  return {
    title: pack.hall.title,
    description,
    alternates: { canonical: `/halls/${id}` },
    openGraph: { title: pack.hall.title, description, url: `/halls/${id}`, images: image ? [{ url: image.path, alt: image.alt }] : undefined },
  };
}

const factLabels = { established: "史料明确", interpretation: "研究判断", disputed: "仍有不确定" } as const;

export default async function HallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = publicHall(id);
  if (!data) notFound();
  const { pack, period, characters } = data;
  const entranceImage = pack.assets.find((asset) => asset.id === pack.hall.theme.lightAssetId) ?? pack.assets[0];

  return <main className="public-page">
    <JsonLd data={{
      "@context": "https://schema.org", "@type": "LearningResource", name: pack.hall.title,
      description: pack.hall.guideText, educationalUse: "museum learning", inLanguage: "zh-CN",
      url: absoluteSiteUrl(`/halls/${id}`),
      hasPart: pack.objects.map((object) => ({ "@type": "VisualArtwork", name: object.name, creator: object.creatorLabel, dateCreated: object.dateLabel, description: object.description })),
    }} />
    <Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "历史时期", href: "/periods" }, { label: period.title, href: `/periods/${period.id}` }, { label: pack.hall.title }]} />

    <header className="public-page-hero">
      <p className="public-eyebrow">{pack.hall.entrance.kicker}</p>
      <h1>{pack.hall.title}</h1>
      <p className="public-lead">{pack.hall.question}</p>
      {pack.hall.experience && <p className="public-route-time">{pack.hall.experience.recommendedMinutes} 分钟推荐路线 · {pack.hall.experience.quickMinutes} 分钟自由速览</p>}
      {pack.hall.contentWarning && <p className="notice"><b>{pack.hall.contentWarning.label}：</b>{pack.hall.contentWarning.description}</p>}
    </header>

    <div className="public-content-grid">
      <article className="public-article">
        {entranceImage && <figure className="public-hall-hero-image"><img className="public-hall-image" src={entranceImage.path} alt={entranceImage.alt} /><figcaption>{entranceImage.representation === "decorative_illustration" ? "艺术化虚构展馆，不是真实建筑复原。" : entranceImage.licenseCode}</figcaption></figure>}

        <section><p className="public-eyebrow">导览</p><h2>{pack.hall.guideTitle}</h2><p>{pack.hall.guideText}</p></section>

        {pack.hall.experience && <section>
          <p className="public-eyebrow">推荐动线</p><h2>沿四幕看懂这座展厅的核心问题</h2>
          <ol className="public-route-list">{pack.hall.stations.map((station) => <li key={station.id}><span>{station.order}</span><div><h3>{station.title}</h3><p>{station.body}</p></div></li>)}</ol>
        </section>}

        <section>
          <p className="public-eyebrow">展品目录 · {pack.objects.length} 件</p><h2>沿着作品，自己寻找答案</h2>
          <div className="public-object-list">{pack.objects.map((object, index) => {
            const image = pack.assets.find((asset) => asset.id === object.assetId);
            const objectSources = pack.sources.filter((source) => object.sourceIds.includes(source.id));
            return <article className="public-object-card" key={object.id}>
              {image && <figure><img src={image.path} alt={image.alt} loading={index < 2 ? "eager" : "lazy"} /><figcaption>{object.licenseNote ?? image.licenseCode}</figcaption></figure>}
              <div>
                <p className="public-eyebrow">{object.factStatus ? factLabels[object.factStatus] : "馆藏展品"} · {object.dateLabel}</p>
                <h3>{object.name}</h3>{object.creatorLabel && <p className="public-object-creator">{object.creatorLabel}</p>}
                <p>{object.description}</p>
                <div className="public-question"><h4>为什么在这里看它？</h4><p>{object.significance}</p></div>
                {object.observationPrompt && <blockquote>{object.observationPrompt}</blockquote>}
                <details><summary>作品来源与图像说明</summary>{objectSources.map((source) => <p key={source.id}>{source.url ? <a href={source.url}>{source.title}</a> : <b>{source.title}</b>}：{source.note}</p>)}</details>
              </div>
            </article>;
          })}</div>
        </section>

        <section>
          <h2>谁与这个问题相连？</h2><p>登录后的沉浸展厅可以选择人物陪同，也可以全程独自参观。人物只改变观察角度，不改变展品、史实或路线。</p>
          <div className="public-index-grid">{characters.map((character, index) => <a className="public-index-card" href={`/people/${character.id}`} key={character.id}><img src={character.portraitVariants.cartoon.assetPath} alt="" /><h3>{character.name}</h3><p>{pack.hall.characterRefs[index]?.relationshipLabel ?? character.summary}</p></a>)}</div>
        </section>

        <section><p className="public-eyebrow">离开展厅前</p><h2>{pack.hall.exit.reflectionQuestion}</h2><p>这个问题没有自动生成的标准答案。它用于把展厅中的人物、证据和选择重新联系起来。</p></section>
        <section><h2>策展来源</h2><div className="public-source-list">{pack.sources.map((source) => <article key={source.id}><b>{source.title}</b><p>{source.note}</p>{source.url && <a href={source.url}>打开来源</a>}</article>)}</div></section>
      </article>

      <aside><div className="public-aside-card"><p className="public-eyebrow">所属时期</p><h2>{period.title}</h2><p>{period.years}<br />{period.place}</p><div className="public-link-list"><a href={`/periods/${period.id}`}>查看完整时期馆</a>{period.halls.filter((hall) => hall.id !== id).map((hall) => <a href={`/halls/${hall.id}`} key={hall.id}>{hall.title}</a>)}</div><div className="public-actions"><a className="public-button primary" href={`/login?next=${encodeURIComponent(`/museum?hall=${id}`)}`}>登录后进入沉浸展厅</a></div></div></aside>
    </div>
  </main>;
}
