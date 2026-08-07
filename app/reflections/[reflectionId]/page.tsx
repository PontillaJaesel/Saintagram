"use client";

import {
  useParams
} from "next/navigation";

import { RouteGuard } from "@/components/auth/route-guard";
import { AppShell } from "@/components/layout/app-shell";

import { ReflectionDetailView } from "@/components/social/reflection-detail-view";

export default function ReflectionPage() {
  const params =
    useParams<{
      reflectionId: string;
    }>();

  const reflectionId =
    typeof params.reflectionId ===
    "string"
      ? params.reflectionId
      : "";

  return (
    <RouteGuard requireProfile>
      <AppShell
        title="Reflection"
        description="A shared reflection and its conversation."
      >
        <ReflectionDetailView
          reflectionId={
            reflectionId
          }
        />
      </AppShell>
    </RouteGuard>
  );
}