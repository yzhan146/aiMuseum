"use client";

import type { RelationshipPublicState, RelationshipStage } from "@ai-museum/sdk";
import type { CSSProperties } from "react";
import { getRelationshipStagePresentation } from "@/lib/relationship-ui";
import styles from "./relationship.module.css";

type Props = {
  characterName: string;
  relationship?: RelationshipPublicState | null;
  preview?: boolean;
  loading?: boolean;
  error?: string | boolean | null;
  onOpen?: () => void;
  className?: string;
};

function stageStyle(stage: RelationshipStage): CSSProperties {
  const presentation = getRelationshipStagePresentation(stage);
  return {
    "--relationship-fg": presentation.foreground,
    "--relationship-bg": presentation.background,
  } as CSSProperties;
}

export function RelationshipChip({ characterName, relationship, preview = false, loading = false, error, onOpen, className }: Props) {
  const classes = [styles.chip, className].filter(Boolean).join(" ");

  if (preview) {
    return <span className={classes} style={stageStyle("initial")} data-stage="initial">
      本次相遇 · 初识（尚未保存）
    </span>;
  }

  if (!relationship && loading) {
    return <span className={`${classes} ${styles.chipLoading}`} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.skeletonBar} aria-hidden="true" />
      <span className={styles.visuallyHidden}>正在加载你与{characterName}的关系</span>
    </span>;
  }

  if (!relationship) {
    return <span className={`${classes} ${styles.chipUnavailable}`} role="status">
      关系状态暂不可用
    </span>;
  }

  const presentation = getRelationshipStagePresentation(relationship.stage);
  const paused = relationship.status === "paused";
  const syncing = Boolean(error);
  const text = `你与${characterName} · ${presentation.label}${paused ? " · 记录暂停" : ""}${syncing ? " · 同步中" : ""}`;
  const accessibleName = `你与${characterName}的关系：${presentation.label}${paused ? "，关系记录已暂停" : ""}${syncing ? "，状态同步中" : ""}${onOpen ? "。打开关系与记忆设置" : ""}`;
  const common = {
    className: classes,
    style: stageStyle(relationship.stage),
    "data-stage": relationship.stage,
    "aria-label": accessibleName,
  };

  return onOpen
    ? <button {...common} type="button" aria-haspopup="dialog" onClick={onOpen}>{text}</button>
    : <span {...common}>{text}</span>;
}
