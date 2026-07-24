"use client";

import { useEffect, useId, useRef } from "react";
import styles from "./relationship.module.css";

type Props = {
  open: boolean;
  characterName: string;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function RelationshipResetDialog({ open, characterName, busy = false, error, onClose, onConfirm }: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return <dialog
    ref={dialogRef}
    className={styles.nativeDialog}
    aria-labelledby={titleId}
    aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onPointerDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
  >
    <section className={styles.dialogContent} aria-busy={busy}>
      <small className={styles.eyebrow}>重置关系</small>
      <h2 id={titleId}>要和{characterName}重新从“初识”开始吗？</h2>
      <p id={descriptionId}>这会删除关系证据、阶段历史和称呼许可。你们的聊天记录会保留，旧消息也不会被重新用于推进关系。</p>
      {error && <p className={styles.inlineError} role="alert">{error}</p>}
      <div className={styles.dialogActions}>
        <button autoFocus className={styles.secondaryButton} type="button" disabled={busy} onClick={onClose}>取消</button>
        <button className={styles.dangerButton} type="button" disabled={busy} onClick={onConfirm}>{busy ? "正在重置…" : "确认重置"}</button>
      </div>
    </section>
  </dialog>;
}
