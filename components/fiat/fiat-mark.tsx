import { useId } from "react";

export function FiatMark({
  className = ""
}: {
  className?: string;
}) {
  const gradientId = useId().replace(/:/g, "");

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="8" y1="10" x2="54" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff2d2d" />
          <stop offset="0.55" stopColor="#ff6a1a" />
          <stop offset="1" stopColor="#ffbe24" />
        </linearGradient>
      </defs>

      <path
        d="M32 5.5C16.7 5.5 5 16.6 5 31.9c0 15.7 11.8 26.6 27 26.6 7.3 0 14.2-2.5 19.7-7.1l-4.5-5.3c-4.2 3.4-9.3 5.2-15.2 5.2-11.2 0-19.7-7.9-19.7-19.4 0-11.1 8.3-19.2 19.7-19.2 11.7 0 19.7 7.5 19.7 17.6 0 6.8-3 11.5-7.1 11.5-2.2 0-3.3-1.3-3-4.1l1.6-16.2h-7.5l-.5 3c-2.1-2.6-5.2-4-8.8-4-7.4 0-13.4 6.2-13.4 14.3 0 7.7 5.2 12.9 12.2 12.9 4 0 7.3-1.7 9.6-4.7 1.3 4 4.7 6.1 9.3 6.1 9 0 15.7-7.5 15.7-18.8C59 16.1 48.3 5.5 32 5.5Z"
        fill={`url(#${gradientId})`}
      />

      <path
        d="M28.6 15.5h6.8v10.2h9.4v6.7h-9.4v15.2h-6.8V32.4h-9.3v-6.7h9.3V15.5Z"
        fill="#fff"
      />
    </svg>
  );
}
