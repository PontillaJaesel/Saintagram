"use client";

import { useEffect, useState } from "react";
import { SymbolIcon } from "@/components/ui/symbol-icon";
import {
  downloadSupabaseProfileImage,
  isLocalProfileImageSource
} from "@/lib/profile-images";
import { isFirebaseConfigured } from "@/lib/firebase";
import type { SpiritualSymbol } from "@/types";

export function ProfileAvatar({
  imagePath,
  symbol,
  profileName,
  size = "large"
}: {
  imagePath: string;
  symbol: SpiritualSymbol;
  profileName: string;
  size?: "small" | "medium" | "large";
}) {
  const [imageSource, setImageSource] = useState(() =>
    !isFirebaseConfigured && isLocalProfileImageSource(imagePath)
      ? imagePath
      : ""
  );

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    if (!imagePath) {
      setImageSource("");
      return () => undefined;
    }
    if (isLocalProfileImageSource(imagePath)) {
      setImageSource(isFirebaseConfigured ? "" : imagePath);
      return () => undefined;
    }

    setImageSource("");
    void downloadSupabaseProfileImage(imagePath)
      .then((image) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(image);
        setImageSource(objectUrl);
      })
      .catch(() => {
        if (active) setImageSource("");
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imagePath]);

  const sizes = {
    small: "size-11 rounded-2xl",
    medium: "size-16 rounded-3xl",
    large: "size-24 rounded-[2rem] sm:size-28"
  };
  const iconSizes = {
    small: "size-5",
    medium: "size-7",
    large: "size-11"
  };
  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden border-4 border-paper bg-sage-100 text-sage-700 shadow-lift ${sizes[size]}`}
    >
      {imageSource ? (
        // Private Supabase images are resolved to an authenticated, in-memory URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSource}
          alt={`${profileName || "Saintagram"} profile`}
          className="h-full w-full object-cover"
        />
      ) : (
        <SymbolIcon symbol={symbol} className={iconSizes[size]} />
      )}
    </div>
  );
}
