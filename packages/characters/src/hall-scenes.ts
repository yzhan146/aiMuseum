import { exhibitPackSchema, type ExhibitPack } from "@ai-museum/sdk";

type HallSeed = {
  id: string;
  periodId: string;
  title: string;
  question: string;
  guideTitle: string;
  guideText: string;
  years: string;
  place: string;
  objectName: string;
  objectKind: "document" | "artwork" | "instrument" | "map" | "reconstruction";
  objectDescription: string;
  significance: string;
  characterIds: string[];
  relationshipLabels: string[];
  reflectionQuestion: string;
  palette: [string, string, string, string, string, string];
  size: [number, number];
  warning?: string;
};

const seeds: HallSeed[] = [
  {
    id: "tang-changan", periodId: "tang-east-asia", title: "长安：诗人与世界城市", question: "一座都城怎样连接诗歌、宫廷与远方来客？", guideTitle: "在世界城市里，诗歌也是相遇的方式", guideText: "从长安的街市、宫廷和旅人出发，看看诗人怎样认识远方，也怎样把时代写进作品。", years: "618–907", place: "长安与东亚交通", objectName: "长安诗笺与行旅图", objectKind: "document", objectDescription: "一页展开的诗笺与城市、道路意象并置，提示诗歌如何随旅行、交往与抄写传播。", significance: "它把抽象的文化交流落到写作、行路和人与人相遇的具体过程。", characterIds: ["li-bai", "du-fu", "wang-wei", "tang-xuanzong", "abe-no-nakamaro"], relationshipLabels: ["诗歌与漫游", "乱世中的记录", "山水与长安", "宫廷与城市", "东亚求学网络"], reflectionQuestion: "一座城市为什么会让陌生人成为朋友？", palette: ["#263f72", "#dbeaf2", "#fffaf0", "#102f50", "#d64b38", "#f2c354"], size: [971, 1619],
  },
  {
    id: "tang-buddhism", periodId: "tang-east-asia", title: "佛法东行与丝路旅行", question: "旅行者怎样让知识跨越语言与海洋？", guideTitle: "一段旅程，怎样变成跨越国家的知识？", guideText: "跟随玄奘、鉴真与阿倍仲麻吕，看翻译、航海和求学如何把不同地区的人连接起来。", years: "7–8世纪", place: "丝路与东亚海路", objectName: "译经稿与旅行路线", objectKind: "map", objectDescription: "经卷、路线与航行工具的艺术重建，帮助理解翻译并不只是换词，也包括迁徙、学习和协作。", significance: "知识跨越语言时，需要人、路线、机构和长期校订共同支持。", characterIds: ["xuanzang", "jianzhen", "abe-no-nakamaro"], relationshipLabels: ["西行与译经", "东渡与传戒", "遣唐使与求学"], reflectionQuestion: "翻译一种知识时，什么最容易被改变？", palette: ["#1d6170", "#d9eee8", "#fffaf0", "#143b4a", "#d96745", "#e9b957"], size: [972, 1619],
  },
  {
    id: "tang-rebellion", periodId: "tang-east-asia", title: "安史之乱：盛世为何转折", question: "繁荣的帝国为什么会突然陷入长期战争？", guideTitle: "从盛世走进转折，看看每个人的选择", guideText: "战争不只改变皇帝与将领，也改变诗人、官员和普通人的生活。这个展厅帮助你理解转折如何发生。", years: "755–763", place: "唐帝国多地", objectName: "战乱时期文书", objectKind: "document", objectDescription: "一份改变普通人生活的文书艺术重建；画面不展示武器与战斗，而从迁徙、道路和记录理解战争。", significance: "文书让我们看到宏大转折如何进入征调、迁徙、家庭和日常选择。", characterIds: ["tang-xuanzong", "an-lushan", "guo-ziyi", "yan-zhenqing", "du-fu", "yang-guifei"], relationshipLabels: ["帝国的决策", "叛乱的发动", "秩序的重建", "官员与书写", "诗中的普通人", "历史与文学形象"], reflectionQuestion: "一个时代的转折，最先被谁感受到？", palette: ["#633d3b", "#eadbd1", "#fffaf0", "#39282a", "#d64a38", "#e3a759"], size: [972, 1619], warning: "本展厅涉及战争、流亡与人物死亡，以非暴力方式呈现。",
  },
  {
    id: "renaissance-florence", periodId: "renaissance-science", title: "佛罗伦萨：艺术为何需要赞助人", question: "一件杰作背后有哪些权力、金钱和学习网络？", guideTitle: "杰作不只来自天才，也来自一座城市", guideText: "艺术家、工匠、商人和统治者共同塑造了佛罗伦萨。顺着他们的关系，看一件作品怎样真正诞生。", years: "15世纪", place: "佛罗伦萨", objectName: "艺术委托契约", objectKind: "document", objectDescription: "契约、颜料与工作坊账册的策展性组合，说明作品的尺寸、材料、期限和付款都可能被协商。", significance: "艺术史不只有天才，还包含劳动、技术、市场与权力关系。", characterIds: ["leonardo-da-vinci", "michelangelo", "lorenzo-medici", "machiavelli"], relationshipLabels: ["观察与工作坊", "雕塑与委托", "赞助与城市权力", "共和国政治"], reflectionQuestion: "出钱的人应该决定作品表达什么吗？", palette: ["#5c5738", "#e7e0c7", "#fffaf0", "#303329", "#c95e3f", "#d8ad52"], size: [971, 1619],
  },
  {
    id: "renaissance-rome", periodId: "renaissance-science", title: "罗马工作坊：大师如何竞争", question: "竞争会怎样改变艺术家的作品与地位？", guideTitle: "同一座城市里，大师既合作也竞争", guideText: "从委托、工作坊和名声出发，理解米开朗琪罗、拉斐尔等人如何在比较与挑战中形成自己的风格。", years: "16世纪初", place: "罗马", objectName: "工作坊草图墙", objectKind: "artwork", objectDescription: "草图、比例标记与脚手架痕迹构成的艺术重建，强调大型作品由多人协作完成。", significance: "竞争既可能推动创新，也会掩盖助手、学徒和女性艺术家的贡献。", characterIds: ["michelangelo", "raphael", "sofonisba-anguissola"], relationshipLabels: ["雕塑与壁画", "工作坊与构图", "女性艺术家的道路"], reflectionQuestion: "竞争什么时候能帮助创造，什么时候会伤害合作？", palette: ["#594436", "#eadccf", "#fffaf3", "#382820", "#bd5138", "#d8b45f"], size: [971, 1619],
  },
  {
    id: "renaissance-observation", periodId: "renaissance-science", title: "从日心说到望远镜", question: "新证据如何挑战人们熟悉的宇宙？", guideTitle: "当观察、印刷与计算带来新的证据", guideText: "旧观点不会因为一句反对就消失。这个展厅展示新工具、新数据和公开讨论怎样逐步改变人们理解世界的方式。", years: "1543–1632", place: "欧洲知识网络", objectName: "望远镜与星图", objectKind: "instrument", objectDescription: "一台早期望远镜、星图与印刷书页的艺术重建，指向观察、计算和传播三种证据链。", significance: "新工具并不自动给出答案；观察结果还需要记录、比较、解释和公开检验。", characterIds: ["copernicus", "galileo", "johannes-kepler", "andreas-vesalius", "johannes-gutenberg"], relationshipLabels: ["日心模型", "望远镜观察", "行星运动计算", "解剖与直接观察", "印刷传播"], reflectionQuestion: "看到新证据后，人为什么仍可能不改变看法？", palette: ["#253a64", "#d6e0ee", "#fffaf0", "#172943", "#d45b42", "#e3b64c"], size: [971, 1619],
  },
  {
    id: "physics-solvay", periodId: "physics-revolution", title: "索尔维会议：自然是概率的吗", question: "科学家为什么会对同一组实验产生不同解释？", guideTitle: "同一组实验，为什么会带来不同答案？", guideText: "走进一场影响深远的科学讨论，看看爱因斯坦、玻尔等人如何用问题、思想实验和证据彼此挑战。", years: "1927", place: "布鲁塞尔", objectName: "会议座位表与问题卡", objectKind: "document", objectDescription: "会议桌、座位表与讨论卡片的艺术重建，用来呈现观点如何在共同体中被质疑和修正。", significance: "科学共识不是所有人立刻同意，而是在证据、反例和持续讨论中形成。", characterIds: ["albert-einstein", "niels-bohr", "max-planck", "marie-curie", "werner-heisenberg", "erwin-schrodinger"], relationshipLabels: ["思想实验与质疑", "互补性解释", "量子理论奠基", "实验与放射性", "不确定性关系", "波动方程"], reflectionQuestion: "意见不同的科学家，怎样仍然一起推进知识？", palette: ["#27385f", "#d9e1ed", "#fffaf2", "#18263f", "#bd4939", "#e0ac4c"], size: [971, 1619],
  },
  {
    id: "physics-atom", periodId: "physics-revolution", title: "原子内部：理论与实验", question: "一个看不见的原子结构怎样被实验逐步发现？", guideTitle: "从实验留下的痕迹，拼出看不见的原子", guideText: "理论提出可能的图景，实验负责检验。顺着散射、放射性与衰变实验，看看原子结构如何一步步清晰。", years: "1895–1957", place: "欧美实验室网络", objectName: "金箔散射装置", objectKind: "instrument", objectDescription: "探测屏、金箔和粒子路线的结构性艺术重建，展示科学家如何从少数异常偏转推断原子内部。", significance: "看不见的结构可以通过可重复的痕迹被推断，但模型必须继续接受新实验检验。", characterIds: ["ernest-rutherford", "niels-bohr", "marie-curie", "lise-meitner", "chien-shiung-wu"], relationshipLabels: ["散射实验", "原子模型", "放射性研究", "核裂变解释", "宇称实验"], reflectionQuestion: "我们看不见一个东西时，什么证据足以相信它存在？", palette: ["#214a54", "#d9ebea", "#fffaf2", "#17343b", "#c4503a", "#dfb34f"], size: [971, 1619],
  },
  {
    id: "physics-responsibility", periodId: "physics-revolution", title: "流亡、战争与科学责任", question: "当科学进入战争，研究者应当承担什么责任？", guideTitle: "知识越强大，选择就越重要", guideText: "从流亡、战争与原子时代的真实经历出发，看看科学家如何面对国家、生命、权力与个人责任。", years: "1933–1954", place: "欧洲与北美", objectName: "流亡科学家的信件", objectKind: "document", objectDescription: "信件、护照印章与研究笔记的艺术重建，从个人迁徙进入战争和科学责任，而不展示暴力场面。", significance: "科学决定由人、制度和政治共同做出；个人责任与集体责任需要同时讨论。", characterIds: ["albert-einstein", "niels-bohr", "lise-meitner", "robert-oppenheimer"], relationshipLabels: ["流亡与公共责任", "科学共同体援助", "拒绝参与武器计划", "组织与战后反思"], reflectionQuestion: "如果知识可能被用来伤害人，研究者应该在哪里停下来？", palette: ["#493c45", "#e5dce0", "#fffaf2", "#302731", "#c24a3a", "#ddb35b"], size: [1122, 1402], warning: "本展厅涉及战争、迫害、核武器与流亡，不展示暴力画面。",
  },
];

