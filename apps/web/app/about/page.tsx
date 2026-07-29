import type { Metadata } from "next";
import { Breadcrumbs, JsonLd } from "@/components/public/JsonLd";
import { absoluteSiteUrl } from "@/lib/public-museum";

export const metadata: Metadata = {
  title: "AI Museum 如何运作",
  description: "了解 AI Museum 如何使用历史来源、区分 AI 演绎与人物真实发言，并处理长期记忆、人物关系和儿童安全。",
  alternates: { canonical: "/about" },
  openGraph: { title: "AI Museum 如何运作", description: "来源、人物边界、长期记忆与儿童安全。", url: "/about" },
};

const questions = [
  { q: "AI Museum 是什么？", a: "AI Museum 是一个历史学习产品。它先用时期、展厅、人物关系和公开资料建立语境，再让登录用户与教育性的 AI 历史人物演绎进行长期交流。" },
  { q: "人物说的话都是真实史料吗？", a: "不是。模型生成的角色表达不等于人物真实说过的话。人物页中的事实、来源与策展说明会分开呈现；可靠资料不足时，人物应当承认不知道或由博物馆旁白补充。" },
  { q: "为什么要限制人物的知识范围？", a: "历史人物不应假装经历过身后的事件。每个人物包记录生卒年代、知识边界、允许与受限主题，让现代解释和人物时代视角保持可区分。" },
  { q: "长期关系会让人物无条件迎合用户吗？", a: "不会。关系增长来自持续、有内容的交流，不来自刷问候或赞美。关系变化会影响称呼、共同经历和表达方式，但人物仍保留自己的立场、分歧与安全边界。" },
  { q: "AI Museum 会保存什么？", a: "登录后的收藏、对话、记忆与关系属于账户数据，并遵守暂停、导出、删除和账户删除语义。公开知识页不创建游客档案，也不调用人物模型。" },
  { q: "儿童使用时有什么不同？", a: "轻快视觉模式不会降低事实标准。人物回答应适配年龄、解释术语、避免依赖与越界亲密，不把付费、收藏或关系阶段绑定为获取关键知识的条件。" },
];

export default function AboutPage() {
  return (
    <main className="public-page">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "AboutPage", name: "AI Museum 如何运作", url: absoluteSiteUrl("/about"), inLanguage: "zh-CN", description: metadata.description }} />
      <Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "如何运作" }]} />
      <header className="public-page-hero">
        <p className="public-eyebrow">方法、边界与安全</p>
        <h1>AI 可以演绎人物，<br />但不能改写证据。</h1>
        <p className="public-lead">AI Museum 希望让历史人物变得可接近，同时保留一个清楚边界：模型生成的表达不是人物真实发言，亲近感也不能代替史料与判断。</p>
      </header>
      <div className="public-content-grid">
        <article className="public-article">
          <section><h2>我们的基本方法</h2><div className="public-method-grid">
            <article><b>01</b><h3>把人物放回时代</h3><p>每次探索从一个时期、一座展厅和一个历史问题开始，而不是从空白聊天框开始。</p></article>
            <article><b>02</b><h3>让来源保持可见</h3><p>人物包记录来源、主张、争议状态、知识边界和评测案例。</p></article>
            <article><b>03</b><h3>让关系改变内容</h3><p>长期交流可以积累共同经历，但不会把人物变成永远赞同用户的聊天皮肤。</p></article>
          </div></section>
          <section><h2>经常被问到的问题</h2>{questions.map((item) => <div className="public-question" key={item.q}><h3>{item.q}</h3><p>{item.a}</p></div>)}</section>
          <section><h2>公开知识与登录产品的边界</h2><p>人物生平、时期、展厅、策展问题和公开来源无需登录即可阅读。收藏、模型对话、长期记忆和人物关系需要账户，因为这些能力会产生属于用户的私人状态。</p><p>公开页面不会创建匿名用户、保存浏览进度或调用模型。登录产品中的数据可以按照账户设置进行导出和删除。</p></section>
        </article>
        <aside><div className="public-aside-card"><p className="public-eyebrow">继续核对</p><h2>直接查看馆藏</h2><p>方法说明只有与实际内容一致才有意义。</p><div className="public-link-list"><a href="/people/li-bai">李白人物档案</a><a href="/halls/physics-solvay">索尔维会议展厅</a><a href="/periods/renaissance-science">文艺复兴时期馆</a></div><div className="public-actions"><a className="public-button primary" href="/register">创建账户</a></div></div></aside>
      </div>
    </main>
  );
}
