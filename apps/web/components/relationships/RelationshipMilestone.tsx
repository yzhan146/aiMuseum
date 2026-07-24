import type { PendingRelationshipTransition } from "@ai-museum/sdk";
import type { CSSProperties } from "react";
import { getRelationshipStagePresentation } from "@/lib/relationship-ui";
import styles from "./relationship.module.css";

type Props = {
  characterName: string;
  transition: PendingRelationshipTransition;
  className?: string;
};

export function RelationshipMilestone({ characterName, transition, className }: Props) {
  const from = getRelationshipStagePresentation(transition.fromStage);
  const to = getRelationshipStagePresentation(transition.toStage);
  const style = {
    "--relationship-fg": to.foreground,
    "--relationship-bg": to.background,
  } as CSSProperties;

  return <article
    className={[styles.milestone, className].filter(Boolean).join(" ")}
    style={style}
    data-transition-id={transition.id}
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <small>你与{characterName}的关系有了变化</small>
    <h3>{from.label} → {to.label}</h3>
    <p>{transition.feedbackText}</p>
  </article>;
}
