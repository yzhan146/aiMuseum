import { z } from "zod";

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const exhibitAssetSchema = z.object({
  id: z.string().min(1),
  path: z.string().regex(/^\/[a-zA-Z0-9/_.-]+\.(?:avif|webp|png|jpe?g)$/),
  contentType: z.enum(["image/avif", "image/webp", "image/png", "image/jpeg"]),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  representation: z.enum([
    "artifact_photo",
    "historical_image",
    "evidence_based_reconstruction",
    "structural_diagram",
    "decorative_illustration",
  ]),
  sourceIds: z.array(z.string()).default([]),
  alt: z.string().max(180),
  licenseCode: z.string().min(1),
});

export const museumObjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["artifact", "document", "artwork", "instrument", "map", "reconstruction"]),
  dateLabel: z.string().min(1),
  placeLabel: z.string().optional(),
  shortLabel: z.string().min(1).max(80),
  description: z.string().min(1).max(500),
  significance: z.string().min(1).max(500),
  visualDescription: z.string().min(1).max(500),
  representation: exhibitAssetSchema.shape.representation,
  sourceIds: z.array(z.string()).min(1),
  relatedCharacterIds: z.array(z.string()).min(1),
  status: z.literal("published"),
  assetId: z.string().min(1).optional(),
  creatorLabel: z.string().min(1).max(120).optional(),
  factStatus: z.enum(["established", "interpretation", "disputed"]).optional(),
  observationPrompt: z.string().min(1).max(240).optional(),
  licenseNote: z.string().min(1).max(300).optional(),
});

export const hallStationSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().min(1).max(8),
  type: z.enum(["orientation", "object", "character_relation", "reflection", "gallery"]),
  title: z.string().min(1).max(50),
  body: z.string().min(1).max(240),
  objectIds: z.array(z.string()).default([]),
  characterIds: z.array(z.string()).default([]),
  question: z.string().min(1).max(160).optional(),
  transition: z.string().min(1).max(200).optional(),
});

export const hallSceneManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  periodId: z.string().regex(/^[a-z0-9-]+$/),
  sceneVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  locale: z.literal("zh-CN"),
  title: z.string().min(1),
  question: z.string().min(1),
  guideTitle: z.string().min(1),
  guideText: z.string().min(1),
  contentWarning: z.object({ label: z.string(), description: z.string(), severity: z.enum(["notice", "sensitive"]) }).optional(),
  theme: z.object({
    themeKey: z.string().min(1),
    tokens: z.object({
      bgDeep: hexColorSchema,
      bgSoft: hexColorSchema,
      surface: hexColorSchema,
      ink: hexColorSchema,
      accent: hexColorSchema,
      highlight: hexColorSchema,
    }),
    lightAssetId: z.string().min(1),
    archiveAssetId: z.string().min(1),
  }),
  entrance: z.object({
    kicker: z.string().min(1),
    primaryActionLabel: z.string().min(1),
    anchorObjectId: z.string().min(1),
  }),
  stations: z.array(hallStationSchema).length(4),
  characterRefs: z.array(z.object({ id: z.string().min(1), relationshipLabel: z.string().min(1) })).min(1),
  exit: z.object({ reflectionQuestion: z.string().min(1), nextHallId: z.string().optional() }),
  experience: z.object({
    kind: z.literal("guided_gallery"),
    quickMinutes: z.number().int().min(1).max(10),
    recommendedMinutes: z.number().int().min(3).max(30),
    guideCharacterIds: z.array(z.string().min(1)).min(1).max(4),
    midpointStationId: z.string().min(1),
  }).optional(),
});

export const exhibitPackSchema = z.object({
  manifest: z.object({
    schemaVersion: z.literal("1.0"),
    id: z.string().regex(/^[a-z0-9-]+$/),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    status: z.literal("published"),
    author: z.object({ id: z.string(), name: z.string() }),
    licenseCode: z.string().min(1),
    publishedAt: z.string().datetime(),
  }),
  hall: hallSceneManifestSchema,
  objects: z.array(museumObjectSchema).min(1),
  assets: z.array(exhibitAssetSchema).min(1),
  sources: z.array(z.object({ id: z.string(), title: z.string(), note: z.string(), url: z.string().url().optional() })).min(1),
}).superRefine((pack, ctx) => {
  const objectIds = new Set(pack.objects.map((item) => item.id));
  const assetIds = new Set(pack.assets.map((item) => item.id));
  const sourceIds = new Set(pack.sources.map((item) => item.id));
  if (!objectIds.has(pack.hall.entrance.anchorObjectId)) ctx.addIssue({ code: "custom", message: "Unknown anchor object" });
  for (const assetId of [pack.hall.theme.lightAssetId, pack.hall.theme.archiveAssetId]) {
    if (!assetIds.has(assetId)) ctx.addIssue({ code: "custom", message: `Unknown scene asset ${assetId}` });
  }
  const stationTypes = new Set(pack.hall.stations.map((station) => station.type));
  if (!pack.hall.experience) {
    for (const type of ["orientation", "object", "character_relation", "reflection"]) {
      if (!stationTypes.has(type as never)) ctx.addIssue({ code: "custom", message: `Missing ${type} station` });
    }
  }
  for (const station of pack.hall.stations) {
    for (const objectId of station.objectIds) if (!objectIds.has(objectId)) ctx.addIssue({ code: "custom", message: `Unknown station object ${objectId}` });
    if (pack.hall.experience && !station.objectIds.length) ctx.addIssue({ code: "custom", message: `Guided gallery station ${station.id} needs an object` });
  }
  for (const object of pack.objects) {
    for (const sourceId of object.sourceIds) if (!sourceIds.has(sourceId)) ctx.addIssue({ code: "custom", message: `Unknown object source ${sourceId}` });
    if (object.assetId && !assetIds.has(object.assetId)) ctx.addIssue({ code: "custom", message: `Unknown object asset ${object.assetId}` });
  }
  if (pack.hall.experience) {
    const stationIds = new Set(pack.hall.stations.map((station) => station.id));
    const characterIds = new Set(pack.hall.characterRefs.map((character) => character.id));
    if (!stationIds.has(pack.hall.experience.midpointStationId)) ctx.addIssue({ code: "custom", message: "Unknown guided gallery midpoint station" });
    for (const guideId of pack.hall.experience.guideCharacterIds) if (!characterIds.has(guideId)) ctx.addIssue({ code: "custom", message: `Unknown guide character ${guideId}` });
    for (const objectId of objectIds) if (!pack.hall.stations.some((station) => station.objectIds.includes(objectId))) ctx.addIssue({ code: "custom", message: `Guided gallery object ${objectId} is not displayed` });
  }
});

export const hallVisitStateSchema = z.object({
  userId: z.string().min(1),
  hallId: z.string().min(1),
  sceneVersion: z.string(),
  lastStationId: z.string(),
  viewedObjectIds: z.array(z.string()).default([]),
  visitedCharacterIds: z.array(z.string()).default([]),
  completedStationIds: z.array(z.string()).default([]),
  startedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  revision: z.number().int().nonnegative(),
});

export type ExhibitAsset = z.infer<typeof exhibitAssetSchema>;
export type MuseumObject = z.infer<typeof museumObjectSchema>;
export type HallStation = z.infer<typeof hallStationSchema>;
export type HallSceneManifest = z.infer<typeof hallSceneManifestSchema>;
export type ExhibitPack = z.infer<typeof exhibitPackSchema>;
export type HallVisitState = z.infer<typeof hallVisitStateSchema>;
