import {
  catalogCharacterById,
  catalogCharacters,
  einsteinPack,
  historicalPeriodById,
  historicalPeriods,
  publishedExhibitPackByHallId,
  publishedExhibitPacks,
  supportingPacks,
  type CatalogCharacter,
  type HistoricalPeriod,
} from "@ai-museum/characters";
import type { CharacterPack, ExhibitPack } from "@ai-museum/sdk";

const characterPacks = [einsteinPack, ...supportingPacks];

export function publicCharacterIds() {
  return catalogCharacters.map((character) => character.id);
}
export function publicPeriodIds() {
  return historicalPeriods.map((period) => period.id);
}

export function publicHallIds() {
  return publishedExhibitPacks.map((pack) => pack.hall.id);
}

export function publicCharacter(id: string):
  | { character: CatalogCharacter; period: HistoricalPeriod; pack: CharacterPack }
  | undefined {
  const character = catalogCharacterById(id);
  const period = character ? historicalPeriodById(character.periodId) : undefined;
  const pack = characterPacks.find((item) => item.manifest.id === id);
  return character && period && pack ? { character, period, pack } : undefined;
}

export function publicPeriod(id: string) {
  return historicalPeriodById(id);
}

export function publicHall(id: string):
  | { pack: ExhibitPack; period: HistoricalPeriod; characters: CatalogCharacter[] }
  | undefined {
  const pack = publishedExhibitPackByHallId(id);
  const period = pack ? historicalPeriodById(pack.hall.periodId) : undefined;
  if (!pack || !period) return undefined;
  const characters = pack.hall.characterRefs
    .map((reference) => catalogCharacterById(reference.id))
    .filter((character): character is CatalogCharacter => Boolean(character));
  return { pack, period, characters };
}

export function siteOrigin() {
  const configured = process.env.APP_BASE_URL?.trim();
  if (!configured) return "http://localhost:3000";
  try {
    return new URL(configured).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export function absoluteSiteUrl(pathname: string) {
  return new URL(pathname, `${siteOrigin()}/`).toString();
}
