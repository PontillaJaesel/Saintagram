"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { SymbolIcon } from "@/components/ui/symbol-icon";
import {
  downloadFirebaseProfileImage,
  isLocalProfileImageSource
} from "@/lib/profile-images";
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
  const { loading, mode, user } = useAuth();
  const [imageSource, setImageSource] = useState("");

  useEffect(() => {
    let active = true;

    if (!imagePath) {
      setImageSource("");
      return () => undefined;
    }
    if (isLocalProfileImageSource(imagePath)) {
      setImageSource(mode === "local" ? imagePath : "");
      return () => undefined;
    }

    if (loading || !user) {
      setImageSource("");
      return () => undefined;
    }

    setImageSource("");
    void downloadFirebaseProfileImage(imagePath)
      .then((downloadUrl) => {
        if (!active) return;
        setImageSource(downloadUrl);
      })
      .catch(() => {
        if (active) setImageSource("");
      });

    return () => {
      active = false;
    };
  }, [imagePath, loading, mode, user?.id]);

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
        // Firebase Storage images are resolved to a runtime download URL.
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
