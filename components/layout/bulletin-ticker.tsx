"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  CalendarDays,
  Megaphone,
  X
} from "lucide-react";

import {
  usePathname,
  useRouter
} from "next/navigation";

import {
  getPublicBulletins
} from "@/lib/bulletins";

import type {
  BulletinItem
} from "@/types";

const DISMISSED_KEY =
  "saintagram-bulletin-ticker-dismissed-v1";

function tickerLabel(
  item: BulletinItem
): string {
  const prefix =
    item.type === "event"
      ? "Event"
      : "Announcement";

  return `${prefix}: ${item.title}`;
}

export function BulletinTicker({
  onVisibilityChange
}: {
  onVisibilityChange?: (
    visible: boolean
  ) => void;
}) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const [
    items,
    setItems
  ] =
    useState<
      BulletinItem[]
    >([]);

  const [
    loading,
    setLoading
  ] =
    useState(true);

  const [
    dismissed,
    setDismissed
  ] =
    useState(true);
  
  const tickerViewportRef =
  useRef<HTMLDivElement | null>(
    null
  );

  const tickerGroupRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const [
    tickerCopies,
    setTickerCopies
  ] = useState(4);

  const [
    tickerLoopWidth,
    setTickerLoopWidth
  ] = useState(0);

  const [
    tickerDuration,
    setTickerDuration
  ] = useState(20);

  /*
   * Check whether the user already dismissed the
   * ticker during this browser-tab/app session.
   *
   * sessionStorage is intentional:
   *
   * - navigating between pages will NOT show it again
   * - refreshing the same tab will keep it dismissed
   * - opening Saintagram in a new session/tab shows it again
   */
  useEffect(() => {
    try {
      const alreadyDismissed =
        window.sessionStorage.getItem(
          DISMISSED_KEY
        ) === "1";

      setDismissed(
        alreadyDismissed
      );
    } catch {
      setDismissed(
        false
      );
    }
  }, []);

  /*
   * Load the same active Bulletin entries displayed
   * on the Community page.
   *
   * getPublicBulletins() already removes items whose
   * expiresAt value has passed.
   */
  useEffect(() => {
    let active =
      true;

    const load =
      async () => {
        try {
          const bulletins =
            await getPublicBulletins();

          if (!active) {
            return;
          }

          setItems(
            bulletins
          );
        } catch (
          error
        ) {
          console.error(
            "Unable to load bulletin ticker.",
            error
          );

          if (active) {
            setItems([]);
          }
        } finally {
          if (active) {
            setLoading(
              false
            );
          }
        }
      };

    void load();

    return () => {
      active =
        false;
    };
  }, []);

  const visible =
    !loading &&
    !dismissed &&
    items.length > 0;

  useEffect(() => {
    onVisibilityChange?.(
      visible
    );
  }, [
    visible,
    onVisibilityChange
  ]);

  const tickerText =
    useMemo(
      () =>
        items
          .map(
            tickerLabel
          )
          .join(
            "     •     "
          ),
      [items]
    );
  
  useEffect(() => {
    const viewport =
      tickerViewportRef.current;

    const group =
      tickerGroupRef.current;

    if (
      !viewport ||
      !group ||
      !tickerText
    ) {
      return;
    }

    function measureTicker() {
      if (
        !tickerViewportRef.current ||
        !tickerGroupRef.current
      ) {
        return;
      }

      const viewportWidth =
        tickerViewportRef.current
          .getBoundingClientRect()
          .width;

      const groupWidth =
        tickerGroupRef.current
          .getBoundingClientRect()
          .width;

      if (
        viewportWidth <= 0 ||
        groupWidth <= 0
      ) {
        return;
      }

      /*
      * We need enough identical copies to cover:
      *
      * 1. the whole visible ticker
      * 2. one additional group moving off-screen
      * 3. one safety copy entering from the right
      */
      const copies =
        Math.max(
          3,
          Math.ceil(
            viewportWidth /
              groupWidth
          ) + 2
        );

      setTickerCopies(
        copies
      );

      setTickerLoopWidth(
        groupWidth
      );

      /*
      * Keep movement speed roughly constant
      * regardless of how long the announcement is.
      *
      * About 55 pixels per second.
      */
      setTickerDuration(
        Math.max(
          10,
          groupWidth / 55
        )
      );
    }

    measureTicker();

    const observer =
      new ResizeObserver(
        measureTicker
      );

    observer.observe(
      viewport
    );

    observer.observe(
      group
    );

    return () => {
      observer.disconnect();
    };
  }, [tickerText]);

  function closeTicker() {
    setDismissed(
      true
    );

    try {
      window.sessionStorage.setItem(
        DISMISSED_KEY,
        "1"
      );
    } catch {
      // Ignore unavailable browser storage.
    }
  }

  function openBulletin() {
    /*
     * When the user is already on Community,
     * immediately tell CommunityHub to open the
     * Bulletin tab.
     */
    if (
      pathname ===
      "/community"
    ) {
      window.history.replaceState(
        null,
        "",
        "/community?bulletin=open"
      );

      window.dispatchEvent(
        new CustomEvent(
          "saintagram:open-bulletin"
        )
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });

      return;
    }

    /*
     * From every other Saintagram page, redirect
     * directly to Community with a small query flag.
     * CommunityHub will detect it and open Bulletin
     * automatically on mobile/tablet.
     */
    router.push(
      "/community?bulletin=open"
    );
  }

  if (!visible) {
    return null;
  }

  return (
    <div
      className="bulletin-ticker fixed inset-x-0 bottom-0 z-[120]"
      role="region"
      aria-label="Saintagram announcement"
    >
      <div className="relative flex min-h-12 items-stretch overflow-hidden border-t border-brand-200/70 bg-[#fff4f4] text-ink shadow-[0_-8px_30px_rgb(0_0_0/0.08)] dark:border-brand-300/40 dark:bg-brand-600 dark:text-white dark:shadow-[0_-8px_30px_rgb(0_0_0/0.18)]">
        {/* Leading icon */}
        <div className="relative z-20 flex shrink-0 items-center border-r border-brand-200/70 bg-[#fff4f4] px-3 sm:px-4 dark:border-white/15 dark:bg-brand-600">
          <span className="grid size-7 place-items-center rounded-full bg-brand-100 text-brand-500 sm:size-8 dark:bg-white/15 dark:text-white">
            <Megaphone
              className="size-4"
              strokeWidth={
                2.2
              }
              aria-hidden="true"
            />
          </span>

          <span className="ml-2 hidden text-xs font-bold uppercase tracking-[0.12em] text-brand-600 sm:inline dark:text-white">
            Bulletin
          </span>
        </div>

        {/* Clickable scrolling content */}
        <button
          type="button"
          onClick={
            openBulletin
          }
          className="group relative min-w-0 flex-1 cursor-pointer overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
          aria-label="Open Saintagram Bulletin"
        >
          {/* Fade edges */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#fff4f4] to-transparent dark:from-brand-600"
          />

          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#fff4f4] to-transparent dark:from-brand-600"
          />

          <div
            ref={tickerViewportRef}
            className="flex h-full min-h-12 w-full items-center overflow-hidden"
          >
            <div
              className="bulletin-ticker-track flex w-max shrink-0 items-center whitespace-nowrap"
              style={
                {
                  "--bulletin-loop-width":
                    `${tickerLoopWidth}px`,

                  "--bulletin-loop-duration":
                    `${tickerDuration}s`
                } as React.CSSProperties
              }
            >
              {Array.from({
                length:
                  tickerCopies
              }).map(
                (
                  _,
                  index
                ) => (
                  <div
                    key={
                      index
                    }
                    ref={
                      index === 0
                        ? tickerGroupRef
                        : undefined
                    }
                    aria-hidden={
                      index === 0
                        ? undefined
                        : true
                    }
                    className="bulletin-ticker-group flex shrink-0 items-center"
                  >
                    <span className="inline-flex shrink-0 items-center gap-3 px-5 text-[13px] font-semibold text-ink sm:px-6 sm:text-sm dark:text-white">
                      <CalendarDays
                        className="size-4 shrink-0 opacity-80"
                        aria-hidden="true"
                      />

                      <span>
                        {tickerText}
                      </span>

                      <span className="font-bold text-brand-500 dark:text-white/75">
                        Tap to view
                      </span>

                      <span
                        aria-hidden="true"
                        className="mx-3 text-brand-300 dark:text-white/50"
                      >
                        •
                      </span>
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        </button>

        {/* Close */}
        <div className="relative z-20 flex shrink-0 items-center border-l border-brand-200/70 bg-[#fff4f4] px-1.5 sm:px-2 dark:border-white/15 dark:bg-brand-600">
          <button
            type="button"
            onClick={
              closeTicker
            }
            className="grid size-9 place-items-center rounded-full text-brand-500 transition hover:bg-brand-100 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-white/80 dark:hover:bg-white/15 dark:hover:text-white dark:focus-visible:ring-white"
            aria-label="Dismiss announcement"
            title="Dismiss"
          >
            <X
              className="size-4"
              strokeWidth={
                2.5
              }
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* iPhone / mobile safe area */}
      <div className="bg-[#fff4f4] pb-[env(safe-area-inset-bottom)] dark:bg-brand-600" />
    </div>
  );
}