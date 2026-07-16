import { characterPackSchema, type CharacterPack } from "./schema.js";
export const parseCharacterPack = (input: unknown): CharacterPack => characterPackSchema.parse(input);
export function activeClaims(pack: CharacterPack) {
  const active = new Set(pack.sources.filter(s => !s.revokedAt).map(s => s.id));
  return pack.claims.filter(c => c.approved && c.evidence.some(e => active.has(e.sourceId)));
}
export function publicClaims(pack: CharacterPack) { return pack.manifest.status === "published" ? activeClaims(pack) : []; }
export function toJsonLd(pack: CharacterPack) {
  const claims = activeClaims(pack);
  return { "@context": { name: "https://schema.org/name", citation: "https://schema.org/citation" }, "@graph": pack.entities.map(entity => ({ "@id": `urn:ai-museum:${pack.manifest.id}:${pack.manifest.version}:${entity.id}`, "@type": entity.type, name: entity.names, claims: claims.filter(c => c.subjectId === entity.id).map(c => ({ id: c.id, predicate: c.predicate, object: c.objectId ?? c.value, citation: c.evidence })) })) };
}
export function nextPatchVersion(version: string) { const [major, minor, patch] = version.split(".").map(Number); return `${major}.${minor}.${patch + 1}`; }