function build(seed: HallSeed, index: number): ExhibitPack {
  const objectId = `${seed.id}-anchor`;
  const assetId = `${seed.id}-scene`;
  const [bgDeep, bgSoft, surface, ink, accent, highlight] = seed.palette;
  const sourceId = `${seed.id}-curatorial-source`;
  const next = seeds[index + 1]?.id;
  return exhibitPackSchema.parse({
    manifest: { schemaVersion: "1.0", id: `exhibit-${seed.id}`, version: "1.0.0", status: "published", author: { id: "ai-museum", name: "AI Museum Contributors" }, licenseCode: "Apache-2.0", publishedAt: "2026-07-22T00:00:00.000Z" },
    hall: {
      id: seed.id, periodId: seed.periodId, sceneVersion: "1.0.0", locale: "zh-CN", title: seed.title, question: seed.question, guideTitle: seed.guideTitle, guideText: seed.guideText,
      ...(seed.warning ? { contentWarning: { label: "参观提示", description: seed.warning, severity: "sensitive" } } : {}),
      theme: { themeKey: seed.id, tokens: { bgDeep, bgSoft, surface, ink, accent, highlight }, lightAssetId: assetId, archiveAssetId: assetId },
      entrance: { kicker: `${seed.years} · ${seed.place}`, primaryActionLabel: "开始参观 · 看第一件物件", anchorObjectId: objectId },
      stations: [
        { id: "orientation", order: 1, type: "orientation", title: "你在哪里", body: seed.guideText, objectIds: [], characterIds: [] },
        { id: "object", order: 2, type: "object", title: "它见证了什么", body: seed.objectDescription, objectIds: [objectId], characterIds: [] },
        { id: "characters", order: 3, type: "character_relation", title: "谁与它相连", body: "这些人物因同一地点、事件、作品或知识问题进入这座展厅。", objectIds: [objectId], characterIds: seed.characterIds },
        { id: "reflection", order: 4, type: "reflection", title: "带走一个问题", body: seed.reflectionQuestion, objectIds: [], characterIds: [] },
      ],
      characterRefs: seed.characterIds.map((id, position) => ({ id, relationshipLabel: seed.relationshipLabels[position] ?? "展厅关系" })),
      exit: { reflectionQuestion: seed.reflectionQuestion, ...(next ? { nextHallId: next } : {}) },
    },
    objects: [{ id: objectId, name: seed.objectName, kind: seed.objectKind, dateLabel: seed.years, placeLabel: seed.place, shortLabel: seed.objectDescription.slice(0, 48), description: seed.objectDescription, significance: seed.significance, visualDescription: `${seed.title}的主题场景艺术重建，画面围绕${seed.objectName}组织。`, representation: "evidence_based_reconstruction", sourceIds: [sourceId], relatedCharacterIds: seed.characterIds, status: "published" }],
    assets: [{ id: assetId, path: `/exhibits/${seed.id}/1.0.0/scene.webp`, contentType: "image/webp", width: seed.size[0], height: seed.size[1], representation: "evidence_based_reconstruction", sourceIds: [sourceId], alt: `${seed.title}主题场景艺术重建`, licenseCode: "Apache-2.0" }],
    sources: [{ id: sourceId, title: `${seed.title}策展说明`, note: "由 AI Museum 根据人物包公开资料与已审核主题关系编写；场景图片是教育性艺术重建，不作为史料证据。" }],
  });
}

export const publishedExhibitPacks = seeds.map(build);

export function publishedExhibitPackByHallId(hallId: string) {
  return publishedExhibitPacks.find((pack) => pack.hall.id === hallId);
}

export function publishedMuseumObjectById(objectId: string) {
  for (const pack of publishedExhibitPacks) {
    const object = pack.objects.find((item) => item.id === objectId);
    if (object) return { pack, object };
  }
  return undefined;
}
