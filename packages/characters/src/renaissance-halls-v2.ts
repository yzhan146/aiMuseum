import { exhibitPackSchema, type ExhibitPack } from "@ai-museum/sdk";

export function buildRenaissanceRome(): ExhibitPack {
  const base = "/exhibits/renaissance-rome/2.0.0";
  return exhibitPackSchema.parse({
    manifest: { schemaVersion: "1.0", id: "exhibit-renaissance-rome", version: "2.0.0", status: "published", author: { id: "ai-museum", name: "AI Museum Contributors" }, licenseCode: "MIXED-OPEN", publishedAt: "2026-07-31T00:00:00.000Z" },
    hall: {
      id: "renaissance-rome",
      periodId: "renaissance-science",
      sceneVersion: "2.0.0",
      locale: "zh-CN",
      title: "罗马工作坊：一位大师，其实有多少双手？",
      question: "罗马怎样把大师之间的竞争，变成纸上试验、团队协作和传遍欧洲的风格？",
      guideTitle: "签名属于大师，杰作却往往来自一间会协作、会竞争、也会复制的工作坊",
      guideText: "先看艺术家怎样在纸上试错，再看草图怎样被放大、交给团队并通过版画远行。这里有一条约十分钟的推荐路线，但你可以随时跳过、回看或独自参观。",
      theme: { themeKey: "renaissance-rome-v2", tokens: { bgDeep: "#3d2425", bgSoft: "#e7d8c8", surface: "#fff8ed", ink: "#2b211f", accent: "#9f4636", highlight: "#c49549" }, lightAssetId: "rome-entrance-v2", archiveAssetId: "rome-entrance-v2" },
      entrance: { kicker: "约 1510–1524 · 罗马", primaryActionLabel: "从第一张草图开始", anchorObjectId: "rome-libyan-sibyl-study" },
      stations: [
        { id: "sketch", order: 1, type: "gallery", title: "先在纸上试错", body: "成品出现以前，身体、动作和构图已经在许多张纸上被反复拆解。草图不是杰作的附属品，而是艺术家思考发生的现场。", objectIds: ["rome-libyan-sibyl-study", "rome-christ-child-study"], characterIds: ["michelangelo", "raphael"], question: "如果没有人看见这些试错，‘天才’看起来会不会过于轻松？", transition: "小纸张解决局部难题；接下来，图样必须变得足够大、足够清楚，才能让许多人共同工作。" },
        { id: "cartoon", order: 2, type: "gallery", title: "把图样放大成共同语言", body: "拉斐尔的挂毯画稿接近最终织物的尺寸。轮廓、色彩和叙事被固定下来，使不在罗马的织工也能沿着同一套视觉指令工作。", objectIds: ["rome-miraculous-draught-cartoon"], characterIds: ["raphael"], question: "当创意必须交给远方的工匠执行，图样需要说清楚什么？", transition: "一张大画稿可以协调工匠；但覆盖整间宫殿的工程，还需要组织者、助手和连续的判断。" },
        { id: "workshop", order: 3, type: "gallery", title: "大师的名字，装着很多双手", body: "拉斐尔去世后，助手继续完成君士坦丁厅。《米尔维安大桥之战》常与拉斐尔之名相连，但主要执行者被认为是朱利奥·罗马诺等工作坊成员。", objectIds: ["rome-milvian-bridge"], characterIds: ["raphael", "michelangelo"], question: "署名帮助我们记住谁，又让谁更容易从历史里消失？", transition: "工作坊让大型项目成为可能；版画则让一种风格离开墙面，跑得比艺术家本人更远。" },
        { id: "prints", order: 4, type: "gallery", title: "版画让风格跑得比人更快", body: "马坎托尼奥把拉斐尔的设计转化成可以印出多份的铜版画。大师的构图由此进入更多收藏、工坊和城市，竞争也扩展成一场关于传播速度的比赛。", objectIds: ["rome-judgment-of-paris"], characterIds: ["raphael", "michelangelo"], question: "当图像可以被大量复制，作者、作品和名声之间的关系发生了什么变化？" },
      ],
      characterRefs: [
        { id: "raphael", relationshipLabel: "构图、工作坊组织与版画传播" },
        { id: "michelangelo", relationshipLabel: "人体草图、材料意识与大师竞争" },
        { id: "sofonisba-anguissola", relationshipLabel: "职业艺术家的另一条道路" },
      ],
      exit: { reflectionQuestion: "一件作品究竟从什么时候开始属于‘一个人’，又从什么时候开始属于一群人？", nextHallId: "renaissance-observation" },
      experience: { kind: "guided_gallery", quickMinutes: 3, recommendedMinutes: 10, guideCharacterIds: ["raphael", "michelangelo"], midpointStationId: "workshop" },
    },
    objects: [
      { id: "rome-libyan-sibyl-study", name: "《利比亚女先知习作》", creatorLabel: "米开朗琪罗", kind: "artwork", dateLabel: "约 1510–1511", placeLabel: "大都会艺术博物馆", shortLabel: "一张为西斯廷天顶画准备的人体习作，把动作拆成可以修改的问题。", description: "米开朗琪罗用红粉笔研究人物背部、肩臂与脚部姿势，为西斯廷礼拜堂天顶画中的利比亚女先知做准备。纸上的重复线条保留了调整过程。", significance: "它让‘灵感’变得可见：大型壁画先从观察、练习和不断修正的局部研究开始。", visualDescription: "纸上可见一位扭转身体的裸背人物研究，周围另有手、脚和小型坐姿草图。", representation: "historical_image", sourceIds: ["rome-met-libyan"], relatedCharacterIds: ["michelangelo", "raphael"], status: "published", assetId: "rome-libyan-image", factStatus: "established", observationPrompt: "先找重复或加深的线条：米开朗琪罗在哪些部位仍在改变主意？", licenseNote: "The Met Open Access，Public Domain。" },
      { id: "rome-christ-child-study", name: "《圣婴习作》", creatorLabel: "拉斐尔", kind: "artwork", dateLabel: "1513–1514", placeLabel: "大都会艺术博物馆", shortLabel: "针刺转印留下的痕迹，提示纸上构图将被带到另一块表面。", description: "拉斐尔在纸上反复研究圣婴的身体与动作；纸张可见针刺痕迹，说明轮廓曾被转印，用于推进另一件作品。", significance: "草图既是个人试验，也是工作流程中的可传递工具。它把一个人的判断变成下一位协作者可以执行的信息。", visualDescription: "纸上集中排列数个圣婴身体与肢体姿势，线条轻重不同，并留有用于转印的针刺痕迹。", representation: "historical_image", sourceIds: ["rome-met-christ-child"], relatedCharacterIds: ["raphael", "michelangelo"], status: "published", assetId: "rome-christ-image", factStatus: "established", observationPrompt: "如果这些轮廓要交给别人继续做，哪些线必须确定，哪些仍可以模糊？", licenseNote: "The Met Open Access，Public Domain。" },
      { id: "rome-miraculous-draught-cartoon", name: "《捕鱼奇迹》挂毯画稿", creatorLabel: "拉斐尔及其工作坊", kind: "artwork", dateLabel: "约 1515–1516", placeLabel: "V&A / 英国王室收藏", shortLabel: "接近成品尺寸的大画稿，把构图变成远方织工也能读取的共同语言。", description: "这张为西斯廷礼拜堂挂毯设计的巨幅画稿由多张纸拼接而成。画稿完成后被送往布鲁塞尔，织工依据它制作挂毯，图像方向也会在织造中反转。", significance: "它把作者从‘亲手完成每一处的人’改写为提出视觉方案、协调团队与跨城市生产的人。", visualDescription: "基督与使徒分列船中，人物动作与鱼群形成清晰叙事；整张画稿由大幅纸面拼接组成。", representation: "historical_image", sourceIds: ["rome-va-cartoons", "rome-commons-cartoon"], relatedCharacterIds: ["raphael", "michelangelo"], status: "published", assetId: "rome-cartoon-image", factStatus: "established", observationPrompt: "想象你是远在布鲁塞尔的织工：仅凭这张图，你最需要读懂什么？", licenseNote: "作品复制图，Public Domain；作品信息以 V&A 为准。" },
      { id: "rome-milvian-bridge", name: "《米尔维安大桥之战》", creatorLabel: "拉斐尔工作坊，主要归于朱利奥·罗马诺", kind: "artwork", dateLabel: "约 1520–1524", placeLabel: "梵蒂冈博物馆·君士坦丁厅", shortLabel: "一项在拉斐尔去世后继续完成的宫殿工程，暴露出‘大师品牌’与集体劳动的张力。", description: "君士坦丁厅的设计在拉斐尔晚年启动，并在他 1520 年去世后由工作坊推进。这幅大型壁画通常主要归于助手朱利奥·罗马诺，其他成员也参与了整厅实施。", significance: "历史习惯用大师之名概括大型工程，但作品真正依赖组织、继承和多位助手的劳动。具体分工仍是研究判断，不能写成每一笔都已确定。", visualDescription: "大幅战役壁画中人物、马匹与旗帜密集交错，宏大叙事覆盖整面宫殿墙壁。", representation: "artifact_photo", sourceIds: ["rome-vatican-constantine", "rome-commons-milvian"], relatedCharacterIds: ["raphael", "michelangelo"], status: "published", assetId: "rome-battle-image", factStatus: "interpretation", observationPrompt: "面对这样一整面墙，哪些工作可能由设计者决定，哪些必须交给助手完成？", licenseNote: "摄影 Daryl Mitchell，CC BY-SA 2.0；归属说明以梵蒂冈博物馆为准。" },
      { id: "rome-judgment-of-paris", name: "《帕里斯的评判》", creatorLabel: "马坎托尼奥·雷蒙迪，据拉斐尔设计", kind: "artwork", dateLabel: "约 1510–1520", placeLabel: "大都会艺术博物馆", shortLabel: "铜版画把拉斐尔的构图复制成多份，让风格越过工作坊和城市。", description: "马坎托尼奥依据拉斐尔的设计刻制铜版，以密集排线组织明暗。大都会博物馆把它视为两人合作的高峰之一，具体年代在研究中有不同判断。", significance: "印刷让图像不必依附一面墙或一位委托人；设计、刻制、复制和传播由不同角色完成，艺术声望也获得新的扩散方式。", visualDescription: "横向铜版画容纳众多神话人物，前景、天空与河神由系统化排线区分出明暗层次。", representation: "historical_image", sourceIds: ["rome-met-judgment"], relatedCharacterIds: ["raphael", "michelangelo"], status: "published", assetId: "rome-judgment-image", factStatus: "disputed", observationPrompt: "先不追故事，只看排线：刻版者怎样用黑白线条模拟绘画的空间和体积？", licenseNote: "The Met Open Access，Public Domain；年代保留馆方所述范围。" },
    ],
    assets: [
      { id: "rome-entrance-v2", path: `${base}/entrance-v2.webp`, contentType: "image/webp", width: 1672, height: 941, representation: "decorative_illustration", sourceIds: ["rome-environment-note"], alt: "艺术化虚构的罗马文艺复兴工作坊展馆，含草图墙、巨幅画稿、脚手架、协作者与印刷机", licenseCode: "Apache-2.0" },
      { id: "rome-libyan-image", path: `${base}/michelangelo-libyan-sibyl-study.webp`, contentType: "image/webp", width: 1032, height: 1400, representation: "historical_image", sourceIds: ["rome-met-libyan"], alt: "米开朗琪罗《利比亚女先知习作》红粉笔人体与局部研究", licenseCode: "Public-Domain" },
      { id: "rome-christ-image", path: `${base}/raphael-christ-child-study.webp`, contentType: "image/webp", width: 1096, height: 1400, representation: "historical_image", sourceIds: ["rome-met-christ-child"], alt: "拉斐尔《圣婴习作》纸上多个人体动作研究", licenseCode: "Public-Domain" },
      { id: "rome-cartoon-image", path: `${base}/raphael-miraculous-draught-cartoon.webp`, contentType: "image/webp", width: 1076, height: 870, representation: "historical_image", sourceIds: ["rome-commons-cartoon"], alt: "拉斐尔《捕鱼奇迹》巨幅挂毯画稿全景", licenseCode: "Public-Domain" },
      { id: "rome-battle-image", path: `${base}/battle-of-milvian-bridge.webp`, contentType: "image/webp", width: 1400, height: 1050, representation: "artifact_photo", sourceIds: ["rome-commons-milvian"], alt: "梵蒂冈君士坦丁厅《米尔维安大桥之战》壁画全景", licenseCode: "CC-BY-SA-2.0" },
      { id: "rome-judgment-image", path: `${base}/judgment-of-paris.webp`, contentType: "image/webp", width: 1400, height: 948, representation: "historical_image", sourceIds: ["rome-met-judgment"], alt: "马坎托尼奥·雷蒙迪据拉斐尔设计刻制的《帕里斯的评判》铜版画", licenseCode: "Public-Domain" },
    ],
    sources: [
      { id: "rome-environment-note", title: "AI Museum 罗马工作坊入口环境", note: "AI Museum 使用生成式图像制作的艺术化虚构展馆，不是罗马真实建筑或历史工作坊复原。" },
      { id: "rome-met-libyan", title: "The Met — Studies for the Libyan Sibyl", note: "作品、年代、材料、用途与 Open Access 图像。", url: "https://www.metmuseum.org/art/collection/search/337497" },
      { id: "rome-met-christ-child", title: "The Met — Studies of the Christ Child", note: "作品、年代、针刺转印痕迹与 Open Access 图像。", url: "https://www.metmuseum.org/art/collection/search/340579" },
      { id: "rome-va-cartoons", title: "V&A — The Raphael Cartoons", note: "挂毯画稿的用途、尺寸、制作和跨城市织造背景。", url: "https://www.vam.ac.uk/articles/the-raphael-cartoons" },
      { id: "rome-commons-cartoon", title: "Wikimedia Commons — The Miraculous Draught of Fishes", note: "忠实二维作品复制，Public Domain。", url: "https://commons.wikimedia.org/wiki/File:V%26A_-_Raphael,_The_Miraculous_Draught_of_Fishes_(1515).jpg" },
      { id: "rome-vatican-constantine", title: "Vatican Museums — Hall of Constantine", note: "君士坦丁厅、拉斐尔工作坊与壁画主题的馆方说明。", url: "https://www.museivaticani.va/content/museivaticani/en/collezioni/musei/stanze-di-raffaello/sala-di-costantino.html" },
      { id: "rome-commons-milvian", title: "Wikimedia Commons — Battle of the Milvian Bridge", note: "摄影 Daryl Mitchell，CC BY-SA 2.0。", url: "https://commons.wikimedia.org/wiki/File:Room_of_Constantine_-_The_Battle_of_the_Milvian_Bridge_(15462512410).jpg" },
      { id: "rome-met-judgment", title: "The Met — The Judgment of Paris", note: "作者、拉斐尔设计关系、年代争议、技法与 Open Access 图像。", url: "https://www.metmuseum.org/art/collection/search/337058" },
    ],
  });
}

