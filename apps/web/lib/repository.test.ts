import { beforeEach, describe, expect, it } from "vitest";
import { createDraft, forkPack, getPack, saveNewVersion, store } from "./repository";
beforeEach(() => { for (const key of [...store.packs.keys()]) if (!['albert-einstein','marie-curie','niels-bohr','max-planck','charlie-chaplin'].includes(key)) store.packs.delete(key); });
describe("version governance", () => {
  it("does not overwrite an existing version", () => { const pack = getPack('albert-einstein')!; expect(() => saveNewVersion(structuredClone(pack))).toThrow(/版本已存在/); });
  it("forks a published pack without impersonating its author", () => { const fork = forkPack('albert-einstein','alice','Alice'); expect(fork.manifest.author.id).toBe('alice'); expect(fork.manifest.forkedFrom?.authorId).toBe('ai-museum'); expect(fork.manifest.status).toBe('draft'); });
  it("rejects living public characters", () => expect(() => createDraft({ id:'living', name:'在世', bornAt:'2000-01-01', diedAt:'2999-01-01' })).toThrow(/已故/));
});
