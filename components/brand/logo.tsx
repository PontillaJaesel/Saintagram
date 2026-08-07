import Link from "next/link";
import { Sparkles } from "lucide-react";

export function Logo({
  compact = false,
  href = "/"
}: {
  compact?: boolean;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl text-ink"
      aria-label="Saintagram home"
    >
      <span className="relative grid size-9 place-items-center rounded-xl bg-sage-700 text-white shadow-sm">
        <span
                  className="absolute h-5 w-0.5 rounded-full bg-gray-200"
          aria-hidden="true"
        />
        <span
                  className="absolute h-0.5 w-5 rounded-full bg-gray-200"
          aria-hidden="true"
        />
        <Sparkles
                  className="absolute -right-1 -top-1 size-3.5 text-gold-300"
          fill="currentColor"
          aria-hidden="true"
        />
      </span>
      {!compact && (
        <span className="font-serif text-xl font-bold tracking-tight">
          Saintagram
        </span>
      )}
    </Link>
  );
}
