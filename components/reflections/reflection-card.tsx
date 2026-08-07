"use client";

import { CalendarDays, Edit3, LockKeyhole, Trash2 } from "lucide-react";
import { formatFriendlyDate } from "@/lib/validation";
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
    <article className="rounded-[var(--radius-card)] border border-sage-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-base)] bg-sage-100 text-sage-700">
          {post.isPrivate ? (
            <LockKeyhole className="size-4" aria-hidden="true" />
          ) : (
            <span className="text-lg" aria-hidden="true">
              ✦
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
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
          {post.title && (
            <h3 className="user-content mt-2 text-base font-bold text-ink">
              {post.title}
            </h3>
          )}
          <p className="user-content mt-3 whitespace-pre-wrap text-base leading-7 text-ink">
            {post.content}
          </p>
        </div>
      </div>
      {showActions && (
        <div className="mt-4 flex justify-end gap-1 border-t border-sage-100 pt-3">
          <button
            type="button"
            className="btn-quiet"
            onClick={() => onEdit?.(post)}
          >
            <Edit3 className="size-4" aria-hidden="true" />
            Edit
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-clay-600 hover:bg-clay-50"
            onClick={() => onDelete?.(post)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete
          </button>
        </div>
      )}
    </article>
  );
}
