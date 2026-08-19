"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";
import { appService } from "@/lib/app-service";
import {
  downloadFirebaseProfileImage,
  isLocalProfileImageSource
} from "@/lib/profile-images";

export function CoverPhotoPicker({
  imagePath,
  committedImagePath = "",
  onChange
}: {
  imagePath: string;
  committedImagePath?: string;
  onChange: (imagePath: string) => void;
}) {
  const { loading, mode, user } = useAuth();
  const { notify } = useToast();
  const [src, setSrc] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    if (!imagePath) {
      setSrc("");
      return () => undefined;
    }
    if (isLocalProfileImageSource(imagePath)) {
      setSrc(mode === "local" ? imagePath : "");
      return () => undefined;
    }
    if (loading || !user) {
      setSrc("");
      return () => undefined;
    }
    setSrc("");
    void downloadFirebaseProfileImage(imagePath)
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc("");
      });
    return () => {
      active = false;
    };
  }, [imagePath, loading, mode, user?.id]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    setUploading(true);
    setError("");
    try {
      const previousPath = imagePath;
      const nextPath = await appService.uploadProfileCover(user.id, file);
      onChange(nextPath);
      notify("Your cover photo was uploaded.");
      if (previousPath && previousPath !== nextPath && previousPath !== committedImagePath) {
        await appService.deleteProfileCover(user.id, previousPath).catch(() => undefined);
      }
    } catch (uploadError) {
      const message = uploadError instanceof Error
        ? uploadError.message
        : "The cover photo could not be uploaded.";
      setError(message);
      notify(message, "error");
    } finally {
      setUploading(false);
    }
  };

  const remove = () => {
    onChange("");
    setSrc("");
    setError("");
  };

  return (
    <div>
      <div className="overflow-hidden rounded-[var(--radius-base)] border border-sage-100 bg-gradient-to-r from-sage-100 via-gold-50 to-sage-50 aspect-[3/1]">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Cover photo preview" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center px-4 text-center text-sm text-muted">
            No cover photo selected
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={upload}
        className="sr-only"
        aria-label="Upload cover photo"
      />
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button type="button" className="btn-secondary flex-1" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
          {uploading ? "Uploading..." : imagePath ? "Change photo" : "Upload photo"}
        </button>
        <button type="button" className="btn-destructive flex-1" onClick={remove} disabled={uploading || !imagePath}>
          <Trash2 className="size-4" aria-hidden="true" />
          Remove photo
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">JPG, PNG, or WebP. Maximum 5 MB.</p>
      {error && <p className="mt-3 text-sm font-semibold text-clay-600" role="alert">{error}</p>}
    </div>
  );
}
