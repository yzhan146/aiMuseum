import { z } from "zod";

export const relationshipStages = [
  "initial",
  "acquainted",
  "young_friend",
  "old_friend",
  "kindred_spirit",
] as const;

export const relationshipStageSchema = z.enum(relationshipStages);
export type RelationshipStage = z.infer<typeof relationshipStageSchema>;

export const relationshipStatusSchema = z.enum(["active", "paused"]);
export type RelationshipStatus = z.infer<typeof relationshipStatusSchema>;

export const relationshipDimensionSchema = z.enum([
  "continuity",
  "exploration_depth",
  "demonstrated_understanding",
  "reciprocal_context",
  "independent_perspective",
]);
export type RelationshipDimension = z.infer<
  typeof relationshipDimensionSchema
>;

export const relationshipEvidenceTypeSchema = z.enum([
  "substantive_question",
  "historical_connection",
  "reasoned_agreement",
  "reasoned_disagreement",
  "explanation_or_application",
  "revisited_prior_topic",
  "viewpoint_evolution",
  "responsive_followup",
  "cross_topic_synthesis",
  "historical_relationship_explored",
]);
export type RelationshipEvidenceType = z.infer<
  typeof relationshipEvidenceTypeSchema
>;

export const relationshipEvidenceStatusSchema = z.enum([
  "active",
  "suspended",
  "rejected",
  "revoked",
  "superseded",
]);
export type RelationshipEvidenceStatus = z.infer<
  typeof relationshipEvidenceStatusSchema
>;

export const relationshipSourceDependencySchema = z.enum([
  "primary",
  "required_support",
  "optional_context",
]);
export type RelationshipSourceDependency = z.infer<
  typeof relationshipSourceDependencySchema
>;

export const relationshipEvidenceSourceSchema = z
  .object({
    sourceType: z.enum(["message", "memory", "learning_event"]),
    sourceId: z.string().min(1),
    sourceRole: z.enum([
      "primary_user_message",
      "character_message",
      "memory",
      "learning_event",
    ]),
    dependencyRole: relationshipSourceDependencySchema,
  })
  .strict()
  .superRefine((source, context) => {
    if (
      source.dependencyRole === "primary" &&
      (source.sourceType !== "message" ||
        source.sourceRole !== "primary_user_message")
    ) {
      context.addIssue({
        code: "custom",
        message: "Primary relationship evidence must be a user message",
      });
    }
  });
export type RelationshipEvidenceSource = z.infer<
  typeof relationshipEvidenceSourceSchema
>;

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const relationshipPendingTransitionSchema = z
  .object({
    id: z.string().min(1),
    fromStage: relationshipStageSchema,
    toStage: relationshipStageSchema,
    feedbackText: z.string().min(1),
    createdAt: isoDateTimeSchema,
    afterMessageId: z.string().min(1).optional(),
  })
  .strict();
export type PendingRelationshipTransition = z.infer<
  typeof relationshipPendingTransitionSchema
>;
export type RelationshipPendingTransition = PendingRelationshipTransition;

export const relationshipPublicStateSchema = z
  .object({
    characterId: z.string().min(1),
    stage: relationshipStageSchema,
    status: relationshipStatusSchema,
    stageChangedAt: isoDateTimeSchema.optional(),
    revision: z.number().int().positive(),
    preferredAddress: z
      .object({ value: z.string().min(1), consentVersion: z.number().int().positive() })
      .strict()
      .optional(),
    pendingTransition: relationshipPendingTransitionSchema.optional(),
  })
  .strict();
export type RelationshipPublicState = z.infer<
  typeof relationshipPublicStateSchema
>;
export const publicRelationshipSchema = relationshipPublicStateSchema;
export type PublicRelationship = RelationshipPublicState;

export const relationshipRuntimeContextSchema = z
  .object({
    stage: relationshipStageSchema,
    status: z.literal("active"),
    behaviorContract: z.array(z.string().min(1)).min(1),
    preferredAddress: z
      .object({ value: z.string().min(1), consentVersion: z.number().int().positive() })
      .strict()
      .optional(),
    sharedMoments: z
      .array(
        z
          .object({
            memoryId: z.string().min(1),
            summary: z.string().min(1),
            sourceMessageIds: z.array(z.string().min(1)).min(1),
          })
          .strict(),
      )
      .max(6),
    recurringTopics: z.array(z.string().min(1)).max(3),
    priorViewpoints: z.array(z.string().min(1)).max(2),
  })
  .strict();
export type RelationshipRuntimeContext = z.infer<
  typeof relationshipRuntimeContextSchema
>;

export const relationshipBlockedReasonSchema = z.enum([
  "sensitive_disclosure",
  "repeated_or_low_information",
  "praise_only",
  "direct_stage_request",
  "prompt_injection",
  "invalid_source",
  "low_confidence",
]);
export type RelationshipBlockedReason = z.infer<
  typeof relationshipBlockedReasonSchema
>;

export const relationshipEvidenceCandidateSchema = z
  .object({
    subjectRole: z.literal("user"),
    primaryUserMessageId: z.string().min(1),
    type: relationshipEvidenceTypeSchema,
    topicKey: z.string().min(1).max(120),
    sanitizedSummary: z.string().min(1).max(300),
    stance: z.enum(["agree", "disagree", "mixed", "none"]).optional(),
    substantiveness: z.enum(["low", "medium", "high"]),
    noveltyKey: z.string().min(1).max(200),
    confidence: z.number().min(0).max(1),
    contextMessageIds: z.array(z.string().min(1)).min(1).max(8),
  })
  .strict();
export type RelationshipEvidenceCandidate = z.infer<
  typeof relationshipEvidenceCandidateSchema
>;

export const relationshipEvidenceCandidateOutputSchema = z
  .object({
    schemaVersion: z.literal("relationship-evidence-v1"),
    source: z
      .object({
        threadId: z.string().min(1),
        turnId: z.string().min(1),
        messageIds: z.array(z.string().min(1)).min(1).max(8),
      })
      .strict(),
    candidates: z.array(relationshipEvidenceCandidateSchema).max(8),
    blocked: z
      .array(
        z
          .object({
            primaryUserMessageId: z.string().min(1),
            reason: relationshipBlockedReasonSchema,
          })
          .strict(),
      )
      .max(8),
  })
  .strict();
export type RelationshipEvidenceCandidateOutput = z.infer<
  typeof relationshipEvidenceCandidateOutputSchema
>;
