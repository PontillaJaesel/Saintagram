"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { SymbolIcon } from "@/components/ui/symbol-icon";
import { appService } from "@/lib/app-service";
import { SPIRITUAL_SYMBOLS } from "@/lib/constants";
import { validateImage } from "@/lib/validation";
import type { SpiritualSymbol } from "@/types";

export function ImageSymbolPicker({
  imageUrl,
  selectedSymbol,
  profileName,
  onChange
}: {
  imageUrl: string;
  selectedSymbol: SpiritualSymbol;
  profileName: string;
  onChange: (value: {
    imageUrl: string;
    selectedSymbol: SpiritualSymbol;
  }) => void;
}) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    const validationError = validateImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setUploading(true);
    setError("");
    try {
      const nextUrl = await appService.uploadProfileImage(user.id, file);
      onChange({ imageUrl: nextUrl, selectedSymbol: "" });
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The image could not be uploaded."
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col items-center gap-4 rounded-3xl bg-sage-50 p-6 sm:flex-row sm:items-center">
        <ProfileAvatar
          imageUrl={imageUrl}
          symbol={selectedSymbol}
          profileName={profileName}
        />
        <div className="text-center sm:text-left">
          <p className="font-bold text-ink">Your chosen profile image</p>
          <p className="mt-1 text-sm leading-6 text-muted">
            Choose a photo, a meaningful symbol, or leave this space simple.
          </p>
        </div>
      </div>

      <fieldset>
        <legend className="label">Choose a spiritual symbol</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SPIRITUAL_SYMBOLS.map((symbol) => {
            const selected =
              selectedSymbol === symbol.id && imageUrl.length === 0;
            return (
              <button
                key={symbol.id}
                type="button"
                className={`min-h-28 rounded-2xl border p-4 text-left transition ${
                  selected
                    ? "border-sage-600 bg-sage-700 text-white"
                    : "border-sage-200 bg-white text-ink hover:border-sage-400"
                }`}
                onClick={() =>
                  onChange({
                    imageUrl: "",
                    selectedSymbol: symbol.id
                  })
                }
                aria-pressed={selected}
              >
                <SymbolIcon
                  symbol={symbol.id}
                  className={`mb-3 size-6 ${
                    selected ? "text-gold-200" : "text-sage-600"
                  }`}
                />
                <span className="block text-sm font-bold">{symbol.label}</span>
                <span
                  className={`mt-1 block text-xs leading-5 ${
                    selected ? "text-sage-100" : "text-muted"
                  }`}
                >
                  {symbol.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-sage-400">
        <span className="h-px flex-1 bg-sage-100" />
        or
        <span className="h-px flex-1 bg-sage-100" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={upload}
          className="sr-only"
          aria-label="Upload profile image"
        />
        <button
          type="button"
          className="btn-secondary flex-1"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ImagePlus className="size-4" aria-hidden="true" />
          )}
          {uploading ? "Uploading…" : "Upload an image"}
        </button>
        <button
          type="button"
          className="btn-quiet flex-1"
          onClick={() => onChange({ imageUrl: "", selectedSymbol: "" })}
          disabled={!imageUrl && !selectedSymbol}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Skip image
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">
        JPG, PNG, or WebP. Maximum 2 MB. Your image is private to your account.
      </p>
      {error && (
        <p className="mt-3 text-sm font-semibold text-clay-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
