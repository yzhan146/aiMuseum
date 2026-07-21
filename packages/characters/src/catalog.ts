import { characterExhibitById, fallbackExhibit, type CharacterExhibit } from "./exhibits.js";

export type CharacterTier = "white" | "blue" | "purple" | "orange" | "gold";
export type PortraitRepresentation = "historical_portrait" | "evidence_based_reconstruction" | "artistic_interpretation";

export interface PortraitVariant {
  assetPath?: string;
  alt: string;
  representation: PortraitRepresentation;
  sourceLabel?: string;
  license?: string;
}

export interface CatalogCharacter {
  id: string;
  periodId: string;
  name: string;
  initial: string;
  life: string;
  bornAt: string;
  diedAt: string;
  tier: CharacterTier;
  curatorRole: string;
  summary: string;
  exhibit: CharacterExhibit;
  relationCharacterIds: string[];
  portraitVariants: {
    cartoon: PortraitVariant;
    realistic: PortraitVariant;
  };
}

export interface ExhibitHall {
  id: string;
  title: string;
  question: string;
  characterIds: string[];
}

export interface HistoricalPeriod {
  id: string;
  title: string;
  years: string;
  place: string;
  mark: string;
  theme: "tang" | "renaissance" | "physics";
  inquiry: string;
  halls: ExhibitHall[];
  characters: CatalogCharacter[];
}

const person = (
  id: string,
  periodId: string,
  name: string,
  initial: string,
  life: string,
  bornAt: string,
  diedAt: string,
  tier: CharacterTier,
  curatorRole: string,
  summary: string,
  relationCharacterIds: string[]
): CatalogCharacter => ({
  id,
  periodId,
  name,
  initial,
  life,
  bornAt,
  diedAt,
  tier,
  curatorRole,
  summary,
  exhibit: characterExhibitById[id] ?? fallbackExhibit(name, summary),
  relationCharacterIds,
  portraitVariants: {
    cartoon: {
      alt: `${name}的卡通形象占位`,
      representation: "artistic_interpretation",
      sourceLabel: "形象资产待维护者添加"
    },
    realistic: {
      assetPath: `/characters/realistic/${id}.png`,
      alt: `${name}的典藏模式写实历史重建头像`,
      representation: "evidence_based_reconstruction",
      sourceLabel: "AI Museum 历史重建头像"
    }
  }
});

