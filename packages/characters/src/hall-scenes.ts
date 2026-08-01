import { exhibitPackSchema, type ExhibitPack } from "@ai-museum/sdk";
import { buildRenaissanceObservation, buildRenaissanceRome } from "./renaissance-halls-v2.js";

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

function buildRenaissanceFlorence(index: number): ExhibitPack {
  const base = "/exhibits/renaissance-florence/2.0.0";
  const officialSources = {
    doors: "renaissance-doors-official",
    baptism: "renaissance-baptism-official",
    leonardo: "renaissance-leonardo-adoration-official",
    botticelli: "renaissance-botticelli-adoration-official",
    venus: "renaissance-venus-official",
    david: "renaissance-david-official",
  };
  const imageSources = {
    doors: "renaissance-doors-image",
    baptism: "renaissance-baptism-image",
    leonardo: "renaissance-leonardo-adoration-image",
    botticelli: "renaissance-botticelli-adoration-image",
    venus: "renaissance-venus-image",
    david: "renaissance-david-image",
  };
  return exhibitPackSchema.parse({
    manifest: { schemaVersion: "1.0", id: "exhibit-renaissance-florence", version: "2.0.0", status: "published", author: { id: "ai-museum", name: "AI Museum Contributors" }, licenseCode: "MIXED-OPEN", publishedAt: "2026-07-31T00:00:00.000Z" },
    hall: {
      id: "renaissance-florence",
      periodId: "renaissance-science",
      sceneVersion: "2.0.0",
      locale: "zh-CN",
      title: "佛罗伦萨：杰作为何成群出现",
      question: "佛罗伦萨怎样把城市委托、工坊训练、赞助网络和公共竞争，变成持续产生杰作的条件？",
      guideTitle: "杰作不只来自天才，也来自一座不断提出难题的城市",
      guideText: "从一扇公共铜门走到《大卫》，六件作品会把资金、工坊、声望、实验和城市选择重新连在一起。这里有一条约十分钟的推荐路线，但你可以随时跳过、回看或独自参观。",
      theme: { themeKey: "renaissance-florence-v2", tokens: { bgDeep: "#4d1d2a", bgSoft: "#eadfce", surface: "#fff9ef", ink: "#27201e", accent: "#a94736", highlight: "#c79a49" }, lightAssetId: "renaissance-entrance-v2", archiveAssetId: "renaissance-entrance-v2" },
      entrance: { kicker: "1401—1504 · 佛罗伦萨", primaryActionLabel: "从第一幕开始", anchorObjectId: "renaissance-doors" },
      stations: [
        { id: "city", order: 1, type: "gallery", title: "城市先提出难题", body: "公共委托把资金、材料、工坊和观众聚集到同一个问题周围。", question: "在艺术家出现以前，一座城市需要先准备什么？", transition: "城市给出难题，工坊负责把难题变成可以触摸的作品。", objectIds: ["renaissance-doors"], characterIds: ["leonardo-da-vinci", "michelangelo"] },
        { id: "workshop", order: 2, type: "gallery", title: "天才从工坊长出来", body: "训练、协作、试验和失败都留在作品表面；一个名字背后往往有许多双手。", question: "如果一件作品由多人完成，谁才是作者？", transition: "有了训练和技巧，艺术家仍需要具体委托、时间与被看见的机会。", objectIds: ["renaissance-baptism", "renaissance-leonardo-adoration"], characterIds: ["leonardo-da-vinci", "michelangelo"] },
        { id: "patrons", order: 3, type: "gallery", title: "谁付钱，谁想被看见", body: "委托既购买图像，也购买信仰表达、社会声望和新的文化想象。", question: "出钱的人能决定作品表达什么吗？", transition: "作品完成并不意味着意义固定；一座城市还会继续选择它代表什么。", objectIds: ["renaissance-botticelli-adoration", "renaissance-venus"], characterIds: ["leonardo-da-vinci", "michelangelo", "lorenzo-medici"] },
        { id: "symbol", order: 4, type: "gallery", title: "杰作成为城市的脸", body: "作品离开工坊后，位置、观众和政治选择会继续改变它的意义。", question: "一件作品什么时候不再只属于艺术家？", transition: "你已经看见一套创造力生态：难题、材料、训练、资金、竞争与观众彼此咬合。", objectIds: ["renaissance-david"], characterIds: ["michelangelo", "leonardo-da-vinci", "machiavelli"] },
      ],
      characterRefs: [
        { id: "leonardo-da-vinci", relationshipLabel: "观察、工坊与未完成的实验" },
        { id: "michelangelo", relationshipLabel: "材料、劳动与公共雕塑" },
        { id: "lorenzo-medici", relationshipLabel: "赞助网络与城市权力" },
        { id: "machiavelli", relationshipLabel: "共和国政治与公共象征" },
      ],
      exit: { reflectionQuestion: "如果天才出生在一座不给材料、难题和观众的城市，他还会留下同样的杰作吗？", nextHallId: seeds[index + 1]?.id },
      experience: { kind: "guided_gallery", quickMinutes: 3, recommendedMinutes: 10, guideCharacterIds: ["leonardo-da-vinci", "michelangelo"], midpointStationId: "patrons" },
    },
    objects: [
      { id: "renaissance-doors", name: "佛罗伦萨洗礼堂北门", creatorLabel: "洛伦佐·吉贝尔蒂及其工坊", kind: "artifact", dateLabel: "1403—1424", placeLabel: "佛罗伦萨洗礼堂 / 现藏主教座堂博物馆", shortLabel: "一场城市竞赛，变成持续约二十年的公共工程。", description: "1401 年的竞赛决定第二组洗礼堂铜门的作者，吉贝尔蒂胜出后与工坊长期完成这组青铜浮雕。达·芬奇和米开朗琪罗当时都尚未出生。", significance: "它让我们先看见生产杰作的城市条件：行业组织、公开委托、长期资金、材料与工坊劳动。", visualDescription: "北门由二十八块四叶形框内的浮雕组成；真实作品照片中可见完整门体与建筑位置。", representation: "artifact_photo", sourceIds: [officialSources.doors, imageSources.doors], relatedCharacterIds: ["leonardo-da-vinci", "michelangelo"], status: "published", assetId: "renaissance-doors-image", factStatus: "established", observationPrompt: "先不要数人物：看看重复的边框、巨大尺度和二十八块浮雕意味着多少次铸造与协作。", licenseNote: "摄影 Yair Haklai，CC BY-SA 4.0；作品信息以 Opera del Duomo 为准。" },
      { id: "renaissance-baptism", name: "《基督受洗》", creatorLabel: "安德烈亚·德尔·韦罗基奥、达·芬奇及其他合作者", kind: "artwork", dateLabel: "约 1470—1475", placeLabel: "乌菲齐美术馆", shortLabel: "同一画面里，可以看见工坊如何共同生产。", description: "十五世纪工坊常由负责人设计，再由学生与合作者完成不同部分。当前研究认为达·芬奇的参与可能不限于左侧天使。", significance: "作品打破“一位天才独自完成一切”的想象，也提醒我们把瓦萨里的传奇故事与当前研究判断分开。", visualDescription: "画面中央是受洗的基督，左下两位天使在姿态、光线与衣褶处理上形成可比较的观察入口。", representation: "historical_image", sourceIds: [officialSources.baptism, imageSources.baptism], relatedCharacterIds: ["leonardo-da-vinci", "michelangelo"], status: "published", assetId: "renaissance-baptism-image", factStatus: "interpretation", observationPrompt: "比较左下两位天使：转身、衣褶、头发与背景光线有什么不同？", licenseNote: "忠实二维作品复制，Public Domain；馆藏解释以 Uffizi 为准。" },
      { id: "renaissance-leonardo-adoration", name: "《三博士来朝》", creatorLabel: "达·芬奇", kind: "artwork", dateLabel: "约 1481—1482", placeLabel: "乌菲齐美术馆", shortLabel: "一份有期限的委托，最后留下未完成的制作现场。", description: "1481 年文件记录奥斯定会修士委托达·芬奇为圣多纳托修道院高祭坛作画，并约定完成期限；作品最终未完成。", significance: "委托不保证完成。未完成的表面让构图、修改、材料与艺术家的职业流动直接暴露出来。", visualDescription: "中心人物已有较完整明暗，周围人物、建筑、马匹和远景仍保留大量线稿与修改痕迹。", representation: "historical_image", sourceIds: [officialSources.leonardo, imageSources.leonardo], relatedCharacterIds: ["leonardo-da-vinci", "michelangelo"], status: "published", assetId: "renaissance-leonardo-adoration-image", factStatus: "established", observationPrompt: "从最完整的中心向外看：你能找到哪三种不同完成程度？", licenseNote: "图像 CC BY-SA 4.0；馆藏与委托信息以 Uffizi 为准。" },
      { id: "renaissance-botticelli-adoration", name: "《三博士来朝》", creatorLabel: "桑德罗·波提切利", kind: "artwork", dateLabel: "约 1470—1475", placeLabel: "乌菲齐美术馆", shortLabel: "宗教画也可以成为委托人的社会名片。", description: "商人加斯帕雷·德尔·拉马为礼拜堂委托祭坛画；画面把宗教题材、佛罗伦萨社会、美第奇家族形象和委托人自我呈现结合在一起。", significance: "私人委托同时可以是信仰表达、关系展示和声望工程；成功作品也帮助艺术家获得新的注意。", visualDescription: "圣母子位于上方中心，衣着鲜明的佛罗伦萨人物环绕下方；画面右侧有人直视观众。", representation: "historical_image", sourceIds: [officialSources.botticelli, imageSources.botticelli], relatedCharacterIds: ["leonardo-da-vinci", "lorenzo-medici"], status: "published", assetId: "renaissance-botticelli-adoration-image", factStatus: "established", observationPrompt: "谁在看圣母子，谁在看身边的人，又有谁直接看向画外的你？", licenseNote: "摄影 Ghislainn，CC BY-SA 4.0；作品信息以 Uffizi 为准。" },
      { id: "renaissance-venus", name: "《维纳斯的诞生》", creatorLabel: "桑德罗·波提切利", kind: "artwork", dateLabel: "约 1485", placeLabel: "乌菲齐美术馆", shortLabel: "新的私人空间与古典兴趣，让题材边界发生变化。", description: "作品采用古典神话题材与古代雕像姿态。它很可能与美第奇家族支系有关，但 1550 年以前没有书面记录，具体委托背景不能写成定论。", significance: "它展示了私人住宅、古典文本、收藏与艺术技巧如何相遇，也示范博物馆怎样诚实保留“不确定”。", visualDescription: "维纳斯立在贝壳上抵达岸边，风神从左侧吹来，右侧人物举起饰有花朵的披风。", representation: "historical_image", sourceIds: [officialSources.venus, imageSources.venus], relatedCharacterIds: ["leonardo-da-vinci", "lorenzo-medici"], status: "published", assetId: "renaissance-venus-image", factStatus: "disputed", observationPrompt: "先看人物的轮廓和风向：画面追求的是自然重量，还是一种被设计过的节奏？", licenseNote: "Public Domain Mark；具体委托背景保留 Uffizi 所述不确定性。" },
      { id: "renaissance-david", name: "《大卫》", creatorLabel: "米开朗琪罗", kind: "artwork", dateLabel: "1501—1504", placeLabel: "佛罗伦萨美术学院美术馆", shortLabel: "材料、委托与城市选择，让雕像成为公共象征。", description: "大教堂工程委员会在 1501 年委托米开朗琪罗处理一块曾被其他艺术家加工并放弃的大理石；1504 年委员会又把原拟高置于大教堂外的雕像改放到旧宫入口。", significance: "材料限制、长期公共工程、艺术家劳动和城市政治解释共同改变一件作品的意义。", visualDescription: "大卫以站立的裸体青年形象出现，身体重心与警觉的视线形成张力；照片从较低位置呈现雕像尺度。", representation: "artifact_photo", sourceIds: [officialSources.david, imageSources.david], relatedCharacterIds: ["michelangelo", "leonardo-da-vinci", "machiavelli"], status: "published", assetId: "renaissance-david-image", factStatus: "established", observationPrompt: "如果它原本要被放到很高的位置，为什么手、头与身体的比例会这样处理？", licenseNote: "摄影 Dimitris Kamaras，CC BY 2.0；委托与位置变更以 Accademia 为准。" },
    ],
    assets: [
      { id: "renaissance-entrance-v2", path: `${base}/entrance-v2.webp`, contentType: "image/webp", width: 1400, height: 788, representation: "decorative_illustration", sourceIds: ["renaissance-environment-note"], alt: "艺术化虚构的佛罗伦萨数字展馆，拱廊外可见城市穹顶，馆内有空展框、铜浮雕与绘画工具", licenseCode: "Apache-2.0" },
      { id: "renaissance-doors-image", path: `${base}/ghiberti-north-doors.webp`, contentType: "image/webp", width: 787, height: 1400, representation: "artifact_photo", sourceIds: [imageSources.doors], alt: "吉贝尔蒂及工坊制作的佛罗伦萨洗礼堂北门全景", licenseCode: "CC-BY-SA-4.0" },
      { id: "renaissance-baptism-image", path: `${base}/baptism-of-christ.webp`, contentType: "image/webp", width: 1164, height: 1400, representation: "historical_image", sourceIds: [imageSources.baptism], alt: "韦罗基奥、达·芬奇及合作者的《基督受洗》全幅", licenseCode: "Public-Domain" },
      { id: "renaissance-leonardo-adoration-image", path: `${base}/leonardo-adoration.webp`, contentType: "image/webp", width: 1400, height: 1396, representation: "historical_image", sourceIds: [imageSources.leonardo], alt: "达·芬奇未完成的《三博士来朝》，可见线稿、明暗和不同完成程度", licenseCode: "CC-BY-SA-4.0" },
      { id: "renaissance-botticelli-adoration-image", path: `${base}/botticelli-adoration.webp`, contentType: "image/webp", width: 1400, height: 1160, representation: "historical_image", sourceIds: [imageSources.botticelli], alt: "波提切利《三博士来朝》全幅，众多佛罗伦萨人物围绕圣母子", licenseCode: "CC-BY-SA-4.0" },
      { id: "renaissance-venus-image", path: `${base}/birth-of-venus.webp`, contentType: "image/webp", width: 1200, height: 749, representation: "historical_image", sourceIds: [imageSources.venus], alt: "波提切利《维纳斯的诞生》全幅", licenseCode: "Public-Domain-Mark" },
      { id: "renaissance-david-image", path: `${base}/michelangelo-david.webp`, contentType: "image/webp", width: 1050, height: 1400, representation: "artifact_photo", sourceIds: [imageSources.david], alt: "从低处拍摄的米开朗琪罗《大卫》雕像全身", licenseCode: "CC-BY-2.0" },
    ],
    sources: [
      { id: "renaissance-environment-note", title: "AI Museum 佛罗伦萨入口环境", note: "由 AI Museum 使用生成式图像制作的艺术化虚构展馆，不是佛罗伦萨真实建筑或历史展厅复原。" },
      { id: officialSources.doors, title: "Opera del Duomo — North Gate of the Baptistery", note: "作者、制作年代、竞赛与原始位置。", url: "https://duomo.firenze.it/en/discover/opera-duomo-museum/the-halls/sala-del-paradiso/8623/lorenzo-ghiberti-porta-nord-del-battistero" },
      { id: imageSources.doors, title: "Wikimedia Commons — North doors of the Baptistry", note: "摄影 Yair Haklai；CC BY-SA 4.0。", url: "https://commons.wikimedia.org/wiki/File:North_doors_of_the_Baptistry_(Florence).jpg" },
      { id: officialSources.baptism, title: "Uffizi — The Baptism of Christ", note: "馆藏信息、工坊分工与达·芬奇参与范围。", url: "https://www.uffizi.it/en/artworks/verrocchio-leonardo-baptism-of-christ" },
      { id: imageSources.baptism, title: "Wikimedia Commons — Baptism of Christ", note: "忠实二维公版作品复制；Public Domain。", url: "https://commons.wikimedia.org/wiki/File:Verrocchio_and_Leonardo,_Baptism_of_Christ,_c1470-75,_Uffizi.jpg" },
      { id: officialSources.leonardo, title: "Uffizi — Leonardo, Adoration of the Magi", note: "1481 年委托文件、材质、年代与未完成状态。", url: "https://www.uffizi.it/en/artworks/leonardo-adoration-of-the-magi" },
      { id: imageSources.leonardo, title: "Wikimedia Commons — Leonardo, Adoration", note: "CC BY-SA 4.0。", url: "https://commons.wikimedia.org/wiki/File:Leonardo_da_Vinci,_Adoration,_c1481,_Uffizi.jpg" },
      { id: officialSources.botticelli, title: "Uffizi — Botticelli, Adoration of the Magi", note: "委托人、礼拜堂原始用途与佛罗伦萨社会人物解释。", url: "https://www.uffizi.it/en/artworks/boticelli-adoration-lami" },
      { id: imageSources.botticelli, title: "Wikimedia Commons — Botticelli, Adoration of the Magi", note: "摄影 Ghislainn；CC BY-SA 4.0。", url: "https://commons.wikimedia.org/wiki/File:Botticelli,_Adorazione_dei_Magi,_1475_circa,_Galleria_dei_Uffizi,_Firenze.JPG" },
      { id: officialSources.venus, title: "Uffizi — The Birth of Venus", note: "馆藏信息、古典来源与委托背景的不确定性。", url: "https://www.uffizi.it/en/artworks/birth-of-venus" },
      { id: imageSources.venus, title: "Wikimedia Commons — La Venere di Botticelli", note: "Public Domain Mark。", url: "https://commons.wikimedia.org/wiki/File:La_Venere_di_Botticelli.jpg" },
      { id: officialSources.david, title: "Galleria dell’Accademia — David", note: "委托、材料、尺寸与 1504 年位置决定。", url: "https://www.galleriaaccademiafirenze.it/opere/david/" },
      { id: imageSources.david, title: "Wikimedia Commons — Michelangelo's David", note: "摄影 Dimitris Kamaras；CC BY 2.0。", url: "https://commons.wikimedia.org/wiki/File:Michelangelo%27s_David,_Galleria_dell%27Accademia,_Florence_(26651321296).jpg" },
    ],
  });
}

export const publishedExhibitPacks = seeds.map((seed, index) => {
  if (seed.id === "renaissance-florence") return buildRenaissanceFlorence(index);
  if (seed.id === "renaissance-rome") return buildRenaissanceRome();
  if (seed.id === "renaissance-observation") return buildRenaissanceObservation();
  return build(seed, index);
});

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
