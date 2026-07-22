import { describe, expect, it } from "vitest";
import { characterCreationProjectSchema, characterCreationRequestSchema } from "./creator.js";

const request = {
  id: "project-1",
  requestedBy: "account:creator",
  mode: "single",
  locale: "zh-CN",
  characters: [{ clientRef: "row-1", name: "李白" }],
  enrichment: {
    useModelKnowledge: true,
    usePublicWeb: true,
    suggestRelationships: true,
    generatePortraits: true,
  },
  createdAt: new Date(0).toISOString(),
};

describe("maintainer character creation request", () => {
  it("accepts one character with only a name and optional disambiguation hints", () => {
    const parsed = characterCreationRequestSchema.parse(request);
    expect(parsed.characters[0]).toMatchObject({ name: "李白", countries: [] });
  });

  it("keeps single and group requests structurally distinct", () => {
    expect(
      characterCreationRequestSchema.safeParse({
        ...request,
        mode: "group",
      }).success,
    ).toBe(false);
    expect(
      characterCreationRequestSchema.safeParse({
        ...request,
        mode: "group",
        groupName: "唐代诗人",
        characters: [
          request.characters[0],
          { clientRef: "row-2", name: "杜甫" },
        ],
      }).success,
    ).toBe(true);
  });

  it("tracks a resumable group project separately from its character drafts", () => {
    const parsed = characterCreationProjectSchema.parse({
      id: "project-1",
      requestedBy: "account:creator",
      mode: "group",
      groupName: "唐代诗人",
      status: "enriching",
      characterDraftIds: ["draft-li-bai", "draft-du-fu"],
      agentTaskIds: ["task-identity", "task-profile"],
      progress: { completed: 1, total: 2, currentStage: "profile" },
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(1).toISOString(),
    });

    expect(parsed.characterDraftIds).toHaveLength(2);
    expect(parsed.status).toBe("enriching");
  });
});
