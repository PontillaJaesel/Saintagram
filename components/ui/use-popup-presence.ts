"use client";

import { useEffect, useState } from "react";

const EXIT_DURATION_MS = 180;

export function usePopupPresence(open: boolean) {
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setClosing(false);
      return;
    }
    if (!rendered) return;

    setClosing(true);
    const reducedMotion = typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, reducedMotion ? 0 : EXIT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [open, rendered]);

  return { rendered, closing };
}
