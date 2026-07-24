"use client";

import type { RelationshipPublicState } from "@ai-museum/sdk";
import type { CSSProperties, RefObject } from "react";
import { useEffect, useId, useRef } from "react";
import { getRelationshipStagePresentation } from "@/lib/relationship-ui";
import styles from "./relationship.module.css";

type PendingAction = "pause" | "resume" | "address" | "revoke-address" | "reset" | null;

type Props = {
  open: boolean;
  characterName: string;
  relationship?: RelationshipPublicState | null;
  loading?: boolean;
  error?: string | null;
  pendingAction?: PendingAction;
  stageChangedLabel?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  onTogglePaused?: () => void;
  onManageAddress?: () => void;
  onRevokeAddress?: () => void;
  onOpenMemories?: () => void;
  onReset?: () => void;
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function RelationshipDrawer({
  open,
  characterName,
  relationship,
  loading = false,
  error,
  pendingAction = null,
  stageChangedLabel,
  returnFocusRef,
  onClose,
  onTogglePaused,
  onManageAddress,
  onRevokeAddress,
  onOpenMemories,
  onReset,
}: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      // A consent or reset dialog may be opened above the drawer. In that case,
      // leave focus containment and Escape handling to the native modal dialog.
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      const focusTarget = returnFocusRef?.current ?? previousFocusRef.current;
      requestAnimationFrame(() => focusTarget?.focus());
    };
  }, [open, returnFocusRef]);

  if (!open) return null;

  const presentation = relationship ? getRelationshipStagePresentation(relationship.stage) : null;
  const paused = relationship?.status === "paused";
  const style = presentation ? {
    "--relationship-fg": presentation.foreground,
    "--relationship-bg": presentation.background,
  } as CSSProperties : undefined;
  const stateUnavailable = !relationship && !loading;

  return <div
    className={styles.drawerBackdrop}
    onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
  >
    <aside
      ref={panelRef}
      className={styles.drawer}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={loading || Boolean(pendingAction)}
      tabIndex={-1}
    >
      <header className={styles.drawerHeader}>
        <div>
          <small className={styles.eyebrow}>关系与记忆</small>
          <h2 id={titleId}>你与{characterName}</h2>
        </div>
        <button ref={closeButtonRef} className={styles.closeButton} type="button" onClick={onClose} aria-label="关闭关系详情">×</button>
      </header>

      <section className={styles.drawerBlock}>
        {relationship && presentation
          ? <span className={styles.stageBadge} style={style}>当前关系 · {presentation.label}</span>
          : loading
            ? <span className={`${styles.stageBadge} ${styles.stageLoading}`} role="status" aria-live="polite"><span className={styles.skeletonBar} aria-hidden="true" /><span className={styles.visuallyHidden}>正在加载关系状态</span></span>
            : <span className={styles.unavailableStatus} role="status">关系状态暂不可用</span>}
        {stageChangedLabel && relationship && <p className={styles.changedAt}>最近变化：{stageChangedLabel}</p>}
        {paused && <div className={styles.pausedNotice} role="status">关系记录已暂停。不会提取新证据、推进阶段或注入称呼与共同经历。</div>}
        <p id={descriptionId}>关系会随着持续且有意义的共同探索自然变化。我们不会显示分数、门槛、进度或下一阶段条件。</p>
        {error && <p className={styles.inlineError} role="alert">{relationship ? `当前显示上次同步的状态。${error}` : error}</p>}
        {relationship && onTogglePaused && <button
          className={styles.secondaryButton}
          type="button"
          disabled={Boolean(pendingAction)}
          onClick={onTogglePaused}
        >
          {pendingAction === "pause" ? "正在暂停…" : pendingAction === "resume" ? "正在恢复…" : paused ? "恢复关系记录" : "暂停关系记录"}
        </button>}
      </section>

      <section className={styles.drawerBlock}>
        <h3>当前称呼</h3>
        <p>{relationship?.preferredAddress
          ? `${characterName}会称你为“${relationship.preferredAddress.value}”。你可以随时修改或撤销，不会影响关系阶段。`
          : stateUnavailable
            ? "关系状态恢复后，才可查看或管理称呼。"
            : "尚未允许人物使用特别称呼。达到合适阶段后，人物才可能提出建议。"}</p>
        <div className={styles.inlineActions}>
          {relationship && onManageAddress && <button className={styles.secondaryButton} type="button" disabled={Boolean(pendingAction)} onClick={onManageAddress}>{relationship.preferredAddress ? "修改称呼" : "设置称呼"}</button>}
          {relationship?.preferredAddress && onRevokeAddress && <button className={styles.quietButton} type="button" disabled={Boolean(pendingAction)} onClick={onRevokeAddress}>{pendingAction === "revoke-address" ? "正在撤销…" : "撤销称呼"}</button>}
        </div>
      </section>

      <section className={styles.drawerBlock}>
        <h3>人物记得什么</h3>
        <p>共同经历来自你的真实对话，并且可以查看、纠正、暂停或删除。敏感披露不会帮助关系推进。</p>
        {onOpenMemories && <button className={styles.primaryButton} type="button" onClick={onOpenMemories}>前往关系与记忆</button>}
      </section>

      {onReset && <section className={styles.drawerBlock}>
        <h3>重新开始</h3>
        <p>重置会清除这段关系的数据，但不会删除你们的聊天记录。</p>
        <button className={styles.dangerButton} type="button" disabled={Boolean(pendingAction)} onClick={onReset}>{pendingAction === "reset" ? "正在重置…" : "重置这段关系"}</button>
      </section>}
    </aside>
  </div>;
}
