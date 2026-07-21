export type ClueMessage = {
  id?: string;
  role: "user" | "character";
  content: string;
  citations?: Array<{ sourceId: string; title: string; locator: string }>;
};

export type ClueCharacter = {
  id: string;
  name: string;
  relationCharacterIds: string[];
};

export type ConversationClue = {
  id: string;
  kind: "人物" | "要点" | "史料";
  title: string;
  detail: string;
};

function sentences(content: string) {
  return content
    .replace(/（[^）]{0,100}）/g, "")
    .replace(/\s+/g, " ")
    .match(/[^。！？!?]+[。！？!?]?/g)
    ?.map(item => item.trim())
    .filter(item => item.length >= 6) ?? [];
}

function shorten(content: string, limit = 76) {
  return content.length <= limit ? content : `${content.slice(0, limit - 1)}…`;
}

export function buildConversationClues(selected: ClueCharacter, characters: ClueCharacter[], messages: ClueMessage[]) {
  const clues: ConversationClue[] = [];
  const recentFirst = [...messages].reverse();

  for (const relationId of selected.relationCharacterIds) {
    const relation = characters.find(character => character.id === relationId);
    if (!relation) continue;
    const relatedMessage = recentFirst.find(message => message.content.includes(relation.name));
    if (!relatedMessage) continue;
    const sentence = sentences(relatedMessage.content).find(item => item.includes(relation.name));
    clues.push({
      id: `person:${relation.id}`,
      kind: "人物",
      title: `谈到了${relation.name}`,
      detail: shorten(sentence ?? relatedMessage.content),
    });
    if (clues.filter(clue => clue.kind === "人物").length === 3) break;
  }

  const usedDetails = new Set(clues.map(clue => clue.detail));
  for (const [index, message] of recentFirst.entries()) {
    if (message.role !== "character") continue;
    const detail = sentences(message.content).find(item => !usedDetails.has(shorten(item)));
    if (!detail) continue;
    const shortened = shorten(detail);
    clues.push({ id: `point:${message.id ?? index}`, kind: "要点", title: "人物谈话要点", detail: shortened });
    usedDetails.add(shortened);
    if (clues.filter(clue => clue.kind === "要点").length === 2) break;
  }

  const seenSources = new Set<string>();
  for (const message of recentFirst) {
    for (const citation of message.citations ?? []) {
      const key = `${citation.sourceId}:${citation.locator}`;
      if (seenSources.has(key)) continue;
      clues.push({ id: `source:${key}`, kind: "史料", title: citation.title, detail: shorten(citation.locator) });
      seenSources.add(key);
      if (seenSources.size === 2) break;
    }
    if (seenSources.size === 2) break;
  }

  return clues.slice(0, 7);
}
