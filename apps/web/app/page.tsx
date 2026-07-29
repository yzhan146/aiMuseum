import { historicalPeriods, catalogCharacters } from "@ai-museum/characters";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicPresence } from "@/components/public/PublicPresence";
import { absoluteSiteUrl } from "@/lib/public-museum";

const featuredIds = ["li-bai", "leonardo-da-vinci", "albert-einstein"];

export default function Home() {
  const featured = featuredIds
    .map((id) => catalogCharacters.find((character) => character.id === id))
    .filter(Boolean);
  return (
    <main className="public-site">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "AI Museum",
            url: absoluteSiteUrl("/"),
            inLanguage: "zh-CN",
            description: "有来源的历史人物学习博物馆",
          },
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "AI Museum",
            url: absoluteSiteUrl("/"),
            description: "通过历史时期、人物关系和可追溯资料组织历史学习。",
          },
        ]}
      />
      <section className="public-hero">
        <div>
          <p className="public-eyebrow">有来源的历史人物学习博物馆</p>
          <h1>不要只问历史人物。<br /><em>先走进他的时代。</em></h1>
          <p className="public-lead">
            从长安、佛罗伦萨到索尔维会议，在人物关系、历史场景与公开来源中理解真实的选择和分歧。
          </p>
          <div className="public-actions">
            <a className="public-button primary" href="/periods">从一个时代开始</a>
            <a className="public-button secondary" href="/people">浏览 36 位人物</a>
          </div>
          <PublicPresence />
        </div>
        <div className="public-hero-card" aria-label="AI Museum 馆藏概览">
          <span>馆藏索引</span>
          <strong>3</strong><small>历史时期</small>
          <strong>9</strong><small>主题展厅</small>
          <strong>36</strong><small>历史人物</small>
        </div>
      </section>

      <section className="public-section">
        <header className="public-section-heading">
          <div><p className="public-eyebrow">从问题进入历史</p><h2>三个时代，三种理解世界的方法</h2></div>
          <a href="/periods">查看全部时期 →</a>
        </header>
        <div className="public-period-grid">
          {historicalPeriods.map((period) => (
            <a className={`public-period-card ${period.theme}`} href={`/periods/${period.id}`} key={period.id}>
              <span>{period.years} · {period.place}</span>
              <b>{period.mark}</b>
              <h3>{period.title}</h3>
              <p>{period.inquiry}</p>
              <em>{period.halls.length} 个展厅 · {period.characters.length} 位人物</em>
            </a>
          ))}
        </div>
      </section>

      <section className="public-section public-featured">
        <header className="public-section-heading">
          <div><p className="public-eyebrow">人物不是孤立的卡片</p><h2>顺着关系，理解一个人的处境</h2></div>
        </header>
        <div className="public-person-grid">
          {featured.map((character) => character && (
            <a className="public-person-card" href={`/people/${character.id}`} key={character.id}>
              <img src={character.portraitVariants.realistic.assetPath} alt={character.portraitVariants.realistic.alt} />
              <div><span>{character.life}</span><h3>{character.name}</h3><p>{character.summary}</p><em>阅读人物档案 →</em></div>
            </a>
          ))}
        </div>
      </section>

      <section className="public-section public-method">
        <div><p className="public-eyebrow">AI 演绎，不是假装真人</p><h2>事实、推断和角色表达应当分得清楚。</h2></div>
        <div className="public-method-grid">
          <article><b>01</b><h3>先看来源</h3><p>公开人物页展示人物包中的来源、定位信息与资料边界。</p></article>
          <article><b>02</b><h3>承认不知道</h3><p>人物知识受生卒年代与资料范围约束，现代信息由博物馆旁白区分。</p></article>
          <article><b>03</b><h3>关系会有分歧</h3><p>相识不是无条件赞同；长期交流保留人物立场和独立判断。</p></article>
        </div>
        <a className="public-button secondary" href="/about">了解方法、记忆与儿童安全</a>
      </section>

      <section className="public-cta">
        <p className="public-eyebrow">准备开始自己的旅程？</p>
        <h2>公开知识始终可以阅读。<br />登录后，才会建立属于你的收藏、对话与人物关系。</h2>
        <div className="public-actions"><a className="public-button primary" href="/register">创建账户</a><a className="public-button secondary" href="/login">已有账户，继续参观</a></div>
      </section>
    </main>
  );
}
