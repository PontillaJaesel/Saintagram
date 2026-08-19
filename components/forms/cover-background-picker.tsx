"use client";

import { useState } from "react";
import { Check, Palette } from "lucide-react";
import { PROFILE_COVERS, getProfileCover } from "@/lib/profile-covers";
import { normalizeCoverColor } from "@/lib/validation";
import { ProfileCover } from "@/components/ui/profile-cover";

export function CoverBackgroundPicker({
  coverColor,
  coverImageId,
  onChange
}: {
  coverColor?: string;
  coverImageId?: string;
  onChange: (value: { coverColor: string; coverImageId: string }) => void;
}) {
  const [mode, setMode] = useState<"color" | "designs">(
    getProfileCover(coverImageId) ? "designs" : "color"
  );
  const selectedColor = normalizeCoverColor(coverColor);
  const selectedCover = getProfileCover(coverImageId);

  return (
    <div>
      <ProfileCover
        coverColor={selectedColor}
        coverImageId={coverImageId}
        className="mb-5 aspect-[3/1]"
      />

      <div className="mb-5 grid grid-cols-2 rounded-[var(--radius-base)] border border-sage-200 bg-sage-50/70 p-1" role="tablist" aria-label="Cover background type">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "color"}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-base)] px-3 text-sm font-bold transition ${mode === "color" ? "bg-white text-ink shadow-sm dark:bg-slate-700 dark:text-white" : "text-muted hover:text-ink"}`}
          onClick={() => {
            setMode("color");
            onChange({ coverColor: selectedColor, coverImageId: "" });
          }}
        >
          <Palette className="size-4" aria-hidden="true" />
          Color
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "designs"}
          className={`inline-flex min-h-11 items-center justify-center rounded-[var(--radius-base)] px-3 text-sm font-bold transition ${mode === "designs" ? "bg-white text-ink shadow-sm dark:bg-slate-700 dark:text-white" : "text-muted hover:text-ink"}`}
          onClick={() => setMode("designs")}
        >
          Designs
        </button>
      </div>

      {mode === "color" ? (
        <div>
          <label htmlFor="edit-cover-color" className="label">Cover color</label>
          <div className="flex items-center gap-4">
            <input
              id="edit-cover-color"
              type="color"
              value={selectedColor}
              onChange={(event) => onChange({ coverColor: event.target.value.toUpperCase(), coverImageId: "" })}
              className="h-12 w-16 cursor-pointer rounded-xl border border-gray-200 bg-paper p-1"
            />
            <output htmlFor="edit-cover-color" className="font-secondary text-sm font-medium text-muted">
              {selectedColor}
            </output>
          </div>
        </div>
      ) : (
        <div>
          <p className="label">Choose a cover design</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PROFILE_COVERS.map((cover) => {
              const selected = selectedCover?.id === cover.id;
              return (
                <button
                  key={cover.id}
                  type="button"
                  aria-label={`Use ${cover.name} cover`}
                  aria-pressed={selected}
                  className={`group relative overflow-hidden rounded-[var(--radius-base)] border-2 text-left transition ${selected ? "border-sage-600 ring-2 ring-sage-200 dark:border-gold-300 dark:ring-gold-400/30" : "border-sage-100 hover:border-sage-400"}`}
                  onClick={() => onChange({ coverColor: selectedColor, coverImageId: cover.id })}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cover.src} alt="" className="aspect-[3/1] w-full object-cover transition group-hover:scale-[1.03]" />
                  <span className="flex items-center justify-between gap-2 bg-paper px-3 py-2 text-xs font-bold text-ink">
                    {cover.name}
                    {selected && <Check className="size-4 text-sage-600" aria-hidden="true" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <p className="mt-3 text-xs leading-5 text-muted">Choose a color or one of Saintagram&apos;s cover designs.</p>
    </div>
  );
}
