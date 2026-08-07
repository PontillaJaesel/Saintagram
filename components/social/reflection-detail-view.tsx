"use client";

import {
  useEffect,
  useState
} from "react";

import Link from "next/link";

import {
  ArrowLeft
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";

import { SocialReflectionCard } from "@/components/social/social-reflection-card";

import { appService } from "@/lib/app-service";

import type {
  SocialFeedPost
} from "@/types";

export function ReflectionDetailView({
  reflectionId
}: {
  reflectionId: string;
}) {
  const { user } = useAuth();

  const [
    post,
    setPost
  ] =
    useState<SocialFeedPost | null>(
      null
    );

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    error,
    setError
  ] = useState("");

  useEffect(() => {
    if (
      !user ||
      !reflectionId
    ) {
      return;
    }

    let active = true;

    const loadReflection =
      async () => {
        setLoading(true);
        setError("");

        try {
          const nextPost =
            await appService
              .getPublicReflectionById(
                reflectionId
              );

          if (!active) {
            return;
          }

          setPost(nextPost);
        } catch (loadError) {
          if (!active) {
            return;
          }

          setError(
            loadError instanceof Error
              ? loadError.message
              : "This reflection could not be loaded."
          );
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

    void loadReflection();

    return () => {
      active = false;
    };
  }, [
    reflectionId,
    user?.id
  ]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="surface p-8 text-center">
          <p className="text-sm font-semibold text-muted">
            Opening reflection…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link
          href="/community"
          className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-sage-700 transition hover:text-sage-800"
        >
          <ArrowLeft
            className="size-4"
            aria-hidden="true"
          />

          Back to Community
        </Link>

        <div
          className="surface p-8 text-center"
          role="alert"
        >
          <p className="font-bold text-clay-600">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link
          href="/community"
          className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-sage-700 transition hover:text-sage-800"
        >
          <ArrowLeft
            className="size-4"
            aria-hidden="true"
          />

          Back to Community
        </Link>

        <div className="surface p-8 text-center">
          <h2 className="font-serif text-xl font-bold text-ink">
            Reflection unavailable
          </h2>

          <p className="mt-2 text-sm leading-6 text-muted">
            This reflection may have
            been deleted, made private,
            or is no longer available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/community"
        className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-sage-700 transition hover:text-sage-800"
      >
        <ArrowLeft
          className="size-4"
          aria-hidden="true"
        />

        Back to Community
      </Link>

      <SocialReflectionCard
        post={post}
        initialCommentsOpen
      />
    </div>
  );
}