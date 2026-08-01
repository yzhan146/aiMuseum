import { publishedExhibitPackByHallId } from "@ai-museum/characters";
import type { Citation, MuseumObject } from "@ai-museum/sdk";
import { configuredDialogueGenerator } from "./model-provider";
import { getPublishedPack } from "./repository";
import { runDialogue, type MuseumGuideContext } from "./runtime";

export type HallGuideHistoryItem = {
  role: "visitor" | "guide";
  content: string;
};

export type HallGuideInput = {
  hallId: string;
  characterId: string;
  stationId: string;
  objectId?: string;
  message: string;
  ageBand?: string;
  history?: HallGuideHistoryItem[];
  routeReminderUsed?: boolean;
};

export type HallGuideResult = {
  answer: string;
  action: "stay" | "dismiss" | "switch";
  nextCharacterId?: string;
  citations: Citation[];
  mode: "rules" | "local-model" | "cloud-model";
  routeReminderUsed: boolean;
};

const dismissPattern = /(?:我想|让我|我先|想要)?(?:自己|一个人)(?:慢慢)?(?:看|看看|逛|参观)|(?:不用|不需要|别|停止|取消)(?:你)?(?:讲解|导览|陪|跟着)|你(?:先)?去忙|先别讲/i;
const switchPattern = /(?:换|改|请|找).{0,8}(达[·・]?芬奇|莱昂纳多|米开朗琪罗|拉斐尔|伽利略|开普勒).{0,8}(?:陪|讲|导览|来|吧)?/i;

const guideNames: Record<string, string> = {
  "leonardo-da-vinci": "达·芬奇",
  michelangelo: "米开朗琪罗",
  raphael: "拉斐尔",
  galileo: "伽利略",
  "johannes-kepler": "开普勒",
};

function guideName(id: string) {
  return guideNames[id] ?? id;
}

function targetGuide(message: string, available: string[], current: string) {
  if (!switchPattern.test(message)) return undefined;
  const aliases: Array<[RegExp, string]> = [
    [/米开朗琪罗/i, "michelangelo"],
    [/达[·・]?芬奇|莱昂纳多/i, "leonardo-da-vinci"],
    [/拉斐尔/i, "raphael"],
    [/伽利略/i, "galileo"],
    [/开普勒/i, "johannes-kepler"],
  ];
  for (const [pattern, id] of aliases) {
    if (pattern.test(message)) return available.includes(id) && current !== id ? id : undefined;
  }
  return undefined;
}

function objectCitations(object: MuseumObject, sources: Array<{ id: string; title: string; note: string; url?: string }>): Citation[] {
  return sources
    .filter((source) => object.sourceIds.includes(source.id))
    .map((source) => ({ sourceId: source.id, title: source.title, locator: source.note, url: source.url }));
}

function factLabel(status?: MuseumObject["factStatus"]) {
  if (status === "disputed") return "这里仍有不确定性";
  if (status === "interpretation") return "这是当前研究判断";
  return "馆藏资料能够明确说明";
}

function rulesAnswer(characterId: string, object: MuseumObject) {
  const voices: Record<string, { lead: string; perspective: string }> = {
    michelangelo: { lead: "先看材料和人的选择。", perspective: "若由我来看，重要的不只是成品，而是限制、劳动和决定怎样一起留下痕迹。" },
    "leonardo-da-vinci": { lead: "先把观察和结论分开。", perspective: "若由我来看，可以把它当成一次仍在眼前发生的试验。" },
    raphael: { lead: "先看构图怎样让许多人读懂同一个方案。", perspective: "若由我来看，大作品既要有判断，也要让协作者知道下一步怎样做。" },
    galileo: { lead: "先说清楚我们真正看见了什么，再讨论它说明什么。", perspective: "若由我来看，一次惊奇还不够；记录、比较和重复，才让现象成为证据。" },
    "johannes-kepler": { lead: "先让数据开口，不要急着替漂亮的理论辩护。", perspective: "若由我来看，持续出现的微小偏差，往往比整齐的答案更值得相信。" },
  };
  const voice = voices[characterId] ?? voices["leonardo-da-vinci"];
  const lead = `${voice.lead}${factLabel(object.factStatus)}：${object.description}`;
  const perspective = `${voice.perspective}${object.significance}`;
  const observation = object.observationPrompt ? `你可以先不急着赞美，试着这样看：${object.observationPrompt}` : "你可以先说说第一眼注意到了哪里。";
  return `${lead}\n\n${perspective}\n\n${observation}`;
}

