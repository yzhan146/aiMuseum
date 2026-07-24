function configuredCanaryCharacters(env: NodeJS.ProcessEnv) {
  const raw = env.RELATIONSHIP_CANARY_CHARACTER_IDS;
  if (!raw?.trim()) return new Set<string>();
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function relationshipAutomationEnabledForCharacter(
  characterId: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const configured = configuredCanaryCharacters(env);
  if (
    env.NODE_ENV === "production" &&
    (env.RELATIONSHIP_EVIDENCE_EXTRACTOR !== "model" ||
      !env.MODEL_API_URL?.trim() ||
      !env.MODEL_API_KEY?.trim() ||
      !env.MODEL_NAME?.trim())
  )
    return false;
  if (configured.size > 0) return configured.has(characterId);
  return env.NODE_ENV !== "production";
}
