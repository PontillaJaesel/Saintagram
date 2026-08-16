"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";

type PopupName = "fiat-streak" | "fiat-leaderboard" | "notifications";

const POPUP_OPENED_EVENT = "saintagram:popup-opened";

export function useExclusivePopup(
  name: PopupName,
  open: boolean,
  setOpen: Dispatch<SetStateAction<boolean>>
) {
  useEffect(() => {
    const closeForOtherPopup = (event: Event) => {
      if ((event as CustomEvent<PopupName>).detail !== name) setOpen(false);
    };

    window.addEventListener(POPUP_OPENED_EVENT, closeForOtherPopup);
    return () => window.removeEventListener(POPUP_OPENED_EVENT, closeForOtherPopup);
  }, [name, setOpen]);

  useEffect(() => {
    if (open) {
      window.dispatchEvent(new CustomEvent<PopupName>(POPUP_OPENED_EVENT, { detail: name }));
    }
  }, [name, open]);
}
