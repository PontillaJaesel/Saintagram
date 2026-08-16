"use client";

import { CalendarDays, LockKeyhole } from "lucide-react";
import { ReflectionOwnerMenu } from "@/components/reflections/reflection-owner-menu";
import { formatFriendlyDate } from "@/lib/validation";
import { fiatCategoryLabel } from "@/lib/fiat";
import { ReflectionMediaView } from "@/components/reflections/reflection-media-view";
import type { ReflectionPost } from "@/types";

export function ReflectionCard({
  post,
  showActions = false,
  showPrivacy = true,
  showDate = true,
  onEdit,
  onDelete
}: {
  post: ReflectionPost;
  showActions?: boolean;
  showPrivacy?: boolean;
  showDate?: boolean;
  onEdit?: (post: ReflectionPost) => void;
  onDelete?: (post: ReflectionPost) => void;
}) {
  return (
    <article className="relative rounded-[var(--radius-card)] border border-sage-100 bg-white p-5 shadow-sm sm:p-6">
      {showActions && (
        <div className="absolute right-3 top-3">
          <ReflectionOwnerMenu
            onEdit={
              onEdit
                ? () => onEdit(post)
                : undefined
            }
            onDelete={
              onDelete
                ? () => onDelete(post)
                : undefined
            }
          />
        </div>
      )}
      <div className="flex items-start gap-4">
        <div className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-base)] bg-sage-100 text-sage-700">
          {post.isPrivate ? (
            <LockKeyhole className="size-4" aria-hidden="true" />
          ) : (
            <span className="text-lg" aria-hidden="true">
              ✦
            </span>
          )}
        </div>
        <div
          className={`min-w-0 flex-1 ${
            showActions ? "pr-10" : ""
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            {showDate && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                <time dateTime={post.createdAt}>
                  {formatFriendlyDate(post.createdAt)}
                </time>
              </span>
            )}
            {showPrivacy && post.isPrivate && (
              <span className="rounded-full bg-clay-50 px-2.5 py-1 font-bold text-clay-600">
                Private
              </span>
            )}
            {post.editedAt && (
              <span aria-label="This reflection was edited">Edited</span>
            )}
          </div>
          {(post.title || post.fiatCategory) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {post.title && <h3 className="user-content text-[15px] font-bold leading-6 text-ink">{post.title}</h3>}
              {post.fiatCategory && (
                <span className="inline-flex rounded-full border border-gold-200 bg-gold-50 px-2 py-0.5 text-[10px] font-bold leading-4 text-gold-700">
                  Fi@ · {post.fiatCategory === "other" && post.fiatOther ? post.fiatOther : fiatCategoryLabel(post.fiatCategory)}
                </span>
              )}
            </div>
          )}
          <p className={`user-content whitespace-pre-wrap text-[15px] leading-6 text-ink ${post.title || post.fiatCategory ? "mt-1" : "mt-2"}`}>
            {post.content}
          </p>
          <ReflectionMediaView media={post.media} compact />
        </div>
      </div>
    </article>
  );
}
