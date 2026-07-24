import type { CharacterPack, Claim, Entity, SourceRecord } from "./schema.js";
import type { RelationshipPublicState } from "./relationship.js";
export interface CharacterVersion { characterId: string; version: string; status: CharacterPack["manifest"]["status"]; createdAt: string; publishedAt?: string }
export interface ChatRequest { characterId: string; version?: string; ageBand: string; locale: string; message: string; previewToken?: string; sessionId?: string }
export interface Citation { sourceId: string; title: string; locator: string; url?: string }
export interface MemoryCallback { memoryId: string; text: string; confidence: number }
export interface MasteryPrompt { topicId: string; prompt: string; currentLevel: MasteryLevel }
export interface ChatResult { answer: string; classification: string; boundary: boolean; claimIds: string[]; citations: Citation[]; narratorNote?: string; suggestions: string[]; version: string; messageId?: string; threadId?: string; memoryCallbacks?: MemoryCallback[]; masteryPrompt?: MasteryPrompt; mode?: "rules" | "local-model" | "cloud-model"; relationship?: RelationshipPublicState }
export interface ModelProvider { generate(request: ChatRequest, context: { pack: CharacterPack; claims: Claim[]; sources: SourceRecord[] }): Promise<ChatResult> }
export interface EmbeddingProvider { embed(texts: string[]): Promise<number[][]> }
export interface TranscriptionProvider { transcribe(input: Uint8Array, mimeType: string): Promise<{ text: string; segments: Array<{ start: number; end: number; text: string }> }> }
export interface MediaProcessor { supports(mimeType: string): boolean; extract(input: Uint8Array, mimeType: string): Promise<Array<{ kind: string; content: string; locator: string }>> }
export interface ObjectStorage { put(key: string, value: Uint8Array, contentType: string): Promise<void>; get(key: string): Promise<Uint8Array | null>; delete(key: string): Promise<void> }
export interface GraphRepository { getPack(id: string, version?: string): Promise<CharacterPack | null>; saveDraft(pack: CharacterPack): Promise<void>; publish(id: string, version: string): Promise<CharacterPack>; neighbors(packId: string, version: string, entityId: string, depth?: number): Promise<{ entities: Entity[]; claims: Claim[] }> }
export interface SourceAsset { id: string; characterId: string; version: string; kind: "file" | "link"; name: string; mimeType?: string; url?: string; storageKey?: string; checksum?: string; license: SourceRecord["license"]; status: "uploaded" | "processing" | "review" | "ready" | "rejected" | "revoked"; createdAt: string }
export interface CandidateClaim extends Omit<Claim, "approved"> { assetId: string; reviewStatus: "pending" | "accepted" | "rejected"; approved: false; extractionNotes?: string; revision: number }
export interface IngestionJob { id: string; assetId: string; idempotencyKey: string; status: "queued" | "running" | "review" | "failed" | "completed"; progress: number; attempt: number; candidateClaimIds: string[]; error?: string }

export type MessageRole = "user" | "character" | "guide" | "system";
export interface ThreadEpoch { id: string; threadId: string; characterVersion: string; startedAt: string; endedAt?: string }
export interface ConversationThread { id: string; userId: string; characterId: string; currentEpochId: string; characterVersion: string; title: string; summary?: string; lastMessageAt?: string; createdAt: string; updatedAt: string }
export interface ConversationMessage { id: string; threadId: string; epochId: string; role: MessageRole; content: string; characterVersion: string; claimIds: string[]; citations: Citation[]; createdAt: string }
export type MemoryType = "explicit_profile" | "character_relationship" | "preference" | "open_loop" | "learning_exposure" | "learning_evidence" | "episode_summary";
export type MemoryStatus = "pending_confirmation" | "active" | "suppressed" | "forgotten";
export interface MemoryRecord { id: string; userId: string; characterId?: string; type: MemoryType; content: string; sourceMessageIds: string[]; confidence: number; importance: number; sensitivity: "low" | "sensitive"; status: MemoryStatus; lastRecalledAt?: string; recallCount: number; createdAt: string; updatedAt: string }
export type MasteryLevel = "new" | "exposed" | "practicing" | "mastered" | "decayed";
export interface MasteryRecord { id: string; userId: string; topicId: string; level: MasteryLevel; confidence: number; evidenceMessageIds: string[]; lastPracticedAt: string; updatedAt: string }

export type AgentTaskType = "guide" | "media" | "knowledge" | "evaluation";
export type AgentTaskStatus = "queued" | "planning" | "running" | "waiting_review" | "completed" | "failed" | "cancelled";
export interface AgentStep { id: string; name: string; status: "pending" | "running" | "completed" | "failed"; tool?: string; startedAt?: string; completedAt?: string; detail?: string }
export interface AgentArtifact { id: string; taskId: string; kind: "learning-plan" | "image" | "video" | "knowledge-report" | "evaluation-report"; name: string; contentType: string; data?: unknown; storageKey?: string; createdAt: string }
export interface AgentTask { id: string; type: AgentTaskType; status: AgentTaskStatus; input: Record<string, unknown>; plan: AgentStep[]; currentStep: number; artifactIds: string[]; provider: string; model: string; attempt: number; createdBy: string; consentId?: string; errorCode?: string; resumeToken: string; createdAt: string; updatedAt: string }
export interface AgentModelProvider { readonly id: string; readonly mode: "rules" | "local-model" | "cloud-model"; plan(task: AgentTask): Promise<AgentStep[]>; generate(input: { system: string; context: unknown; prompt: string }): Promise<{ text: string; usage?: { inputTokens: number; outputTokens: number } }> }
export interface ImageGenerationProvider { readonly id: string; generate(input: { prompt: string; referenceKeys: string[] }): Promise<{ bytes: Uint8Array; contentType: string }> }
export interface VideoGenerationProvider { readonly id: string; generate(input: { storyboard: unknown; referenceKeys: string[] }): Promise<{ jobId: string }> }
export interface SpeechProvider { readonly id: string; synthesize(input: { text: string; voiceId: string; consentId: string }): Promise<{ bytes: Uint8Array; contentType: string }> }
