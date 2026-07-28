import {
  Cross,
  Flame,
  HandHeart,
  Heart,
  Milestone,
  Sprout,
  UserRound
} from "lucide-react";
import type { SpiritualSymbol } from "@/types";

export function SymbolIcon({
  symbol,
  className = "size-6"
}: {
  symbol: SpiritualSymbol;
  className?: string;
}) {
  const props = { className, "aria-hidden": true } as const;
  switch (symbol) {
    case "candle":
      return <Flame {...props} />;
    case "seed":
      return <Sprout {...props} />;
    case "cross":
      return <Cross {...props} />;
    case "heart":
      return <Heart {...props} />;
    case "open-hands":
      return <HandHeart {...props} />;
    case "road":
      return <Milestone {...props} />;
    default:
      return <UserRound {...props} />;
  }
}
