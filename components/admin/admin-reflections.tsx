"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BookOpenText, Pencil, Plus, Search, Send, Trash2, X } from "lucide-react";
import { adminFetch } from "@/lib/admin-api";
import { useToast } from "@/components/providers/toast-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ReflectionMediaPicker } from "@/components/reflections/reflection-media-picker";
import { ReflectionMediaView } from "@/components/reflections/reflection-media-view";
import { getFirebaseServices } from "@/lib/firebase";
import { LIMITS } from "@/lib/constants";
import { deleteReflectionMedia, reflectionMediaId, uploadReflectionMedia, validateReflectionMedia } from "@/lib/reflection-media";
import type { ReflectionPost } from "@/types";

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value));
}

export function AdminReflections() {
  const [reflections, setReflections] = useState<ReflectionPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [editing, setEditing] = useState<ReflectionPost | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editMediaFiles, setEditMediaFiles] = useState<File[]>([]);
  const [deleting, setDeleting] = useState<ReflectionPost | null>(null);
  const composerRef = useRef<HTMLElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { notify } = useToast();

  const load = async () => {
    setListError("");
    try {
      const result = await adminFetch<{ reflections: ReflectionPost[] }>("/api/admin/reflections");
      setReflections(result.reflections);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Admin reflections could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!showComposer) return;
    window.requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
      titleInputRef.current?.focus({ preventScroll: true });
    });
  }, [showComposer]);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase();
    return query ? reflections.filter((reflection) => `${reflection.title ?? ""} ${reflection.content}`.toLocaleLowerCase().includes(query)) : reflections;
  }, [reflections, searchTerm]);

  const publish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setFormError("");
    try {
      await validateReflectionMedia(mediaFiles);
      const services = getFirebaseServices(); const adminId = services?.auth.currentUser?.uid;
      if (!adminId) throw new Error("Please sign in again before uploading media.");
      const reflectionId = reflectionMediaId();
      const media = mediaFiles.length ? await uploadReflectionMedia(adminId, reflectionId, mediaFiles) : [];
      const result = await adminFetch<{ reflectionId: string; notifiedUsers: number }>("/api/admin/reflections", { method: "POST", body: JSON.stringify({ reflectionId, title, content, media }) });
      setTitle(""); setContent(""); setMediaFiles([]); setShowComposer(false);
      await load();
      notify(`Reflection published and ${result.notifiedUsers} users notified.`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The reflection could not be published.");
    } finally { setBusy(false); }
  };

  const beginEdit = (reflection: ReflectionPost) => {
    setEditing(reflection); setEditTitle(reflection.title ?? ""); setEditContent(reflection.content); setEditMediaFiles([]); setFormError("");
  };

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || busy) return;
    setBusy(true); setFormError("");
    try {
      await validateReflectionMedia(editMediaFiles);
      const services = getFirebaseServices(); const adminId = services?.auth.currentUser?.uid;
      if (!adminId) throw new Error("Please sign in again before uploading media.");
      const media = editMediaFiles.length ? await uploadReflectionMedia(adminId, editing.id, editMediaFiles) : undefined;
      const result = await adminFetch<{ reflection: ReflectionPost }>(`/api/admin/reflections/${encodeURIComponent(editing.id)}`, { method: "PATCH", body: JSON.stringify({ title: editTitle, content: editContent, ...(media ? { media } : {}) }) });
      if (media && editing.media?.length) await deleteReflectionMedia(editing.media);
      setReflections((items) => items.map((item) => item.id === result.reflection.id ? result.reflection : item));
      setEditing(null); notify("Reflection updated.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The reflection could not be updated.");
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/reflections/${encodeURIComponent(deleting.id)}`, { method: "DELETE" });
      await deleteReflectionMedia(deleting.media ?? []);
      setReflections((items) => items.filter((item) => item.id !== deleting.id));
      setDeleting(null); notify("Reflection deleted.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "The reflection could not be deleted.", "error");
    } finally { setBusy(false); }
  };

  return <>
    <div className="mb-6"><p className="eyebrow">Administration</p><h1 className="mt-2 font-serif text-3xl font-bold">Public Reflections</h1><p className="mt-1 text-sm text-muted">Manage official Saintagram reflections and publish new messages to every user.</p></div>
    <div className={`grid items-start gap-6 ${showComposer ? "lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]" : ""}`}>
    <section className="surface min-w-0 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-serif text-2xl font-bold">Posted Reflections</h2><p className="mt-1 text-sm text-muted">{reflections.length} published reflection{reflections.length === 1 ? "" : "s"}</p></div><button className="btn-primary" type="button" onClick={() => setShowComposer((value) => !value)}><Plus className="size-4" />Post New Reflection</button></div>
      <form className="mt-5 flex gap-3" onSubmit={(event) => { event.preventDefault(); setSearchTerm(searchInput); }}><input className="field min-w-0 flex-1" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search reflections by title or content" aria-label="Search admin reflections" /><button className="btn-secondary" type="submit"><Search className="size-4" />Search</button>{searchTerm && <button className="btn-secondary" type="button" onClick={() => { setSearchInput(""); setSearchTerm(""); }}><X className="size-4" />Clear</button>}</form>
      {listError && <p className="mt-5 rounded-xl bg-clay-50 p-3 text-sm text-clay-700" role="alert">{listError}</p>}
      <div className="mt-6 space-y-4">{loading ? <p className="py-8 text-center text-muted">Loading reflections…</p> : filtered.length ? filtered.map((reflection) => <article className="rounded-2xl border border-sage-100 p-5" key={reflection.id}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 flex-1"><h3 className="font-serif text-xl font-bold">{reflection.title || "Untitled reflection"}</h3><p className="mt-1 text-xs text-muted">Published {dateLabel(reflection.createdAt)}{reflection.editedAt ? ` · Edited ${dateLabel(reflection.editedAt)}` : ""}</p><p className="mt-4 whitespace-pre-wrap text-sm leading-7">{reflection.content}</p><ReflectionMediaView media={reflection.media} compact /></div><div className="flex shrink-0 gap-2"><button className="btn-secondary" type="button" onClick={() => beginEdit(reflection)}><Pencil className="size-4" />Edit</button><button className="btn-secondary text-clay-700" type="button" onClick={() => setDeleting(reflection)}><Trash2 className="size-4" />Delete</button></div></div></article>) : <p className="py-8 text-center text-muted">{searchTerm ? "No reflections match your search." : "No admin reflections have been published yet."}</p>}</div>
    </section>
    {showComposer && <section ref={composerRef} className="surface scroll-mt-6 p-6 lg:sticky lg:top-6" aria-labelledby="new-reflection-title"><div className="flex items-center justify-between gap-3"><h2 id="new-reflection-title" className="font-serif text-2xl font-bold">New Reflection</h2><button type="button" className="rounded-lg p-2 text-muted transition hover:bg-sage-50 hover:text-ink" aria-label="Close new reflection" onClick={() => setShowComposer(false)}><X className="size-5" /></button></div><div className="mt-4 flex items-start gap-3 rounded-2xl bg-sage-50 p-4 text-sm text-muted"><BookOpenText className="mt-0.5 size-5 shrink-0 text-sage-700" /><p>This reflection will be public immediately and every existing user will receive a notification.</p></div><form className="mt-6 space-y-5" onSubmit={publish}><div><label className="block text-sm font-bold" htmlFor="admin-reflection-title">Title</label><input ref={titleInputRef} id="admin-reflection-title" className="field mt-2 w-full" maxLength={LIMITS.momentTitle} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional reflection title" /></div><div><div className="flex justify-between"><label className="block text-sm font-bold" htmlFor="admin-reflection-content">Reflection</label><span className="text-xs text-muted">{content.length}/500</span></div><textarea id="admin-reflection-content" className="field mt-2 min-h-52 w-full resize-y" maxLength={500} required value={content} onChange={(event) => setContent(event.target.value)} /></div><ReflectionMediaPicker files={mediaFiles} onChange={setMediaFiles} disabled={busy} />{formError && !editing && <p className="rounded-xl bg-clay-50 p-3 text-sm text-clay-700" role="alert">{formError}</p>}<div className="flex flex-wrap gap-3"><button className="btn-primary" disabled={busy || !content.trim()} type="submit"><Send className="size-4" />{busy ? "Publishing…" : "Publish and notify users"}</button><button className="btn-secondary" type="button" onClick={() => setShowComposer(false)}>Cancel</button></div></form></section>}
    </div>
    {editing && <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4"><section className="surface max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6" role="dialog" aria-modal="true" aria-labelledby="edit-reflection-title"><div className="flex items-center justify-between"><h2 id="edit-reflection-title" className="font-serif text-2xl font-bold">Edit Reflection</h2><button type="button" aria-label="Close edit reflection" onClick={() => setEditing(null)}><X /></button></div><form className="mt-6 space-y-5" onSubmit={saveEdit}><input className="field w-full" maxLength={LIMITS.momentTitle} value={editTitle} onChange={(event) => setEditTitle(event.target.value)} placeholder="Optional title" /><textarea className="field min-h-52 w-full resize-y" maxLength={500} required value={editContent} onChange={(event) => setEditContent(event.target.value)} /><ReflectionMediaView media={editing.media} compact /><ReflectionMediaPicker files={editMediaFiles} onChange={setEditMediaFiles} disabled={busy} />{formError && <p className="rounded-xl bg-clay-50 p-3 text-sm text-clay-700" role="alert">{formError}</p>}<div className="flex justify-end gap-3"><button className="btn-secondary" type="button" onClick={() => setEditing(null)}>Cancel</button><button className="btn-primary" disabled={busy || !editContent.trim()} type="submit">{busy ? "Saving…" : "Save changes"}</button></div></form></section></div>}
    <ConfirmDialog open={Boolean(deleting)} title="Delete this reflection?" description="The public reflection, its user notifications, likes, comments, and related activity notifications will be permanently deleted." confirmLabel="Delete reflection" onConfirm={() => void remove()} onClose={() => setDeleting(null)} busy={busy} />
  </>;
}
