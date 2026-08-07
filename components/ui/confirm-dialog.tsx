"use client";

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  headerIcon,
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
  headerIcon?: ReactNode;
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

  if (!open || typeof document === "undefined") return null;

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

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-ink/45 p-6 backdrop-blur-sm"
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
        className="relative w-full max-w-md rounded-4xl border border-sage-100 bg-paper p-6 shadow-lift"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          {headerIcon && <div>{headerIcon}</div>}
          <div>
            <h2 id={titleId} className="font-serif text-2xl font-bold text-ink">
              {title}
            </h2>
            <p id={descriptionId} className="mt-2 text-sm leading-6 text-muted">
              {description}
            </p>
          </div>
        </div>

        {children && <div className="mt-6">{children}</div>}

        <div className="mt-6 flex flex-col gap-3">
          {destructive ? (
            <>
              <button
                type="button"
                className="inline-flex w-full min-h-12 items-center justify-center rounded-full bg-clay-600 px-6 py-3 text-sm font-bold text-white hover:bg-clay-500 disabled:opacity-50"
                onClick={onConfirm}
                disabled={busy}
              >
                {busy ? "Please wait…" : confirmLabel}
              </button>
              <button
                ref={cancelRef}
                type="button"
                className="btn-secondary w-full"
                onClick={onClose}
                disabled={busy}
              >
                {cancelLabel}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn-primary w-full"
                onClick={onConfirm}
                disabled={busy}
              >
                {busy ? "Please wait…" : confirmLabel}
              </button>
              <button
                ref={cancelRef}
                type="button"
                className="btn-secondary w-full"
                onClick={onClose}
                disabled={busy}
              >
                {cancelLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
