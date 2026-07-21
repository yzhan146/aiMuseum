export type ClueMessage = {
  id?: string;
  role: "user" | "character";
  content: string;
  citations?: Array<{ sourceId: string; title: string; locator: string }>;
};

export type ClueCharacter = {
  id: string;
  name: string;
  exhibit: {
    discoveries: Array<{ id: string; kind: string; title: string; content: string; keywords: string[] }>;
  };
};

export type ConversationClue = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  verified: boolean;
};

function shorten(content: string, limit = 90) {
  return content.length <= limit ? content : `${content.slice(0, limit - 1)}…`;
}

export function buildConversationClues(selected: ClueCharacter, messages: ClueMessage[]) {
  const dialogue = messages.map(message => message.content).join("\n").toLocaleLowerCase("zh-CN");
  const discoveries: ConversationClue[] = selected.exhibit.discoveries
    .filter(item => item.keywords.some(keyword => dialogue.includes(keyword.toLocaleLowerCase("zh-CN"))))
    .map(item => ({ id: `discovery:${item.id}`, kind: item.kind, title: item.title, detail: item.content, verified: true }));

  const seenSources = new Set<string>();
  const sources: ConversationClue[] = [];
  for (const message of [...messages].reverse()) {
    for (const citation of message.citations ?? []) {
      const key = `${citation.sourceId}:${citation.locator}`;
      if (seenSources.has(key)) continue;
      sources.push({ id: `source:${key}`, kind: "史料", title: citation.title, detail: shorten(citation.locator), verified: true });
      seenSources.add(key);
      if (seenSources.size === 2) break;
    }
    if (seenSources.size === 2) break;
  }

  return [...discoveries, ...sources].slice(0, 7);
}
