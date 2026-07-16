import type { ChatRequest, CharacterPack, Claim } from "@ai-museum/sdk";
import { EvidenceFirstGenerator, type DialogueGenerator, type GeneratedDraft } from "./runtime";

type ChatCompletionResponse = { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };

function completionUrl(base: string) {
  const normalized = base.replace(/\/$/, "");
  return normalized.endsWith("/chat/completions") ? normalized : `${normalized}/chat/completions`;
}

export class OpenAICompatibleDialogueGenerator implements DialogueGenerator {
  constructor(private readonly endpoint: string, private readonly apiKey: string, private readonly model: string) {}

  async generate(pack: CharacterPack, request: ChatRequest, claims: Claim[]): Promise<GeneratedDraft> {
    const evidence = claims.map(claim => ({ id: claim.id, statement: claim.value ?? claim.predicate, status: claim.status, topics: claim.topicIds }));
    const ageRule = pack.persona.ageBands[request.ageBand] ?? pack.persona.ageBands["9-12"];
    const response = await fetch(completionUrl(this.endpoint), {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.35,
        max_tokens: 500,
        messages: [
          { role: "system", content: `你正在进行有史料约束的历史人物教育性角色演绎。只能使用给定史料断言，不得补充模型常识，不得声称知道人物去世后的事。人物语气：${pack.persona.tone.join("、")}。面向${request.ageBand}岁段：${ageRule?.guidance ?? "解释术语并保持简洁"}。最多${ageRule?.maxSentences ?? 5}句。不要输出引用编号，引用由服务端附加。` },
          { role: "user", content: JSON.stringify({ question: request.message, allowedClaims: evidence }) }
        ]
      }),
      signal: AbortSignal.timeout(20_000)
    });
    const body = await response.json() as ChatCompletionResponse;
    if (!response.ok) throw new Error(body.error?.message ?? `模型服务返回 ${response.status}`);
    const answer = body.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("模型服务没有返回可用文本");
    return { answer, claimIds: claims.map(claim => claim.id), mode: "cloud-model" };
  }
}

export function configuredDialogueGenerator(): DialogueGenerator {
  const endpoint = process.env.MODEL_API_URL?.trim();
  const apiKey = process.env.MODEL_API_KEY?.trim();
  const model = process.env.MODEL_NAME?.trim();
  return endpoint && apiKey && model ? new OpenAICompatibleDialogueGenerator(endpoint, apiKey, model) : new EvidenceFirstGenerator();
}
