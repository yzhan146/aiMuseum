"use client";

import type { FormEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { validateRelationshipAddress } from "@/lib/relationship-ui";
import styles from "./relationship.module.css";

type Props = {
  open: boolean;
  characterName: string;
  suggestedAddress?: string;
  currentAddress?: string;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (address: string) => void;
  onRejectSuggestion?: () => void;
  onRevoke?: () => void;
};

export function RelationshipAddressDialog({
  open,
  characterName,
  suggestedAddress,
  currentAddress,
  busy = false,
  error,
  onClose,
  onSave,
  onRejectSuggestion,
  onRevoke,
}: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const inputHintId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const validation = validateRelationshipAddress(value);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setValue(suggestedAddress ?? currentAddress ?? "");
    setShowValidation(false);
  }, [open, suggestedAddress, currentAddress]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowValidation(true);
    if (!validation.error) onSave(validation.value);
  }

  const suggestionMode = Boolean(suggestedAddress);

  return <dialog
    ref={dialogRef}
    className={styles.nativeDialog}
    aria-labelledby={titleId}
    aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onPointerDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
  >
    <form className={styles.dialogContent} onSubmit={submit} aria-busy={busy}>
      <small className={styles.eyebrow}>称呼需要你的允许</small>
      <h2 id={titleId}>{suggestionMode ? `${characterName}以后可以这样称呼你吗？` : `管理${characterName}对你的称呼`}</h2>
      <p id={descriptionId}>同意后，人物可以在合适的时候使用这个称呼。拒绝、忽略、修改或撤销都不会影响关系阶段。</p>
      <label className={styles.field}>
        <span>{suggestionMode ? "建议的称呼，也可以修改" : "希望人物使用的称呼"}</span>
        <input
          autoFocus
          className={styles.textInput}
          value={value}
          onChange={(event) => { setValue(event.target.value); setShowValidation(false); }}
          aria-describedby={inputHintId}
          aria-invalid={showValidation && Boolean(validation.error)}
          disabled={busy}
          autoComplete="off"
        />
      </label>
      <div id={inputHintId} className={styles.inputHint}>
        <span>1–20 个字符</span>
        <span>{validation.graphemeCount}/20</span>
      </div>
      {showValidation && validation.error && <p className={styles.inlineError} role="alert">{validation.error}</p>}
      {error && <p className={styles.inlineError} role="alert">{error}</p>}
      <div className={styles.dialogActions}>
        <button className={styles.secondaryButton} type="button" disabled={busy} onClick={onClose}>{suggestionMode ? "以后再说" : "取消"}</button>
        {suggestionMode && onRejectSuggestion && <button className={styles.quietButton} type="button" disabled={busy} onClick={onRejectSuggestion}>不使用这个称呼</button>}
        {currentAddress && onRevoke && <button className={styles.quietButton} type="button" disabled={busy} onClick={onRevoke}>撤销当前称呼</button>}
        <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? "正在保存…" : "允许这样称呼我"}</button>
      </div>
    </form>
  </dialog>;
}