export function buildRenaissanceObservation(): ExhibitPack {
  const base = "/exhibits/renaissance-observation/2.0.0";
  return exhibitPackSchema.parse({
    manifest: { schemaVersion: "1.0", id: "exhibit-renaissance-observation", version: "2.0.0", status: "published", author: { id: "ai-museum", name: "AI Museum Contributors" }, licenseCode: "MIXED-OPEN", publishedAt: "2026-07-31T00:00:00.000Z" },
    hall: {
      id: "renaissance-observation",
      periodId: "renaissance-science",
      sceneVersion: "2.0.0",
      locale: "zh-CN",
      title: "望远镜与星图：新宇宙如何成为证据？",
      question: "一张新宇宙图、更精确的数字和一根望远镜，怎样从‘新想法’变成能被别人检查的证据？",
      guideTitle: "科学改变世界，不只需要大胆猜想，还需要测量、计算、记录和公开争论",
      guideText: "从哥白尼的宇宙图出发，经过第谷的仪器、开普勒的计算和伽利略的望远镜，看看一项主张怎样变成别人能够复查的证据。推荐路线约十分钟，也可以三分钟自由速览。",
      theme: { themeKey: "renaissance-observation-v2", tokens: { bgDeep: "#162b49", bgSoft: "#d7e0e7", surface: "#fffaf0", ink: "#1d2835", accent: "#a84c3b", highlight: "#c79b45" }, lightAssetId: "observation-entrance-v2", archiveAssetId: "observation-entrance-v2" },
      entrance: { kicker: "1543–1632 · 欧洲知识网络", primaryActionLabel: "从一张新宇宙图开始", anchorObjectId: "observation-copernicus-diagram" },
      stations: [
        { id: "model", order: 1, type: "gallery", title: "先换一张宇宙图", body: "哥白尼把太阳置于行星秩序的中心，并让地球成为运动的行星。图很简洁，但它首先是一个需要由计算和观察继续检验的数学模型。", objectIds: ["observation-copernicus-diagram"], characterIds: ["copernicus", "johannes-kepler"], question: "一张更整齐的图，已经足够证明宇宙真的如此吗？", transition: "新模型提出了方向；接下来，需要更精确的数据来判断它能否解释天空中不肯配合的细节。" },
        { id: "measure", order: 2, type: "gallery", title: "数字逼圆让路", body: "第谷在望远镜出现前用大型仪器提高观测精度。开普勒继承这些数据，反复处理火星轨道，最终放弃完美圆形，提出椭圆轨道。", objectIds: ["observation-tycho-instrument", "observation-kepler-page"], characterIds: ["johannes-kepler", "galileo"], question: "当数据与漂亮的理论只差一点点，你会修改数据，还是修改理论？", transition: "计算改变了轨道形状；几乎同时，一种新工具开始把肉眼看不到的天空细节送到纸上。" },
        { id: "telescope", order: 3, type: "gallery", title: "把天空送进镜筒", body: "伽利略改进望远镜并把观察画进《星际信使》。月面起伏和围绕木星移动的小点挑战了旧宇宙图景，但它们本身并没有单独证明地球在运动。", objectIds: ["observation-galileo-telescope", "observation-jupiter-moons"], characterIds: ["galileo", "johannes-kepler"], question: "看见一个从未见过的现象后，怎样让远方的人相信你没有看错？", transition: "观察必须被记录、印刷和重复；一旦证据进入公共空间，它也会进入关于解释、权威与风险的争论。" },
        { id: "debate", order: 4, type: "gallery", title: "证据走进公开争论", body: "《关于托勒密和哥白尼两大世界体系的对话》把不同宇宙模型写成多日讨论。印刷让论证被更多人阅读，也让科学主张与宗教、政治和修辞环境发生正面碰撞。", objectIds: ["observation-dialogo-frontispiece"], characterIds: ["galileo", "johannes-kepler"], question: "公开争论会让证据更可靠，还是只会让立场更尖锐？" },
      ],
      characterRefs: [
        { id: "copernicus", relationshipLabel: "日心模型与数学秩序" },
        { id: "galileo", relationshipLabel: "望远镜观察、记录与公开争论" },
        { id: "johannes-kepler", relationshipLabel: "精密数据、火星问题与椭圆轨道" },
        { id: "johannes-gutenberg", relationshipLabel: "印刷如何扩大检验与争论" },
      ],
      exit: { reflectionQuestion: "一个新想法要经过哪些步骤，才不再只是某个人的相信？", nextHallId: "physics-solvay" },
      experience: { kind: "guided_gallery", quickMinutes: 3, recommendedMinutes: 10, guideCharacterIds: ["galileo", "johannes-kepler"], midpointStationId: "telescope" },
    },
    objects: [
      { id: "observation-copernicus-diagram", name: "《天体运行论》日心秩序图", creatorLabel: "尼古拉·哥白尼", kind: "document", dateLabel: "1543", placeLabel: "纽伦堡初版", shortLabel: "一张把太阳放到行星秩序中心的图，重新安排了地球的位置。", description: "哥白尼在《天体运行论》中以太阳为中心排列已知行星，并让地球同时自转、绕太阳运行。这张图表达模型结构，不是按真实距离绘制的现代太阳系地图。", significance: "它把‘地球是否运动’变成可以用数学系统讨论的问题，但模型仍需要数据、预测和后续观察来检验。", visualDescription: "拉丁文圆环图中央标出太阳，地球与其他行星分布在同心轨道层级中。", representation: "historical_image", sourceIds: ["observation-smithsonian-copernicus", "observation-commons-copernicus"], relatedCharacterIds: ["copernicus", "galileo", "johannes-kepler"], status: "published", assetId: "observation-copernicus-image", factStatus: "established", observationPrompt: "先看地球被放在第几圈：这张图改变的不是一个天体，而是谁有资格成为中心。", licenseNote: "1543 年原书图，Public Domain；页面来源见 Smithsonian 与 Commons。" },
      { id: "observation-tycho-instrument", name: "第谷·布拉赫的大型象限仪图", creatorLabel: "第谷·布拉赫《重建天文学的仪器》", kind: "instrument", dateLabel: "1602 公开版", placeLabel: "纽伦堡", shortLabel: "在望远镜以前，巨大而稳定的仪器把肉眼观测推进到更高精度。", description: "第谷设计大型固定测量仪器，并与助手长期记录恒星和行星位置。《重建天文学的仪器》用图像和文字介绍这些装置及其观测方法。", significance: "开普勒后来能够发现火星轨道不是完美圆形，依赖的正是这些难以被旧模型轻易忽略的精密数据。", visualDescription: "版画展示大型刻度天文仪器、观测者与协作者，结构尺度明显超过单人手持工具。", representation: "historical_image", sourceIds: ["observation-smithsonian-tycho", "observation-commons-tycho"], relatedCharacterIds: ["johannes-kepler", "copernicus", "galileo"], status: "published", assetId: "observation-tycho-image", factStatus: "established", observationPrompt: "找找画面里需要几个人：精确观察为什么同时也是组织工作？", licenseNote: "原书插图，Public Domain；作品信息以 Smithsonian 为准。" },
      { id: "observation-kepler-page", name: "《新天文学》火星模型比较页", creatorLabel: "约翰内斯·开普勒", kind: "document", dateLabel: "1609", placeLabel: "海德堡出版", shortLabel: "开普勒让火星数据逼迫完美圆形退场，把椭圆写进天文学。", description: "开普勒使用第谷的火星观测数据，在《新天文学》中比较哥白尼、托勒密与第谷式模型，并展开长篇几何与物理论证，最终提出行星沿椭圆轨道运行。", significance: "它展示科学模型并非只靠漂亮或权威获胜：微小而持续的数据偏差可以迫使研究者放弃长期偏爱的形状。", visualDescription: "早期印刷书页把哥白尼、托勒密与第谷的火星模型并列，圆、视线和位置标记把同一批现象转化为可比较的几何问题。", representation: "historical_image", sourceIds: ["observation-smithsonian-kepler", "observation-commons-kepler"], relatedCharacterIds: ["johannes-kepler", "copernicus", "galileo"], status: "published", assetId: "observation-kepler-image", factStatus: "established", observationPrompt: "这页看起来不如星空浪漫：为什么真正改变宇宙的证据常常长得像计算草稿？", licenseNote: "1609 年原书插图，Public Domain；作品信息以 Smithsonian 为准。" },
      { id: "observation-galileo-telescope", name: "伽利略望远镜（Inv. 2428）", creatorLabel: "伽利略·伽利莱", kind: "instrument", dateLabel: "1609–1610", placeLabel: "佛罗伦萨·伽利略博物馆", shortLabel: "这根保存至今的镜筒提醒我们：新工具会扩大眼睛，也会带来新的误差。", description: "这件望远镜由木管和镜片构成，是伽利略留存下来的早期仪器之一。伽利略并非发明望远镜的人，但他改进倍率并把它系统用于天文观察。", significance: "工具让新的现象可见，却不会自动给出解释；观察者还必须校准、记录，并让别人能够重复检查。", visualDescription: "照片同时展示伽利略博物馆保存的两根早期望远镜；下方标号 4 的深色装饰镜筒是 Inv. 2428，可见其完整长度与两端结构。", representation: "artifact_photo", sourceIds: ["observation-museo-telescope", "observation-commons-telescope"], relatedCharacterIds: ["galileo", "johannes-kepler", "copernicus"], status: "published", assetId: "observation-telescope-image", factStatus: "established", observationPrompt: "这样一根朴素镜筒为什么足以改变争论？先想它让哪些现象第一次可被反复观察。", licenseNote: "摄影 Zde，CC BY-SA 4.0；下方标号 4 为 Inv. 2428，器物信息以 Museo Galileo 为准。" },
      { id: "observation-jupiter-moons", name: "《星际信使》木星卫星观测记录", creatorLabel: "伽利略·伽利莱", kind: "document", dateLabel: "1610", placeLabel: "威尼斯初版", shortLabel: "连续几夜移动的小点，把一次惊奇变成可以比较的观察序列。", description: "伽利略记录木星附近亮点在不同夜晚的位置变化，并判断它们围绕木星运行。这些后来被称为伽利略卫星的天体说明，并非所有运动都以地球为中心。", significance: "关键不只是‘看见’，而是按时间记录位置、比较变化并把结果印刷出来，使远方读者可以复查。它支持新的宇宙图景，但并未单独证明地球运动。", visualDescription: "书页以一排排小圆点标记木星与卫星在连续日期中的相对位置。", representation: "historical_image", sourceIds: ["observation-smithsonian-sidereus", "observation-commons-moons"], relatedCharacterIds: ["galileo", "johannes-kepler", "copernicus"], status: "published", assetId: "observation-moons-image", factStatus: "established", observationPrompt: "遮住日期，只看小点：你能从哪种重复变化判断它们不是固定恒星？", licenseNote: "1610 年原书扫描，Public Domain。" },
      { id: "observation-dialogo-frontispiece", name: "《关于两大世界体系的对话》卷首图", creatorLabel: "斯特凡诺·德拉·贝拉；伽利略著作", kind: "document", dateLabel: "1632", placeLabel: "佛罗伦萨初版", shortLabel: "三位对话者站在卷首，把宇宙模型变成一场可阅读、也有风险的公开争论。", description: "卷首图描绘三位讨论者，书中则用四日对话比较托勒密与哥白尼体系。它借修辞推动读者判断，也因此不能把历史争议简化成一次观察直接击败旧观点。", significance: "印刷扩大了证据与论证的受众，也扩大了政治、宗教与制度后果。科学知识要成为公共知识，必须进入可以质疑的共同空间。", visualDescription: "三位人物身着长袍站在港口般的背景前交谈，书名与出版信息组成建筑式边框。", representation: "historical_image", sourceIds: ["observation-met-dialogo", "observation-smithsonian-dialogo"], relatedCharacterIds: ["galileo", "johannes-kepler", "copernicus"], status: "published", assetId: "observation-dialogo-image", factStatus: "established", observationPrompt: "为什么作者选择‘对话’而不是只列结论？这种形式怎样邀请读者，也怎样隐藏立场？", licenseNote: "The Met Open Access，Public Domain；著作信息另见 Smithsonian。" },
    ],
    assets: [
      { id: "observation-entrance-v2", path: `${base}/entrance-v2.webp`, contentType: "image/webp", width: 1672, height: 941, representation: "decorative_illustration", sourceIds: ["observation-environment-note"], alt: "艺术化虚构的蓝色暮光天文展馆，含印刷机、星图、大型象限仪、望远镜与城市窗景", licenseCode: "Apache-2.0" },
      { id: "observation-copernicus-image", path: `${base}/copernicus-heliocentric-diagram.webp`, contentType: "image/webp", width: 1400, height: 1199, representation: "historical_image", sourceIds: ["observation-commons-copernicus"], alt: "哥白尼《天体运行论》中的日心行星秩序图", licenseCode: "Public-Domain" },
      { id: "observation-tycho-image", path: `${base}/tycho-quadrant.webp`, contentType: "image/webp", width: 933, height: 1400, representation: "historical_image", sourceIds: ["observation-commons-tycho"], alt: "第谷·布拉赫著作中大型天文测量仪器与观测者插图", licenseCode: "Public-Domain" },
      { id: "observation-kepler-image", path: `${base}/kepler-astronomia-nova.webp`, contentType: "image/webp", width: 933, height: 1400, representation: "historical_image", sourceIds: ["observation-commons-kepler"], alt: "开普勒《新天文学》比较哥白尼、托勒密与第谷火星模型的几何图页", licenseCode: "Public-Domain" },
      { id: "observation-telescope-image", path: `${base}/galileo-telescope.webp`, contentType: "image/webp", width: 1400, height: 931, representation: "artifact_photo", sourceIds: ["observation-commons-telescope"], alt: "伽利略博物馆展柜中的两根伽利略早期望远镜，下方深色镜筒为 Inv. 2428", licenseCode: "CC-BY-SA-4.0" },
      { id: "observation-moons-image", path: `${base}/jupiter-moons.webp`, contentType: "image/webp", width: 334, height: 500, representation: "historical_image", sourceIds: ["observation-commons-moons"], alt: "《星际信使》中木星与卫星连续位置观测记录", licenseCode: "Public-Domain" },
      { id: "observation-dialogo-image", path: `${base}/dialogo-frontispiece.webp`, contentType: "image/webp", width: 1013, height: 1400, representation: "historical_image", sourceIds: ["observation-met-dialogo"], alt: "伽利略《关于两大世界体系的对话》1632 年卷首图", licenseCode: "Public-Domain" },
    ],
    sources: [
      { id: "observation-environment-note", title: "AI Museum 望远镜与星图入口环境", note: "AI Museum 使用生成式图像制作的艺术化虚构展馆，不是历史天文台或真实建筑复原。" },
      { id: "observation-smithsonian-copernicus", title: "Smithsonian Libraries — De revolutionibus", note: "1543 年初版、日心模型与馆藏数字化说明。", url: "https://library.si.edu/digital-library/author/copernicus-nicolaus" },
      { id: "observation-commons-copernicus", title: "Wikimedia Commons — Copernican heliocentrism diagram", note: "1543 年原书图像，Public Domain。", url: "https://commons.wikimedia.org/wiki/File:Copernican_heliocentrism_diagram-2.jpg" },
      { id: "observation-smithsonian-tycho", title: "Smithsonian Libraries — Astronomiæ instauratæ mechanica", note: "第谷仪器、观测组织、1602 公开版与 CC0 数字馆藏。", url: "https://library.si.edu/digital-library/book/tychonisbraheas00braha" },
      { id: "observation-commons-tycho", title: "Wikimedia Commons — Astronomiae Instauratae Mechanica illustration", note: "法国国家图书馆原书插图，Public Domain。", url: "https://commons.wikimedia.org/wiki/File:Illustrations_de_Astronomiae_Instauratae_Mechanica_-_(Non_identifi%C3%A9)_;_Tycho_Brahe,_aut._de_texte_-_btv1b2600056p_(03_of_28).jpg" },
      { id: "observation-smithsonian-kepler", title: "Smithsonian Libraries — Astronomia nova", note: "1609 年初版、火星数据与开普勒前两条行星运动定律。", url: "https://library.si.edu/digital-library/book/astronomianovaa00kepl" },
      { id: "observation-commons-kepler", title: "Wikimedia Commons — Astronomia nova illustration", note: "法国国家图书馆原书插图，Public Domain。", url: "https://commons.wikimedia.org/wiki/File:Illustrations_de_Astronomia_nova._Suivi_de_Physica_coelestis_tradita_commentariis_de_motibus_stellae_martis,_ex_observationibus_g._v._Tychonis_Brah%C3%A9_-_(Non_identifi%C3%A9)_;_Johannes_Kepler,_aut._de_texte_-_btv1b2600017k_(2_of_3).jpg" },
      { id: "observation-museo-telescope", title: "Museo Galileo — Galileo's telescope (Inv. 2428)", note: "保存器物的年代、构造与馆藏说明。", url: "https://catalogue.museogalileo.it/gallery/GalileosTelescope_n03.html" },
      { id: "observation-commons-telescope", title: "Wikimedia Commons — Galilei telescopes, Inv. 242 and 2428", note: "摄影 Zde，CC BY-SA 4.0；下方标号 4 为 Inv. 2428。", url: "https://commons.wikimedia.org/wiki/File:Galilei_telescopes,_Museo_Galileo,_Florence,_Inv._242,_2428,_224088.jpg" },
      { id: "observation-smithsonian-sidereus", title: "Smithsonian Libraries — Sidereus nuncius", note: "1610 年初版、望远镜观察及 CC0 数字馆藏。", url: "https://library.si.edu/digital-library/book/sidereusnuncius00gali" },
      { id: "observation-commons-moons", title: "Wikimedia Commons — Sidereus Nuncius Medicean Stars", note: "1610 年原书扫描，Public Domain。", url: "https://commons.wikimedia.org/wiki/File:Sidereus_Nuncius_Medicean_Stars.jpg" },
      { id: "observation-met-dialogo", title: "The Met — Frontispiece for Dialogo di Galileo Galilei", note: "斯特凡诺·德拉·贝拉卷首图与 Open Access 图像。", url: "https://www.metmuseum.org/art/collection/search/377632" },
      { id: "observation-smithsonian-dialogo", title: "Smithsonian Libraries — Dialogo", note: "1632 年初版、两大世界体系对话与 No Copyright 数字馆藏。", url: "https://library.si.edu/image-gallery/110681" },
    ],
  });
}