export const historicalPeriods: HistoricalPeriod[] = [
  {
    id: "tang-east-asia",
    title: "盛唐与东亚交流",
    years: "618–907",
    place: "长安、洛阳、西域与东亚海路",
    mark: "唐",
    theme: "tang",
    inquiry: "一个开放繁荣的帝国，为什么也会经历战争与巨大转折？",
    halls: [
      { id: "tang-changan", title: "长安：诗人与世界城市", question: "一座都城怎样连接诗歌、宫廷与远方来客？", characterIds: ["li-bai", "du-fu", "wang-wei", "tang-xuanzong", "abe-no-nakamaro"] },
      { id: "tang-buddhism", title: "佛法东行与丝路旅行", question: "旅行者怎样让知识跨越语言与海洋？", characterIds: ["xuanzang", "jianzhen", "abe-no-nakamaro"] },
      { id: "tang-rebellion", title: "安史之乱：盛世为何转折", question: "繁荣的帝国为什么会突然陷入长期战争？", characterIds: ["tang-xuanzong", "an-lushan", "guo-ziyi", "yan-zhenqing", "du-fu", "yang-guifei"] }
    ],
    characters: [
      person("wu-zetian", "tang-east-asia", "武则天", "武", "624–705", "0624-01-01", "0705-12-16", "orange", "时代人物", "皇帝、政治制度与女性权力", ["tang-xuanzong", "xuanzang"]),
      person("tang-xuanzong", "tang-east-asia", "唐玄宗", "玄", "685–762", "0685-09-08", "0762-05-03", "purple", "核心人物", "盛世与安史之乱转折", ["yang-guifei", "an-lushan", "li-bai"]),
      person("li-bai", "tang-east-asia", "李白", "李", "701–762", "0701-01-01", "0762-12-01", "gold", "典藏人物", "诗歌、漫游与宫廷经历", ["du-fu", "tang-xuanzong", "abe-no-nakamaro"]),
      person("du-fu", "tang-east-asia", "杜甫", "杜", "712–770", "0712-01-01", "0770-01-01", "orange", "时代人物", "战乱、社会生活与诗史", ["li-bai", "guo-ziyi", "yan-zhenqing"]),
      person("wang-wei", "tang-east-asia", "王维", "王", "约699–761", "0699-01-01", "0761-01-01", "blue", "关键人物", "诗画、佛教与官员生活", ["li-bai", "an-lushan"]),
      person("xuanzang", "tang-east-asia", "玄奘", "奘", "约602–664", "0602-01-01", "0664-03-05", "purple", "核心人物", "佛教译经与丝路旅行", ["wu-zetian", "jianzhen"]),
      person("jianzhen", "tang-east-asia", "鉴真", "鉴", "688–763", "0688-01-01", "0763-06-25", "white", "线索人物", "佛教、医学与赴日交流", ["xuanzang", "abe-no-nakamaro"]),
      person("yan-zhenqing", "tang-east-asia", "颜真卿", "颜", "709–785", "0709-01-01", "0785-08-23", "blue", "关键人物", "书法、官员与战争忠诚", ["guo-ziyi", "an-lushan", "du-fu"]),
      person("an-lushan", "tang-east-asia", "安禄山", "安", "约703–757", "0703-01-01", "0757-01-29", "purple", "核心人物", "边镇制度与安史之乱", ["tang-xuanzong", "yang-guifei", "guo-ziyi"]),
      person("guo-ziyi", "tang-east-asia", "郭子仪", "郭", "697–781", "0697-01-01", "0781-07-09", "blue", "关键人物", "平定叛乱与帝国重建", ["yan-zhenqing", "an-lushan", "du-fu"]),
      person("yang-guifei", "tang-east-asia", "杨贵妃", "杨", "719–756", "0719-06-22", "0756-07-15", "white", "线索人物", "宫廷文化与后世叙事", ["tang-xuanzong", "an-lushan"]),
      person("abe-no-nakamaro", "tang-east-asia", "阿倍仲麻吕", "晁", "698–770", "0698-01-01", "0770-01-01", "white", "线索人物", "遣唐使与跨文化生活", ["li-bai", "jianzhen"])
    ]
  },
  {
    id: "renaissance-science",
    title: "欧洲文艺复兴与早期科学革命",
    years: "约1450–1650",
    place: "意大利城邦与欧洲知识网络",
    mark: "艺",
    theme: "renaissance",
    inquiry: "艺术、印刷和观察，怎样共同改变人们理解世界的方式？",
    halls: [
      { id: "renaissance-florence", title: "佛罗伦萨：艺术为何需要赞助人", question: "一件杰作背后有哪些权力、金钱和学习网络？", characterIds: ["leonardo-da-vinci", "michelangelo", "lorenzo-medici", "machiavelli"] },
      { id: "renaissance-rome", title: "罗马工作坊：大师如何竞争", question: "竞争会怎样改变艺术家的作品与地位？", characterIds: ["michelangelo", "raphael", "sofonisba-anguissola"] },
      { id: "renaissance-observation", title: "从日心说到望远镜", question: "新证据如何挑战人们熟悉的宇宙？", characterIds: ["copernicus", "galileo", "johannes-kepler", "andreas-vesalius", "johannes-gutenberg"] }
    ],
    characters: [
      person("leonardo-da-vinci", "renaissance-science", "达·芬奇", "达", "1452–1519", "1452-04-15", "1519-05-02", "gold", "典藏人物", "艺术、工程与观察", ["michelangelo", "isabella-deste", "lorenzo-medici"]),
      person("michelangelo", "renaissance-science", "米开朗琪罗", "米", "1475–1564", "1475-03-06", "1564-02-18", "orange", "时代人物", "雕塑、绘画与教廷委托", ["raphael", "lorenzo-medici", "leonardo-da-vinci"]),
      person("raphael", "renaissance-science", "拉斐尔", "拉", "1483–1520", "1483-01-01", "1520-04-06", "purple", "核心人物", "绘画、建筑与罗马工作坊", ["michelangelo", "leonardo-da-vinci"]),
      person("lorenzo-medici", "renaissance-science", "洛伦佐·德·美第奇", "洛", "1449–1492", "1449-01-01", "1492-04-08", "blue", "关键人物", "城邦政治与艺术赞助", ["michelangelo", "leonardo-da-vinci", "machiavelli"]),
      person("isabella-deste", "renaissance-science", "伊莎贝拉·德斯特", "伊", "1474–1539", "1474-05-18", "1539-02-13", "blue", "关键人物", "女性赞助人、收藏与宫廷文化", ["leonardo-da-vinci", "sofonisba-anguissola"]),
      person("sofonisba-anguissola", "renaissance-science", "索福尼斯巴·安圭索拉", "索", "约1532–1625", "1532-01-01", "1625-11-16", "white", "线索人物", "女性艺术家与宫廷职业", ["michelangelo", "isabella-deste"]),
      person("machiavelli", "renaissance-science", "马基雅维利", "马", "1469–1527", "1469-05-03", "1527-06-21", "purple", "核心人物", "城邦政治、外交与写作", ["lorenzo-medici"]),
      person("johannes-gutenberg", "renaissance-science", "古腾堡", "古", "约1400–1468", "1400-01-01", "1468-02-03", "white", "线索人物", "活字印刷与知识传播", ["copernicus", "andreas-vesalius"]),
      person("copernicus", "renaissance-science", "哥白尼", "哥", "1473–1543", "1473-02-19", "1543-05-24", "purple", "核心人物", "日心说与数学天文学", ["galileo", "johannes-kepler", "johannes-gutenberg"]),
      person("galileo", "renaissance-science", "伽利略", "伽", "1564–1642", "1564-02-15", "1642-01-08", "orange", "时代人物", "观测、实验与科学争议", ["copernicus", "johannes-kepler"]),
      person("johannes-kepler", "renaissance-science", "开普勒", "开", "1571–1630", "1571-12-27", "1630-11-15", "blue", "关键人物", "行星运动与数学模型", ["copernicus", "galileo"]),
      person("andreas-vesalius", "renaissance-science", "维萨里", "维", "1514–1564", "1514-12-31", "1564-10-15", "white", "线索人物", "人体解剖与医学观察", ["johannes-gutenberg", "galileo"])
    ]
  },
  {
    id: "physics-revolution",
    title: "现代物理革命",
    years: "1895–1969",
    place: "欧洲、北美与跨大西洋科学共同体",
    mark: "Q",
    theme: "physics",
    inquiry: "科学家如何重新理解自然，又怎样面对战争与社会责任？",
    halls: [
      { id: "physics-solvay", title: "索尔维会议：自然是概率的吗", question: "科学家为什么会对同一组实验产生不同解释？", characterIds: ["albert-einstein", "niels-bohr", "max-planck", "marie-curie", "werner-heisenberg", "erwin-schrodinger"] },
      { id: "physics-atom", title: "原子内部：理论与实验", question: "一个看不见的原子结构怎样被实验逐步发现？", characterIds: ["ernest-rutherford", "niels-bohr", "marie-curie", "lise-meitner", "chien-shiung-wu"] },
      { id: "physics-responsibility", title: "流亡、战争与科学责任", question: "当科学进入战争，研究者应当承担什么责任？", characterIds: ["albert-einstein", "niels-bohr", "lise-meitner", "robert-oppenheimer"] }
    ],
    characters: [
      person("max-planck", "physics-revolution", "马克斯·普朗克", "P", "1858–1947", "1858-04-23", "1947-10-04", "purple", "核心人物", "量子概念的开端", ["albert-einstein", "niels-bohr"]),
      person("marie-curie", "physics-revolution", "玛丽·居里", "C", "1867–1934", "1867-11-07", "1934-07-04", "orange", "时代人物", "放射性研究与实验科学", ["ernest-rutherford", "albert-einstein"]),
      person("ernest-rutherford", "physics-revolution", "欧内斯特·卢瑟福", "R", "1871–1937", "1871-08-30", "1937-10-19", "blue", "关键人物", "原子核与实验物理", ["niels-bohr", "marie-curie"]),
      person("albert-einstein", "physics-revolution", "阿尔伯特·爱因斯坦", "E", "1879–1955", "1879-03-14", "1955-04-18", "gold", "典藏人物", "相对论、量子与公共责任", ["niels-bohr", "max-planck", "robert-oppenheimer"]),
      person("niels-bohr", "physics-revolution", "尼尔斯·玻尔", "B", "1885–1962", "1885-10-07", "1962-11-18", "orange", "时代人物", "原子模型与量子解释", ["albert-einstein", "werner-heisenberg", "ernest-rutherford"]),
      person("lise-meitner", "physics-revolution", "莉泽·迈特纳", "M", "1878–1968", "1878-11-07", "1968-10-27", "blue", "关键人物", "核物理、流亡与科学伦理", ["marie-curie", "robert-oppenheimer"]),
      person("erwin-schrodinger", "physics-revolution", "埃尔温·薛定谔", "S", "1887–1961", "1887-08-12", "1961-01-04", "blue", "关键人物", "波动力学与思想实验", ["werner-heisenberg", "niels-bohr"]),
      person("werner-heisenberg", "physics-revolution", "沃纳·海森堡", "H", "1901–1976", "1901-12-05", "1976-02-01", "purple", "核心人物", "矩阵力学与不确定性", ["niels-bohr", "erwin-schrodinger", "wolfgang-pauli"]),
      person("wolfgang-pauli", "physics-revolution", "沃尔夫冈·泡利", "Pa", "1900–1958", "1900-04-25", "1958-12-15", "white", "线索人物", "量子理论与同行批评", ["niels-bohr", "werner-heisenberg"]),
      person("paul-dirac", "physics-revolution", "保罗·狄拉克", "D", "1902–1984", "1902-08-08", "1984-10-20", "white", "线索人物", "相对论量子力学", ["niels-bohr", "werner-heisenberg"]),
      person("robert-oppenheimer", "physics-revolution", "罗伯特·奥本海默", "O", "1904–1967", "1904-04-22", "1967-02-18", "purple", "核心人物", "理论物理、战争与责任", ["albert-einstein", "niels-bohr", "lise-meitner"]),
      person("chien-shiung-wu", "physics-revolution", "吴健雄", "W", "1912–1997", "1912-05-31", "1997-02-16", "white", "线索人物", "实验物理与宇称不守恒验证", ["ernest-rutherford", "lise-meitner"])
    ]
  }
];

export const catalogCharacters = historicalPeriods.flatMap(period => period.characters);
export const catalogCharacterById = (id: string) => catalogCharacters.find(character => character.id === id);
export const historicalPeriodById = (id: string) => historicalPeriods.find(period => period.id === id);
