import { z } from "zod";
import { localeSchema } from "./schema.js";

export const characterIdentityHintSchema = z.object({
  clientRef: z.string().min(1),
  name: z.string().min(1).max(120),
  aliases: z.array(z.string().min(1).max(120)).default([]),
  bornAt: z.string().optional(),
  diedAt: z.string().optional(),
  era: z.string().max(160).optional(),
  countries: z.array(z.string().min(1).max(80)).default([]),
  regions: z.array(z.string().min(1).max(120)).default([]),
  roles: z.array(z.string().min(1).max(120)).default([]),
  context: z.string().max(2_000).optional(),
  evidenceUrls: z.array(z.string().url()).max(20).default([]),
});

export const characterCreationRequestSchema = z
  .object({
    id: z.string().min(1),
    requestedBy: z.string().min(1),
    mode: z.enum(["single", "group"]),
    groupName: z.string().max(160).optional(),
    groupContext: z
      .object({
        era: z.string().max(160).optional(),
        countries: z.array(z.string().min(1).max(80)).default([]),
        regions: z.array(z.string().min(1).max(120)).default([]),
        theme: z.string().max(240).optional(),
        context: z.string().max(2_000).optional(),
      })
      .optional(),
    locale: localeSchema.default("zh-CN"),
    characters: z.array(characterIdentityHintSchema).min(1).max(24),
    enrichment: z.object({
      useModelKnowledge: z.boolean().default(true),
      usePublicWeb: z.boolean().default(true),
      suggestRelationships: z.boolean().default(true),
      generatePortraits: z.boolean().default(true),
    }),
    createdAt: z.string(),
  })
  .superRefine((request, context) => {
    if (request.mode === "single" && request.characters.length !== 1) {
      context.addIssue({ code: "custom", message: "Single mode requires exactly one character" });
    }
    if (request.mode === "group" && request.characters.length < 2) {
      context.addIssue({ code: "custom", message: "Group mode requires at least two characters" });
    }
  });

export const enrichmentSourceSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["creator-input", "public-web", "model-knowledge", "generated-media"]),
  title: z.string().min(1),
  url: z.string().url().optional(),
  locator: z.string().optional(),
  capturedAt: z.string(),
  license: z.string().optional(),
});

export const portraitDraftSchema = z.object({
  style: z.enum(["cartoon", "realistic"]),
  status: z.enum(["missing", "queued", "generated", "confirmed", "rejected"]),
  assetKey: z.string().optional(),
  prompt: z.string().optional(),
  provider: z.string().optional(),
  sourceIds: z.array(z.string()).default([]),
  rights: z.array(z.enum(["display", "redistribute", "likeness-generation"])).default([]),
});

export const relationshipCandidateSchema = z.object({
  id: z.string().min(1),
  targetCharacterId: z.string().optional(),
  targetName: z.string().min(1),
  type: z.string().min(1),
  summary: z.string().min(1),
  status: z.enum(["suggested", "confirmed", "rejected"]),
  confidence: z.number().min(0).max(1),
  provenance: z.enum(["creator-input", "public-source", "model-suggested"]),
  sourceIds: z.array(z.string()).default([]),
});

export const characterDraftObjectSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  clientRef: z.string().min(1),
  status: z.enum([
    "requested",
    "needs_disambiguation",
    "enriching",
    "ready_for_review",
    "confirmation_sent",
    "confirmed",
    "failed",
    "cancelled",
  ]),
  identity: characterIdentityHintSchema.extend({
    canonicalName: z.record(z.string()),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    duplicateCandidateIds: z.array(z.string()).default([]),
  }),
  profile: z.object({
    overview: z.string().default(""),
    biography: z.array(z.string()).default([]),
    influence: z.string().default(""),
    legacy: z.string().default(""),
    works: z.array(z.string()).default([]),
    quotations: z.array(z.object({ text: z.string(), sourceId: z.string().optional() })).default([]),
    educationalThemes: z.array(z.string()).default([]),
  }),
  portraits: z.object({
    cartoon: portraitDraftSchema,
    realistic: portraitDraftSchema,
  }),
  relationships: z.array(relationshipCandidateSchema).default([]),
  sources: z.array(enrichmentSourceSchema).default([]),
  completeness: z.object({
    score: z.number().min(0).max(1),
    missingFields: z.array(z.string()).default([]),
    blockingIssues: z.array(z.string()).default([]),
  }),
  revision: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const characterConfirmationSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  recipientEmail: z.string().email(),
  status: z.enum(["pending", "sent", "confirmed", "expired", "cancelled"]),
  tokenHash: z.string().min(1),
  expiresAt: z.string(),
  sentAt: z.string().optional(),
  confirmedAt: z.string().optional(),
});

export const characterCreationProjectSchema = z.object({
  id: z.string().min(1),
  requestedBy: z.string().min(1),
  mode: z.enum(["single", "group"]),
  groupName: z.string().optional(),
  status: z.enum([
    "draft",
    "needs_disambiguation",
    "ready_to_start",
    "enriching",
    "ready_for_review",
    "confirmation_sent",
    "confirmed",
    "partially_failed",
    "failed",
    "cancelled",
  ]),
  characterDraftIds: z.array(z.string()).min(1).max(24),
  agentTaskIds: z.array(z.string()).default([]),
  confirmationId: z.string().optional(),
  progress: z.object({
    completed: z.number().int().nonnegative(),
    total: z.number().int().positive(),
    currentStage: z.enum(["identity", "profile", "portraits", "relationships", "completeness", "review"]),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CharacterIdentityHint = z.infer<typeof characterIdentityHintSchema>;
export type CharacterCreationRequest = z.infer<typeof characterCreationRequestSchema>;
export type CharacterDraftObject = z.infer<typeof characterDraftObjectSchema>;
export type CharacterConfirmation = z.infer<typeof characterConfirmationSchema>;
export type CharacterCreationProject = z.infer<typeof characterCreationProjectSchema>;
