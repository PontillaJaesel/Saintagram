"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

export function ReflectionOwnerMenu({
  onEdit,
  onDelete
}: {
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOutside = (event: PointerEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div
      ref={menuRef}
      className="relative z-40"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <button
        type="button"
        className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-sage-100 hover:text-ink"
        aria-label="Reflection options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <MoreHorizontal
          className="size-5"
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-xl border border-sage-100 bg-white p-1.5 shadow-lg"
          role="menu"
        >
          {onEdit && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-ink transition hover:bg-sage-50"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();

                setOpen(false);
                onEdit();
              }}
            >
              <Pencil
                className="size-4 text-sage-600"
                aria-hidden="true"
              />

              Edit
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-clay-600 transition hover:bg-clay-50"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();

                setOpen(false);
                onDelete();
              }}
            >
              <Trash2
                className="size-4"
                aria-hidden="true"
              />

              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}