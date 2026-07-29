import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessGate } from "@/components/access/access-gate";

export const metadata: Metadata = {
  title: "Private access",
  description: "Enter your invitation code to open Saintagram."
};

export default function AccessPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center px-5">
          <p className="text-sm font-semibold text-muted">
            Preparing the private entrance…
          </p>
        </main>
      }
    >
      <AccessGate />
    </Suspense>
  );
}
