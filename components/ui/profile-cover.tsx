"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import {
  downloadFirebaseProfileImage,
  isLocalProfileImageSource
} from "@/lib/profile-images";

export function ProfileCover({
  imagePath,
  className = ""
}: {
  imagePath: string;
  className?: string;
}) {
  const { loading, mode, user } = useAuth();
  const [src, setSrc] = useState("");

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

  return (
    <div className={`profile-cover bg-gradient-to-r from-sage-100 via-gold-50 to-sage-50 ${className}`} aria-hidden="true">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      )}
    </div>
  );
}
