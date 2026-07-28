import { SymbolIcon } from "@/components/ui/symbol-icon";
import type { SpiritualSymbol } from "@/types";

export function ProfileAvatar({
  imageUrl,
  symbol,
  profileName,
  size = "large"
}: {
  imageUrl: string;
  symbol: SpiritualSymbol;
  profileName: string;
  size?: "small" | "medium" | "large";
}) {
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
      {imageUrl ? (
        // The source is selected by the owner or returned by their Firebase bucket.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={`${profileName || "Saintagram"} profile`}
          className="h-full w-full object-cover"
        />
      ) : (
        <SymbolIcon symbol={symbol} className={iconSizes[size]} />
      )}
    </div>
  );
}
