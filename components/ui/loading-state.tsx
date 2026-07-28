import { LoaderCircle } from "lucide-react";

export function LoadingState({
  label = "Preparing your space…",
  fullPage = false
}: {
  label?: string;
  fullPage?: boolean;
}) {
  return (
    <div
      className={`grid place-items-center px-6 text-center ${
        fullPage ? "min-h-screen" : "min-h-64"
      }`}
      role="status"
      aria-live="polite"
    >
      <div>
        <LoaderCircle
          className="mx-auto mb-3 size-7 animate-spin text-sage-600"
          aria-hidden="true"
        />
        <p className="text-sm font-semibold text-muted">{label}</p>
      </div>
    </div>
  );
}
