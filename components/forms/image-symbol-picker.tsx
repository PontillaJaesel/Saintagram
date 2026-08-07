"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { SymbolIcon } from "@/components/ui/symbol-icon";
import { appService } from "@/lib/app-service";
import { SPIRITUAL_SYMBOLS } from "@/lib/constants";
import { validateImage } from "@/lib/validation";
import type { SpiritualSymbol } from "@/types";

export function ImageSymbolPicker({
  imagePath,
  committedImagePath = "",
  deferImageCleanup = false,
  selectedSymbol,
  profileName,
  onChange
}: {
  imagePath: string;
  committedImagePath?: string;
  deferImageCleanup?: boolean;
  selectedSymbol: SpiritualSymbol;
  profileName: string;
  onChange: (value: {
    imagePath: string;
    selectedSymbol: SpiritualSymbol;
  }) => void;
}) {
  const { user } = useAuth();
  const { notify } = useToast();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const removePendingImage = async (path: string) => {
    if (
      deferImageCleanup ||
      !user ||
      !path ||
      path === committedImagePath
    ) {
      return;
    }
    try {
      await appService.deleteProfileImage(user.id, path);
    } catch (removeError) {
      if (mountedRef.current) {
        setError(
          removeError instanceof Error
            ? removeError.message
            : "The unused image could not be removed."
        );
      }
    }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    const validationError = validateImage(file);
    if (validationError) {
      setError(validationError);
      notify(validationError, "error");
      return;
    }
    setUploading(true);
    setError("");
    const userId = user.id;
    try {
      const previousPath = imagePath;
      const nextPath = await appService.uploadProfileImage(userId, file);
      if (!mountedRef.current) {
        try {
          await appService.deleteProfileImage(userId, nextPath);
        } catch {
          // Account deletion scans the entire owner prefix and can retry a
          // late-upload cleanup that loses its authenticated browser context.
        }
        return;
      }
      onChange({ imagePath: nextPath, selectedSymbol: "" });
      notify("Your profile image was uploaded.");
      if (previousPath !== nextPath) {
        await removePendingImage(previousPath);
      }
    } catch (uploadError) {
      if (mountedRef.current) {
        const message =
          uploadError instanceof Error
            ? uploadError.message
            : "The image could not be uploaded.";
        setError(message);
        notify(message, "error");
      }
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col items-center gap-4 rounded-[var(--radius-card)] bg-sage-50 p-6 sm:flex-row sm:items-center">
        <ProfileAvatar
          imagePath={imagePath}
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
              selectedSymbol === symbol.id && imagePath.length === 0;
            return (
              <button
                key={symbol.id}
                type="button"
                className={`min-h-28 rounded-[var(--radius-base)] border p-4 text-left transition ${
                  selected
                    ? "border-sage-600 bg-sage-400 text-white"
                    : "border-sage-200 bg-white text-ink hover:border-sage-400"
                }`}
                disabled={uploading}
                onClick={() => {
                  onChange({
                    imagePath: "",
                    selectedSymbol: symbol.id
                  });
                  void removePendingImage(imagePath);
                }}
                aria-pressed={selected}
              >
                <SymbolIcon
                  symbol={symbol.id}
                  className={`mb-3 size-6 ${
                    selected ? "text-gold-200" : "text-sage-400"
                  }`}
                />
                <span className="block text-sm text-clay-400 font-bold">{symbol.label}</span>
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
          className="btn-quiet flex-1 border border-clay-500 text-clay-600 hover:bg-clay-50 disabled:border-sage-200 disabled:text-muted"
          onClick={() => {
            onChange({ imagePath: "", selectedSymbol: "" });
            void removePendingImage(imagePath);
          }}
          disabled={uploading || (!imagePath && !selectedSymbol)}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Delete image
        </button>
      </div>
      <p className="mt-3 text-center text-xs leading-5 text-muted">
        JPG, PNG, or WebP. Maximum 2 MB. Avoid uploading highly sensitive images.
      </p>
      {error && (
        <p className="mt-3 text-sm font-semibold text-clay-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
