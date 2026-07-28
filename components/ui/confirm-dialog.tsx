"use client";

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode
} from "react";
import { X } from "lucide-react";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  children,
  onConfirm,
  onClose,
  busy = false
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => cancelRef.current?.focus());
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onEscape);
      previousFocus.current?.focus();
    };
  }, [open, onClose, busy]);

  if (!open) return null;

  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-end bg-ink/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={trapFocus}
        className="w-full max-w-md rounded-t-4xl border border-sage-100 bg-paper p-6 shadow-lift sm:rounded-4xl"
      >
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h2 id={titleId} className="font-serif text-2xl font-bold text-ink">
              {title}
            </h2>
            <p
              id={descriptionId}
              className="mt-2 text-sm leading-6 text-muted"
            >
              {description}
            </p>
          </div>
          <button
            type="button"
            className="grid min-h-11 min-w-11 place-items-center rounded-full text-muted hover:bg-sage-50"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        {children && <div className="mt-5">{children}</div>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={
              destructive
                ? "inline-flex min-h-12 items-center justify-center rounded-full bg-clay-600 px-6 py-3 text-sm font-bold text-white hover:bg-clay-500 disabled:opacity-50"
                : "btn-primary"
            }
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
