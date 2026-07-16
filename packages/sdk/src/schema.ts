import { z } from "zod";

export const localeSchema = z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/);
export const permissionSchema = z.enum(["display", "transcode", "training", "voice-synthesis", "likeness-generation", "redistribute"]);
export const licenseSchema = z.object({ code: z.string().min(1), attribution: z.string().optional(), permissions: z.array(permissionSchema).default([]) });
export const sourceSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), creator: z.string().optional(),
  kind: z.enum(["book", "paper", "archive", "web", "image", "audio", "video", "transcript"]),
  url: z.string().url().optional(), publishedAt: z.string().optional(), locale: localeSchema,
  license: licenseSchema, locator: z.string().optional(), excerpt: z.string().max(4000).optional(), checksum: z.string().optional(), revokedAt: z.string().optional()
});
export const mediaSchema = z.object({ id: z.string(), sourceId: z.string(), kind: z.enum(["portrait", "audio", "video", "subtitle", "educational"]), mimeType: z.string(), locator: z.string().optional(), license: licenseSchema });
export const entitySchema = z.object({ id: z.string().min(1), type: z.enum(["person", "organization", "place", "event", "concept", "work", "viewpoint"]), names: z.record(z.string()), summary: z.string().optional(), bornAt: z.string().optional(), diedAt: z.string().optional() });
export const claimStatusSchema = z.enum(["established", "disputed", "self-reported", "later-assessment", "inference"]);
export const claimSchema = z.object({
  id: z.string().min(1), subjectId: z.string().min(1), predicate: z.string().min(1), objectId: z.string().optional(), value: z.string().optional(),
  validFrom: z.string().optional(), validTo: z.string().optional(), status: claimStatusSchema, confidence: z.number().min(0).max(1),
  evidence: z.array(z.object({ sourceId: z.string(), locator: z.string().min(1), excerpt: z.string().max(1000).optional() })).min(1),
  topicIds: z.array(z.string()).default([]), approved: z.boolean(), perspective: z.enum(["character", "museum"]).default("character")
}).refine(v => Boolean(v.objectId || v.value), "Claim requires objectId or value");
export const relationshipSchema = z.object({ id: z.string(), fromId: z.string(), toId: z.string(), type: z.string(), claimIds: z.array(z.string()).min(1) });
export const boundarySchema = z.object({ knowledgeCutoff: z.string(), allowedTopics: z.array(z.string()), limitedTopics: z.array(z.string()), forbiddenTopics: z.array(z.string()), unknownPatterns: z.array(z.string()).default([]), modernKnowledgePolicy: z.enum(["deny", "museum-narrator", "historical-analogy"]) });
export const personaSchema = z.object({
  firstPerson: z.boolean().default(true), languages: z.array(localeSchema).min(1), tone: z.array(z.string()), values: z.array(z.string()),
  ageBands: z.record(z.object({ maxSentences: z.number().int().positive(), vocabulary: z.enum(["simple", "standard", "advanced"]), guidance: z.string() })),
  refusalStyle: z.string(), disclaimer: z.string(), examples: z.array(z.object({ question: z.string(), answer: z.string() })).default([])
});
export const evaluationSchema = z.object({ id: z.string(), prompt: z.string(), expectedClaimIds: z.array(z.string()).default([]), forbiddenAssertions: z.array(z.string()).default([]), expectedBoundary: z.boolean().default(false) });

export const characterPackSchema = z.object({
  manifest: z.object({
    schemaVersion: z.literal("1.0"), compatibleRuntime: z.string().default(">=0.1.0"), id: z.string().regex(/^[a-z0-9-]+$/), version: z.string().regex(/^\d+\.\d+\.\d+$/),
    name: z.record(z.string()), author: z.object({ id: z.string(), name: z.string() }), license: licenseSchema, defaultLocale: localeSchema,
    bornAt: z.string(), diedAt: z.string(), deceasedEvidenceSourceId: z.string(), status: z.enum(["draft", "processing", "review", "submitted", "published", "returned", "archived"]),
    forkedFrom: z.object({ id: z.string(), version: z.string(), authorId: z.string() }).optional(), createdAt: z.string(), publishedAt: z.string().optional()
  }),
  educationalGoal: z.string(), boundaries: boundarySchema, persona: personaSchema, sources: z.array(sourceSchema), media: z.array(mediaSchema).default([]),
  entities: z.array(entitySchema), claims: z.array(claimSchema), relationships: z.array(relationshipSchema), evaluations: z.array(evaluationSchema)
}).superRefine((pack, ctx) => {
  const sources = new Set(pack.sources.map(s => s.id));
  const activeSources = new Set(pack.sources.filter(s => !s.revokedAt).map(s => s.id));
  const entities = new Set(pack.entities.map(e => e.id));
  const claims = new Set(pack.claims.map(c => c.id));
  if (!activeSources.has(pack.manifest.deceasedEvidenceSourceId)) ctx.addIssue({ code: "custom", message: "Missing active deceased evidence source" });
  for (const claim of pack.claims) {
    if (!entities.has(claim.subjectId)) ctx.addIssue({ code: "custom", message: `Unknown claim subject ${claim.subjectId}` });
    if (claim.objectId && !entities.has(claim.objectId)) ctx.addIssue({ code: "custom", message: `Unknown claim object ${claim.objectId}` });
    for (const evidence of claim.evidence) if (!sources.has(evidence.sourceId)) ctx.addIssue({ code: "custom", message: `Unknown source ${evidence.sourceId}` });
  }
  for (const rel of pack.relationships) {
    if (!entities.has(rel.fromId) || !entities.has(rel.toId)) ctx.addIssue({ code: "custom", message: `Invalid relationship ${rel.id}` });
    for (const id of rel.claimIds) if (!claims.has(id)) ctx.addIssue({ code: "custom", message: `Unknown relationship claim ${id}` });
  }
});

export type CharacterPack = z.infer<typeof characterPackSchema>;
export type Claim = z.infer<typeof claimSchema>;
export type SourceRecord = z.infer<typeof sourceSchema>;
export type Entity = z.infer<typeof entitySchema>;