function appearsOffRoute(message: string, object: MuseumObject, stationTitle: string) {
  const normalized = message.replace(/\s/g, "");
  if (/(这|画|作品|展品|雕像|门|材料|委托|工坊|作者|年代|构图|人物|颜色|仪器|望远镜|星|宇宙|轨道|数据|观察|证据|印刷|为什么|怎么看)/.test(normalized)) return false;
  const terms = [object.name, object.creatorLabel, stationTitle]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(/[《》·・：:，,\s]+/))
    .filter((value) => value.length >= 2);
  return !terms.some((term) => normalized.includes(term));
}

export async function answerHallGuide(input: HallGuideInput): Promise<HallGuideResult> {
  const message = input.message.trim();
  if (!message || message.length > 600) throw new Error("问题应为 1—600 个字符");

  const exhibit = publishedExhibitPackByHallId(input.hallId);
  if (!exhibit?.hall.experience) throw new Error("这个展厅尚未开放人物导览");
  const availableGuides = exhibit.hall.experience.guideCharacterIds;
  if (!availableGuides.includes(input.characterId)) throw new Error("这位人物不在当前展厅的导览名单中");

  const station = exhibit.hall.stations.find((item) => item.id === input.stationId);
  if (!station) throw new Error("当前展厅位置无效");
  const object = input.objectId
    ? exhibit.objects.find((item) => item.id === input.objectId && station.objectIds.includes(item.id))
    : exhibit.objects.find((item) => station.objectIds.includes(item.id));
  if (!object) throw new Error("当前展品无效");

  const citations = objectCitations(object, exhibit.sources);
  if (dismissPattern.test(message)) {
    return {
      answer: "好，你自己慢慢看。我不会再主动打断；想继续时，再叫我就好。",
      action: "dismiss",
      citations: [],
      mode: "rules",
      routeReminderUsed: Boolean(input.routeReminderUsed),
    };
  }

  const nextCharacterId = targetGuide(message, availableGuides, input.characterId);
  if (nextCharacterId) {
    return {
      answer: `当然。路线和展品都不会改变，接下来请${guideName(nextCharacterId)}陪你看。`,
      action: "switch",
      nextCharacterId,
      citations: [],
      mode: "rules",
      routeReminderUsed: Boolean(input.routeReminderUsed),
    };
  }

  const character = getPublishedPack(input.characterId);
  if (!character) throw new Error("人物资料尚未发布");
  const history = (input.history ?? [])
    .filter((item) => (item.role === "visitor" || item.role === "guide") && typeof item.content === "string")
    .slice(-6)
    .map((item) => ({ role: item.role, content: item.content.slice(0, 600) }));
  const nearbyObjects = station.objectIds
    .map((id) => exhibit.objects.find((item) => item.id === id))
    .filter((item): item is MuseumObject => Boolean(item))
    .map((item) => ({ name: item.name, shortLabel: item.shortLabel }));
  const nextStation = exhibit.hall.stations.find((item) => item.order === station.order + 1);
  const museumGuide: MuseumGuideContext = {
    hallTitle: exhibit.hall.title,
    hallQuestion: exhibit.hall.question,
    stationTitle: station.title,
    stationBody: station.body,
    stationQuestion: station.question,
    currentObject: {
      name: object.name,
      creatorLabel: object.creatorLabel,
      dateLabel: object.dateLabel,
      placeLabel: object.placeLabel,
      description: object.description,
      significance: object.significance,
      factStatus: object.factStatus,
      observationPrompt: object.observationPrompt,
    },
    nearbyObjects,
    nextStationTitle: nextStation?.title,
    routeReminderUsed: Boolean(input.routeReminderUsed),
    history,
  };

  const generator = configuredDialogueGenerator();
  const offRoute = appearsOffRoute(message, object, station.title);
  const routeReminderUsed = Boolean(input.routeReminderUsed) || offRoute;
  if (generator.mode === "rules") {
    return { answer: rulesAnswer(input.characterId, object), action: "stay", citations, mode: "rules", routeReminderUsed };
  }

  let result;
  try {
    result = await runDialogue(character, {
      characterId: character.manifest.id,
      version: character.manifest.version,
      ageBand: input.ageBand ?? "13-15",
      locale: "zh-CN",
      message,
      sessionId: `hall:${exhibit.hall.id}:${station.id}`,
    }, generator, { museumGuide });
  } catch {
    return {
      answer: rulesAnswer(input.characterId, object),
      action: "stay",
      citations,
      mode: "rules",
      routeReminderUsed,
    };
  }

  const answerCitations = result.boundary || offRoute ? result.citations : [...result.citations, ...citations];

  return {
    answer: result.answer,
    action: "stay",
    citations: answerCitations.filter((citation, index, all) => all.findIndex((item) => item.sourceId === citation.sourceId && item.locator === citation.locator) === index),
    mode: result.mode ?? generator.mode,
    routeReminderUsed,
  };
}
