"use client";

import { getProfileCover } from "@/lib/profile-covers";
import { normalizeCoverColor } from "@/lib/validation";

export function ProfileCover({
  coverColor,
  coverImageId,
  className = ""
}: {
  coverColor?: string;
  coverImageId?: string;
  className?: string;
}) {
  const cover = getProfileCover(coverImageId);

  return (
    <div
      className={`profile-cover ${className}`}
      style={cover ? undefined : { backgroundColor: normalizeCoverColor(coverColor) }}
      aria-hidden="true"
    >
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover.src} alt="" className="h-full w-full object-cover" />
      )}
    </div>
  );
}
