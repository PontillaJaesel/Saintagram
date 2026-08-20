"use client";

import {
  useEffect,
  useId,
  useState
} from "react";

import {
  CalendarDays,
  ExternalLink,
  MapPin,
  Megaphone,
  Pin
} from "lucide-react";

import {
  getPublicBulletins
} from "@/lib/bulletins";

import type {
  BulletinItem
} from "@/types";

function dateLabel(
  value: string
): string {
  return new Intl.DateTimeFormat(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone:
        "Asia/Manila"
    }
  ).format(
    new Date(value)
  );
}

function publishedLabel(
  value: string
): string {
  if (!value) {
    return "Recently posted";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      timeZone:
        "Asia/Manila"
    }
  ).format(
    new Date(value)
  );
}

function BulletinRow({
  item
}: {
  item: BulletinItem;
}) {
  const isEvent =
    item.type === "event";

  const content = (
    <div className="group relative px-5 py-5">
      <div className="min-w-0">

        {/* Type + pinned */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-extrabold ${
              isEvent
                ? "border-amber-400/25 bg-amber-400/15 text-amber-700 dark:text-amber-300"
                : "border-rose-400/25 bg-rose-400/15 text-rose-700 dark:text-rose-300"
            }`}
          >
            {isEvent
              ? "Event"
              : "Announcement"}
          </span>

          {item.pinned ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-sage-100 bg-sage-50 px-2.5 py-1 text-[10px] font-bold text-muted dark:bg-white/5">
              <Pin
                className="size-3"
                aria-hidden="true"
              />
              Pinned
            </span>
          ) : null}
        </div>

        {/* Title */}
        <h3 className="text-[16px] font-extrabold leading-6 tracking-[-0.01em] text-ink">
          {item.title}
        </h3>

        {/* Description */}
        {item.description ? (
          <p className="mt-2.5 text-[14px] font-medium leading-6 text-slate-700 dark:text-slate-200">
            {item.description}
          </p>
        ) : null}

        {/* Metadata — intentionally subtle */}
        <div className="mt-4 space-y-2 text-[12px] font-medium text-muted">
          {item.eventAt ? (
            <div className="flex items-center gap-2">
              <CalendarDays
                className="size-3.5 shrink-0 opacity-70"
                strokeWidth={1.8}
                aria-hidden="true"
              />

              <span>
                {dateLabel(
                  item.eventAt
                )}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span>
                {publishedLabel(
                  item.createdAt
                )}
              </span>
            </div>
          )}

          {item.location ? (
            <div className="flex min-w-0 items-center gap-2">
              <MapPin
                className="size-3.5 shrink-0 opacity-70"
                strokeWidth={1.8}
                aria-hidden="true"
              />

              <span className="truncate">
                {item.location}
              </span>
            </div>
          ) : null}
        </div>

        {/* Optional link */}
        {item.linkUrl ? (
          <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand-500 transition group-hover:text-brand-600 dark:text-brand-300">
            View details

            <ExternalLink
              className="size-3.5"
              strokeWidth={2}
              aria-hidden="true"
            />
          </div>
        ) : null}
      </div>
    </div>
  );

  if (item.linkUrl) {
    return (
      <a
        href={item.linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block border-b border-sage-100/70 transition-colors last:border-b-0 hover:bg-sage-50/40 dark:hover:bg-white/[0.025]"
      >
        {content}
      </a>
    );
  }

  return (
    <article className="border-b border-sage-100/70 last:border-b-0">
      {content}
    </article>
  );
}

export function useCommunityBulletins() {
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
    error,
    setError
  ] =
    useState("");

  useEffect(() => {
    let active =
      true;

    const load =
      async () => {
        setLoading(
          true
        );

        setError("");

        try {
          const nextItems =
            await getPublicBulletins();

          if (active) {
            setItems(
              nextItems
            );
          }
        } catch (
          loadError
        ) {
          if (
            !active
          ) {
            return;
          }

          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "The bulletin could not be loaded."
          );
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

  return {
    items,
    loading,
    error
  };
}

export function CommunityBulletin({
  items,
  loading,
  error,
  compact = false
}: {
  items: BulletinItem[];
  loading: boolean;
  error: string;
  compact?: boolean;
}) {
  const headingId =
    useId();

  return (
    <section
      aria-labelledby={
        headingId
      }
      className={`overflow-hidden rounded-[22px] border border-sage-100 bg-paper ${
        compact
          ? ""
          : "shadow-soft"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-sage-100/80 px-5 py-[18px]">
        <div className="grid size-10 shrink-0 place-items-center rounded-full border border-violet-400/20 bg-violet-500/10 text-violet-600 dark:text-violet-300">
          <Megaphone
            className="size-[18px]"
            strokeWidth={2.2}
            aria-hidden="true"
          />
        </div>

        <h2
          id={
            headingId
          }
          className="text-[18px] font-extrabold tracking-[-0.02em] text-ink"
        >
          Saintagram Bulletin
        </h2>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-5 px-5 py-6">
          {[
            1,
            2,
            3
          ].map(
            (
              item
            ) => (
              <div
                key={
                  item
                }
                className="animate-pulse"
              >
                <div className="h-4 w-20 rounded-full bg-sage-100" />

                <div className="mt-3 h-4 w-3/4 rounded bg-sage-100" />

                <div className="mt-2 h-3 w-full rounded bg-sage-50" />

                <div className="mt-2 h-3 w-2/3 rounded bg-sage-50" />
              </div>
            )
          )}
        </div>
      ) : error ? (
        <div
          className="px-5 py-8 text-center"
          role="alert"
        >
          <div className="mx-auto grid size-10 place-items-center rounded-full bg-clay-50 text-clay-500">
            <Megaphone
              className="size-4"
              aria-hidden="true"
            />
          </div>

          <p className="mt-3 text-sm font-semibold text-ink">
            Bulletin unavailable
          </p>

          <p className="mt-1 text-xs leading-5 text-muted">
            {error}
          </p>
        </div>
      ) : items.length ? (
        <div
          className={
            compact
              ? "max-h-[calc(100vh-8rem)] overflow-y-auto"
              : ""
          }
        >
          {items.map(
            (
              item
            ) => (
              <BulletinRow
                key={
                  item.id
                }
                item={
                  item
                }
              />
            )
          )}
        </div>
      ) : (
        <div className="px-6 py-10 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-sage-50 text-muted">
            <Megaphone
              className="size-5"
              aria-hidden="true"
            />
          </div>

          <p className="mt-3 text-sm font-bold text-ink">
            Nothing posted yet
          </p>

          <p className="mx-auto mt-1 max-w-[220px] text-xs leading-5 text-muted">
            New updates from Saintagram will appear here.
          </p>
        </div>
      )}
    </section>
  );
}