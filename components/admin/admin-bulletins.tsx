"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState, useRef } from "react";
import {
  CalendarDays,
  Clock3,
  ExternalLink,
  ImagePlus,
  MapPin,
  Megaphone,
  Pencil,
  Pin,
  Plus,
  Send,
  Trash2,
  X
} from "lucide-react";

import { adminFetch } from "@/lib/admin-api";
import { useToast } from "@/components/providers/toast-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { bulletinImageUrl, deleteBulletinImage, uploadBulletinImage } from "@/lib/bulletin-images";
import type { BulletinItem, BulletinItemType } from "@/types";

interface BulletinFormState {
  type: BulletinItemType;
  title: string;
  description: string;
  eventAt: string;
  location: string;
  linkUrl: string;
  imagePath: string;
  expiresAt: string;
  pinned: boolean;
}

const EMPTY_FORM: BulletinFormState = {
  type: "announcement",
  title: "",
  description: "",
  eventAt: "",
  location: "",
  linkUrl: "",
  imagePath: "",
  expiresAt: "",
  pinned: false
};

function dateLabel(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila"
  }).format(new Date(value));
}

function toManilaDateTimeInput(value: string | null): string {
  if (!value) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(value));

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function toIsoOrNull(value: string): string | null {
  if (!value) return null;

  // datetime-local has no timezone. Saintagram admin dates are interpreted
  // as Philippine time so the same event time is stored regardless of the
  // computer's local timezone. The Philippines is UTC+08:00 year-round.
  const date = new Date(`${value}:00+08:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function itemToForm(item: BulletinItem): BulletinFormState {
  return {
    type: item.type,
    title: item.title,
    description: item.description,
    eventAt: toManilaDateTimeInput(item.eventAt),
    location: item.location,
    linkUrl: item.linkUrl,
    imagePath: item.imagePath,
    expiresAt: toManilaDateTimeInput(item.expiresAt),
    pinned: item.pinned
  };
}

function requestBody(form: BulletinFormState) {
  return {
    type: form.type,
    title: form.title,
    description: form.description,
    eventAt: form.type === "event" ? toIsoOrNull(form.eventAt) : null,
    location: form.location,
    linkUrl: form.linkUrl,
    imagePath: form.imagePath,
    expiresAt: toIsoOrNull(form.expiresAt),
    pinned: form.pinned
  };
}

function ModernDateTimeField({
  id,
  label,
  value,
  onChange,
  required = false,
  helperText
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  helperText?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const formattedValue = value
    ? dateLabel(toIsoOrNull(value))
    : "";

  const openPicker = () => {
    const input = inputRef.current;

    if (!input) return;

    input.focus({
      preventScroll: true
    });

    try {
      if (
        typeof input.showPicker ===
        "function"
      ) {
        input.showPicker();
      }
    } catch {
      // The browser can still use its
      // normal datetime-local behavior.
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={id}
          className="text-sm font-bold text-ink"
        >
          {label}
        </label>

        {!required ? (
          <span className="rounded-full bg-sage-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            Optional
          </span>
        ) : null}
      </div>

      <div className="group relative mt-2">
        {/* Visible Saintagram-designed control */}
        <div
          className="
            flex h-12 w-full items-center gap-3
            rounded-2xl border border-sage-100
            bg-paper px-4
            text-sm text-ink
            shadow-sm
            transition
            group-hover:border-brand-200
            group-focus-within:border-brand-300
            group-focus-within:ring-4
            group-focus-within:ring-brand-100/40
          "
          aria-hidden="true"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-400">
            <CalendarDays
              className="size-4"
              strokeWidth={2}
            />
          </span>

          <span
            className={`min-w-0 flex-1 truncate ${
              formattedValue
                ? "font-medium text-ink"
                : "text-muted"
            }`}
          >
            {formattedValue ||
              "Choose date and time"}
          </span>

          <Clock3
            className="size-4 shrink-0 text-muted"
            strokeWidth={1.8}
          />
        </div>

        {/*
          Real datetime-local input.

          It covers the styled field so the
          entire control remains clickable.

          showPicker() is called explicitly
          because some desktop browsers do
          not reliably open the picker when
          the native input is transparent.
        */}
        <input
          ref={inputRef}
          id={id}
          type="datetime-local"
          required={required}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          onClick={() => {
            openPicker();
          }}
          onFocus={() => {
            /*
             * Do not automatically open here.
             * Focus is kept available for
             * normal keyboard navigation.
             */
          }}
          className="
            absolute inset-0 z-10
            h-full w-full
            cursor-pointer
            opacity-0
          "
        />
      </div>

      {value && !required ? (
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-brand-400 transition hover:text-brand-500"
          onClick={() =>
            onChange("")
          }
        >
          Clear date
        </button>
      ) : null}

      {helperText ? (
        <p className="mt-2 text-xs leading-5 text-muted">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

function BulletinForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  busy,
  submitLabel
}: {
  value: BulletinFormState;
  onChange: (
    value: BulletinFormState
  ) => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>
  ) => void;
  onCancel: () => void;
  busy: boolean;
  submitLabel: string;
}) {
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    let active = true;
    setImageUrl("");
    if (value.imagePath) {
      void bulletinImageUrl(value.imagePath).then((url) => active && setImageUrl(url)).catch(() => active && setImageError("The image preview could not be loaded."));
    }
    return () => { active = false; };
  }, [value.imagePath]);

  const chooseImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImageBusy(true);
    setImageError("");
    try {
      const imagePath = await uploadBulletinImage(file);
      onChange({ ...value, imagePath });
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "The image could not be uploaded.");
    } finally {
      setImageBusy(false);
    }
  };
  const inputClass =
    "h-12 w-full rounded-2xl border border-sage-100 bg-paper px-4 text-sm text-ink shadow-sm outline-none transition placeholder:text-muted/70 hover:border-brand-200 focus:border-brand-300 focus:ring-4 focus:ring-brand-100/40";

  const textAreaClass =
    "min-h-[112px] w-full resize-y rounded-2xl border border-sage-100 bg-paper px-4 py-3 text-sm leading-6 text-ink shadow-sm outline-none transition placeholder:text-muted/70 hover:border-brand-200 focus:border-brand-300 focus:ring-4 focus:ring-brand-100/40";

  return (
    <form
      className="mt-6 space-y-6"
      onSubmit={onSubmit}
    >
      {/* =========================
          BULLETIN TYPE
          ========================= */}

      <div>
        <label className="text-sm font-bold text-ink">
          Bulletin type
        </label>

        <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-sage-100 bg-sage-50/40 p-1.5">
          <button
            type="button"
            aria-pressed={
              value.type ===
              "announcement"
            }
            onClick={() =>
              onChange({
                ...value,
                type: "announcement",
                eventAt: ""
              })
            }
            className={`flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${
              value.type ===
              "announcement"
                ? "bg-paper text-brand-500 shadow-sm ring-1 ring-sage-100"
                : "text-muted hover:bg-paper/60 hover:text-ink"
            }`}
          >
            <Megaphone
              className="size-4"
              strokeWidth={2}
              aria-hidden="true"
            />

            Announcement
          </button>

          <button
            type="button"
            aria-pressed={
              value.type ===
              "event"
            }
            onClick={() =>
              onChange({
                ...value,
                type: "event"
              })
            }
            className={`flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${
              value.type === "event"
                ? "bg-paper text-brand-500 shadow-sm ring-1 ring-sage-100"
                : "text-muted hover:bg-paper/60 hover:text-ink"
            }`}
          >
            <CalendarDays
              className="size-4"
              strokeWidth={2}
              aria-hidden="true"
            />

            Event
          </button>
        </div>
      </div>

      {/* =========================
          TITLE
          ========================= */}

      <div>
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="bulletin-title"
            className="text-sm font-bold text-ink"
          >
            Title
          </label>

          <span
            className={`text-xs tabular-nums ${
              value.title.length >=
              90
                ? "font-semibold text-brand-500"
                : "text-muted"
            }`}
          >
            {value.title.length}
            /100
          </span>
        </div>

        <input
          id="bulletin-title"
          className={`${inputClass} mt-2`}
          maxLength={100}
          required
          value={value.title}
          onChange={(event) =>
            onChange({
              ...value,
              title:
                event.target
                  .value
            })
          }
          placeholder="e.g. Parish Youth Gathering"
        />
      </div>

      {/* =========================
          DESCRIPTION
          ========================= */}

      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <label
              htmlFor="bulletin-description"
              className="text-sm font-bold text-ink"
            >
              Short description
            </label>

            <span className="ml-2 text-xs font-normal text-muted">
              Optional
            </span>
          </div>

          <span
            className={`text-xs tabular-nums ${
              value.description
                .length >= 250
                ? "font-semibold text-brand-500"
                : "text-muted"
            }`}
          >
            {
              value
                .description
                .length
            }
            /280
          </span>
        </div>

        <textarea
          id="bulletin-description"
          className={`${textAreaClass} mt-2`}
          maxLength={280}
          value={
            value.description
          }
          onChange={(event) =>
            onChange({
              ...value,
              description:
                event.target
                  .value
            })
          }
          placeholder="Add a short description for this bulletin item..."
        />
      </div>

      {/* =========================
          EVENT DATE
          ========================= */}

      {value.type ===
      "event" ? (
        <ModernDateTimeField
          id="bulletin-event-at"
          label="Event date and time"
          required
          value={value.eventAt}
          onChange={(
            eventAt
          ) =>
            onChange({
              ...value,
              eventAt
            })
          }
        />
      ) : null}

      {/* =========================
          LOCATION
          ========================= */}

      <div>
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="bulletin-location"
            className="text-sm font-bold text-ink"
          >
            Location
          </label>

          <span className="rounded-full bg-sage-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            Optional
          </span>
        </div>

        <div className="relative mt-2">
          <MapPin
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
            strokeWidth={1.8}
            aria-hidden="true"
          />

          <input
            id="bulletin-location"
            className={`${inputClass} pl-11`}
            maxLength={120}
            value={value.location}
            onChange={(
              event
            ) =>
              onChange({
                ...value,
                location:
                  event.target
                    .value
              })
            }
            placeholder="Venue or meeting place"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="bulletin-image" className="text-sm font-bold text-ink">Picture</label>
          <span className="rounded-full bg-sage-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Optional</span>
        </div>
        {imageUrl ? (
          <div className="mt-2 overflow-hidden rounded-2xl border border-sage-100 bg-sage-50">
            <img src={imageUrl} alt="Bulletin preview" className="max-h-64 w-full object-contain" />
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <label htmlFor="bulletin-image" className="btn-secondary cursor-pointer">
            <ImagePlus className="size-4" aria-hidden="true" />
            {imageBusy ? "Uploading…" : value.imagePath ? "Replace picture" : "Upload picture"}
          </label>
          <input id="bulletin-image" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={imageBusy || busy} onChange={(event) => void chooseImage(event)} />
          {value.imagePath ? (
            <button type="button" className="btn-secondary text-clay-600" onClick={() => onChange({ ...value, imagePath: "" })}>Remove</button>
          ) : null}
        </div>
        <p className="mt-2 text-xs leading-5 text-muted">JPG, PNG, or WebP. The full picture will scale to fit the bulletin.</p>
        {imageError ? <p className="mt-2 text-xs font-semibold text-clay-600" role="alert">{imageError}</p> : null}
      </div>

      {/* =========================
          DETAILS LINK
          ========================= */}

      <div>
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="bulletin-link"
            className="text-sm font-bold text-ink"
          >
            Details link
          </label>

          <span className="rounded-full bg-sage-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            Optional
          </span>
        </div>

        <div className="relative mt-2">
          <ExternalLink
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
            strokeWidth={1.8}
            aria-hidden="true"
          />

          <input
            id="bulletin-link"
            className={`${inputClass} pl-11`}
            type="url"
            maxLength={600}
            value={
              value.linkUrl
            }
            onChange={(
              event
            ) =>
              onChange({
                ...value,
                linkUrl:
                  event.target
                    .value
              })
            }
            placeholder="https://example.com"
          />
        </div>
      </div>

      {/* =========================
          EXPIRATION
          ========================= */}

      <ModernDateTimeField
        id="bulletin-expires-at"
        label="Hide after"
        value={
          value.expiresAt
        }
        onChange={(
          expiresAt
        ) =>
          onChange({
            ...value,
            expiresAt
          })
        }
        helperText="After this time, the bulletin disappears for users but remains available in the admin list."
      />

      {/* =========================
          PIN TOGGLE
          ========================= */}

      <div
        className={`flex items-center justify-between gap-4 rounded-2xl border p-4 transition ${
          value.pinned
            ? "border-brand-200 bg-brand-50/50"
            : "border-sage-100 bg-sage-50/20"
        }`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${
              value.pinned
                ? "bg-brand-100 text-brand-500"
                : "bg-sage-50 text-muted"
            }`}
          >
            <Pin
              className="size-4"
              strokeWidth={2}
              aria-hidden="true"
            />
          </span>

          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">
              Pin this item
            </p>

            <p className="mt-1 text-xs leading-5 text-muted">
              Show this bulletin
              before regular
              announcements and
              events.
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={
            value.pinned
          }
          aria-label="Pin this bulletin item"
          onClick={() =>
            onChange({
              ...value,
              pinned:
                !value.pinned
            })
          }
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 ${
            value.pinned
              ? "bg-brand-500"
              : "bg-sage-200"
          }`}
        >
          <span
            className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${
              value.pinned
                ? "translate-x-6"
                : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* =========================
          ACTIONS
          ========================= */}

      <div className="flex flex-col-reverse gap-3 border-t border-sage-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={
            onCancel
          }
          disabled={busy}
          className="
            inline-flex h-11 items-center
            justify-center rounded-full
            border border-sage-200
            bg-paper px-5
            text-sm font-bold text-ink
            transition
            hover:bg-sage-50
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={
            busy || imageBusy ||
            !value.title.trim() ||
            (value.type ===
              "event" &&
              !value.eventAt)
          }
          className="
            inline-flex h-11 items-center
            justify-center gap-2
            rounded-full
            bg-brand-500
            px-5
            text-sm font-bold text-white
            shadow-sm
            transition
            hover:bg-brand-600
            hover:shadow-md
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          {busy ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />

              Saving…
            </>
          ) : (
            <>
              <Send
                className="size-4"
                strokeWidth={2}
                aria-hidden="true"
              />

              {submitLabel}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export function AdminBulletins() {
  const [items, setItems] = useState<BulletinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [form, setForm] = useState<BulletinFormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<BulletinItem | null>(null);
  const [editForm, setEditForm] = useState<BulletinFormState>(EMPTY_FORM);
  const [deleting, setDeleting] = useState<BulletinItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const { notify } = useToast();

  const load = async () => {
    setListError("");

    try {
      const result = await adminFetch<{ bulletins: BulletinItem[] }>("/api/admin/bulletins");
      setItems(result.bulletins);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Bulletins could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const activeCount = useMemo(() => {
    const now = Date.now();
    return items.filter((item) => !item.expiresAt || new Date(item.expiresAt).getTime() > now).length;
  }, [items]);

  const createItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setFormError("");

    try {
      const result = await adminFetch<{ bulletin: BulletinItem }>("/api/admin/bulletins", {
        method: "POST",
        body: JSON.stringify(requestBody(form))
      });

      setItems((current) => [result.bulletin, ...current]);
      setForm(EMPTY_FORM);
      setShowComposer(false);
      notify("Bulletin item published.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The bulletin item could not be published.");
    } finally {
      setBusy(false);
    }
  };

  const beginEdit = (item: BulletinItem) => {
    setShowComposer(false);
    setEditing(item);
    setEditForm(itemToForm(item));
    setFormError("");
  };

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || busy) return;

    setBusy(true);
    setFormError("");

    try {
      const result = await adminFetch<{ bulletin: BulletinItem }>(
        `/api/admin/bulletins/${encodeURIComponent(editing.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(requestBody(editForm))
        }
      );

      setItems((current) =>
        current.map((item) => (item.id === result.bulletin.id ? result.bulletin : item))
      );
      if (editing.imagePath && editing.imagePath !== result.bulletin.imagePath) {
        void deleteBulletinImage(editing.imagePath).catch(() => undefined);
      }
      setEditing(null);
      notify("Bulletin item updated.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The bulletin item could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting || busy) return;

    setBusy(true);

    try {
      await adminFetch(`/api/admin/bulletins/${encodeURIComponent(deleting.id)}`, {
        method: "DELETE"
      });
      if (deleting.imagePath) void deleteBulletinImage(deleting.imagePath).catch(() => undefined);
      setItems((current) => current.filter((item) => item.id !== deleting.id));
      setDeleting(null);
      notify("Bulletin item deleted.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "The bulletin item could not be deleted.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-6">
        <p className="eyebrow">Administration</p>
        <h1 className="mt-2 font-serif text-3xl font-bold">Community Bulletin</h1>
        <p className="mt-1 text-sm text-muted">
          Manage the announcements and events shown beside the Community feed and under the mobile pin tab.
        </p>
      </div>

      <div className={`grid items-start gap-6 ${showComposer ? "lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.7fr)]" : ""}`}>
        <section className="surface min-w-0 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-serif text-2xl font-bold">Bulletin Items</h2>
              <p className="mt-1 text-sm text-muted">
                {activeCount} visible now · {items.length} total in admin
              </p>
            </div>

            <button
              className="btn-primary"
              type="button"
              onClick={() => {
                setShowComposer((value) => !value);
                setFormError("");
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add Bulletin Item
            </button>
          </div>

          {listError && (
            <p className="mt-5 rounded-xl bg-clay-50 p-3 text-sm text-clay-600" role="alert">
              {listError}
            </p>
          )}

          <div className="mt-6 space-y-4">
            {loading ? (
              <p className="py-8 text-center text-muted">Loading bulletin…</p>
            ) : items.length ? (
              items.map((item) => {
                const expired = item.expiresAt
                  ? new Date(item.expiresAt).getTime() <= Date.now()
                  : false;

                return (
                  <article className="rounded-2xl border border-sage-100 p-5" key={item.id}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-muted">
                          <span>{item.type}</span>
                          {item.pinned && (
                            <span className="inline-flex items-center gap-1 text-brand-400">
                              <Pin className="size-3.5" aria-hidden="true" />
                              Pinned
                            </span>
                          )}
                          {expired && <span className="text-clay-600">Expired</span>}
                        </div>

                        <h3 className="mt-2 text-xl font-bold text-ink">{item.title}</h3>

                        {item.description && (
                          <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
                        )}

                        <div className="mt-4 space-y-2 text-sm text-muted">
                          {item.eventAt && (
                            <p className="flex items-start gap-2">
                              <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                              {dateLabel(item.eventAt)}
                            </p>
                          )}

                          {item.location && (
                            <p className="flex items-start gap-2">
                              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                              {item.location}
                            </p>
                          )}

                          <p className="text-xs">Published {dateLabel(item.createdAt)}</p>
                          {item.expiresAt && <p className="text-xs">Hidden after {dateLabel(item.expiresAt)}</p>}
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <button className="btn-secondary" type="button" onClick={() => beginEdit(item)}>
                          <Pencil className="size-4" aria-hidden="true" />
                          Edit
                        </button>
                        <button
                          className="btn-secondary text-clay-600"
                          type="button"
                          onClick={() => setDeleting(item)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="py-10 text-center text-muted">
                <Megaphone className="mx-auto size-7" aria-hidden="true" />
                <p className="mt-3 text-sm">No bulletin items have been created yet.</p>
              </div>
            )}
          </div>
        </section>

        {showComposer && (
          <section className="surface p-6 lg:sticky lg:top-6" aria-labelledby="new-bulletin-title">
            <div className="flex items-start justify-between gap-4 border-b border-sage-100 pb-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-xl bg-brand-50 text-brand-500">
                    <Megaphone
                      className="size-4"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </span>

                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-500">
                    New item
                  </p>
                </div>

                <h2
                  id="new-bulletin-title"
                  className="mt-3 font-serif text-2xl font-bold tracking-tight text-ink"
                >
                  Publish Bulletin
                </h2>

                <p className="mt-1 text-sm leading-5 text-muted">
                  Create an announcement
                  or event for the
                  Saintagram community.
                </p>
              </div>

              <button
                type="button"
                className="
                  grid size-9 shrink-0
                  place-items-center
                  rounded-full
                  border border-sage-100
                  bg-paper
                  text-muted
                  transition
                  hover:border-sage-200
                  hover:bg-sage-50
                  hover:text-ink
                "
                aria-label="Close bulletin composer"
                onClick={() =>
                  setShowComposer(
                    false
                  )
                }
              >
                <X
                  className="size-4"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </button>
            </div>

            {formError && !editing && (
              <p className="mt-5 rounded-xl bg-clay-50 p-3 text-sm text-clay-600" role="alert">
                {formError}
              </p>
            )}

            <BulletinForm
              value={form}
              onChange={setForm}
              onSubmit={createItem}
              onCancel={() => setShowComposer(false)}
              busy={busy}
              submitLabel="Publish bulletin"
            />
          </section>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4">
          <section
            className="surface max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-bulletin-title"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="edit-bulletin-title" className="font-serif text-2xl font-bold">
                Edit Bulletin Item
              </h2>
              <button type="button" aria-label="Close edit bulletin" onClick={() => setEditing(null)}>
                <X />
              </button>
            </div>

            {formError && (
              <p className="mt-5 rounded-xl bg-clay-50 p-3 text-sm text-clay-600" role="alert">
                {formError}
              </p>
            )}

            <BulletinForm
              value={editForm}
              onChange={setEditForm}
              onSubmit={saveEdit}
              onCancel={() => setEditing(null)}
              busy={busy}
              submitLabel="Save changes"
            />
          </section>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this bulletin item?"
        description="It will immediately disappear from the Community bulletin for all users."
        confirmLabel="Delete bulletin"
        onConfirm={() => void remove()}
        onClose={() => setDeleting(null)}
        busy={busy}
      />
    </>
  );
}
