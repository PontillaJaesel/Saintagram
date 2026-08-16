"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, Clock3, RefreshCw, RotateCcw } from "lucide-react";
import { adminFetch } from "@/lib/admin-api";
import { useToast } from "@/components/providers/toast-provider";
import type { SystemNotification } from "@/types";

type NotificationData = { notifications: SystemNotification[]; users: Record<string, string> };
const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown time"
    : new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(date);
};

export function AdminNotifications() {
  const [data, setData] = useState<NotificationData | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"all" | "unread" | "read">("all");
  const [resendingId, setResendingId] = useState<string | null>(null);
  const { notify } = useToast();
  const load = useCallback(() => { setError(""); void adminFetch<NotificationData>("/api/admin/notifications").then(setData).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load notifications.")); }, []);
  useEffect(load, [load]);
  const notifications = useMemo(() => (data?.notifications ?? []).filter((item) => status === "all" || (status === "read" ? Boolean(item.readAt) : !item.readAt)), [data, status]);
  const unreadCount = data?.notifications.filter((item) => !item.readAt).length ?? 0;
  const resend = (item: SystemNotification) => { setResendingId(item.id); void adminFetch(`/api/admin/notifications/${encodeURIComponent(item.id)}/resend`, { method: "POST" }).then(() => { notify(`Notification resent to ${data?.users[item.userId] ?? "the user"}.`); load(); }).catch((cause) => notify(cause instanceof Error ? cause.message : "Could not resend notification.", "error")).finally(() => setResendingId(null)); };

  return <>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Administration</p><h1 className="mt-2 font-serif text-3xl font-bold">Notifications</h1><p className="mt-1 text-sm text-muted">Review delivery status and resend unread reminders.</p></div><button className="btn-secondary" type="button" onClick={load}><RefreshCw className="size-4" />Refresh</button></div>
    <section className="surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-sage-100 p-5"><div><h2 className="font-serif text-xl font-bold">Notification history</h2><p className="mt-1 text-sm text-muted">{unreadCount} unread notification{unreadCount === 1 ? "" : "s"}</p></div><label className="flex items-center gap-2 text-sm font-semibold">Status<select className="field min-w-32 py-2" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">All</option><option value="unread">Unread</option><option value="read">Read</option></select></label></div>
      {!data ? <p className="p-8 text-center text-muted">{error || "Loading notifications…"}</p> : <div className="divide-y divide-sage-100">
        {notifications.map((item) => { const read = Boolean(item.readAt); return <article className={`grid gap-4 p-5 transition-colors lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center ${read ? "bg-transparent" : "bg-gold-50/40"}`} key={item.id}>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`grid size-9 shrink-0 place-items-center rounded-full ${read ? "bg-sage-50 text-muted" : "bg-gold-100 text-gold-700"}`}><Bell className="size-4" /></span><h3 className="font-bold">{data.users[item.userId] ?? "Unknown user"}</h3><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${read ? "bg-sage-50 text-sage-700" : "bg-gold-100 text-gold-800"}`}>{read ? <CheckCircle2 className="size-3.5" /> : <Clock3 className="size-3.5" />}{read ? "Read" : "Unread"}</span></div>
            <p className="mt-3 font-semibold">{item.title}</p><p className="mt-1 text-sm leading-6 text-muted">{item.message}</p>{item.missingFields.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{item.missingFields.map((field) => <span className="rounded-full border border-sage-100 px-2.5 py-1 text-xs text-muted" key={field}>{field}</span>)}</div>}<p className="mt-3 text-xs text-muted">Sent {formatDate(item.createdAt)}</p></div>
          <div className="flex lg:justify-end">{!read ? <button className="btn-secondary whitespace-nowrap" type="button" disabled={resendingId === item.id} onClick={() => resend(item)}><RotateCcw className={`size-4 ${resendingId === item.id ? "animate-spin" : ""}`} />{resendingId === item.id ? "Resending…" : "Resend"}</button> : <span className="text-xs text-muted">Read {item.readAt ? formatDate(item.readAt) : ""}</span>}</div>
        </article>; })}{!notifications.length && <p className="p-8 text-center text-muted">No {status === "all" ? "" : `${status} `}notifications found.</p>}
      </div>}
    </section>
  </>;
}
