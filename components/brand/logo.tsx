import Link from "next/link";

export function Logo({
  compact = false,
  href = "/",
}: {
  compact?: boolean;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl text-ink"
      aria-label="Saintagram Home"
    >
      {/* Saintagram Logo */}
      <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl">
        <img
          src="/Saintagram_Logo.png"
          alt="Saintagram Logo"
          className="h-full w-full object-contain"
        />
      </span>

      {/* Brand Name */}
      {!compact && (
        <span className="font-serif text-xl font-bold tracking-tight">
          Saintagram
        </span>
      )}
    </Link>
  );
}