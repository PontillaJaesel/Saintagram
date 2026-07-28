"use client";

import { HardDrive, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

export function ModeBadge({ expanded = false }: { expanded?: boolean }) {
  const { mode } = useAuth();
  const isLocal = mode === "local";
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
        isLocal
          ? "border-gold-200 bg-gold-50 text-gold-700"
          : "border-sage-200 bg-sage-50 text-sage-700"
      }`}
      title={
        isLocal
          ? "Firebase is not configured. Data stays in this browser."
          : "Connected to Firebase"
      }
    >
      {isLocal ? (
        <HardDrive className="size-3.5" aria-hidden="true" />
      ) : (
        <ShieldCheck className="size-3.5" aria-hidden="true" />
      )}
      <span>{isLocal ? "Private demo" : "Firebase protected"}</span>
      {expanded && isLocal && (
        <span className="hidden font-medium sm:inline">
          · saved on this device
        </span>
      )}
    </div>
  );
}
