"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, LoaderCircle, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { adminDownload, adminFetch } from "@/lib/admin-api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/providers/toast-provider";
import type { AdminUserSummary } from "@/types";

const formatDate = (value: string) => value ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(value)) : "—";

export function UserDataIndex() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const { notify } = useToast();

  const load = () => { setError(""); void adminFetch<{ users: AdminUserSummary[] }>("/api/admin/users").then((result) => setUsers(result.users)).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Users could not be loaded.")); };
  useEffect(load, []);
  useEffect(() => { const userId = searchParams.get("userId"); if (userId) router.replace(`/admin/data/${encodeURIComponent(userId)}`); }, [router, searchParams]);

  const exportAll = async () => {
    setExporting(true);
    try {
      const blob = await adminDownload("/api/admin/export", { include: [] });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `saintagram-all-user-data-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click(); URL.revokeObjectURL(link.href);
      notify("All user data exported. Each user has a separate worksheet.");
    } catch (exportError) { notify(exportError instanceof Error ? exportError.message : "The export could not be generated.", "error"); }
    finally { setExporting(false); }
  };

  const closeDelete = () => { if (!deleting) { setDeleteOpen(false); setConfirmation(""); } };
  const toggleUser = (userId: string) => setSelectedUserIds((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]);
  const deleteUsers = async () => {
    if (!selectedUserIds.length || confirmation !== "DELETE USERS" || deleting) return;
    setDeleting(true);
    try {
      const result = await adminFetch<{ firestoreRecords: number; mediaFiles: number; userAccounts: number; selectedUsers: number }>("/api/admin/users/delete", { method: "POST", body: JSON.stringify({ confirmation, userIds: selectedUserIds }) });
      setUsers((current) => current?.filter((user) => !selectedUserIds.includes(user.id)) ?? []);
      setSelectedUserIds([]); setSelectionMode(false); setDeleteOpen(false); setConfirmation("");
      notify(`Permanently deleted ${result.selectedUsers} selected user${result.selectedUsers === 1 ? "" : "s"}, ${result.firestoreRecords} Firestore records, and ${result.mediaFiles} media files.`);
    } catch (deleteError) { notify(deleteError instanceof Error ? deleteError.message : "The selected users could not be deleted.", "error"); }
    finally { setDeleting(false); }
  };

  return <>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div><p className="eyebrow">Administration</p><h1 className="mt-2 font-serif text-3xl font-bold">User Data</h1><p className="mt-1 text-sm text-muted">Preview users and open a clean, complete record for each account.</p></div>
      <div className="flex flex-wrap gap-3"><button className="btn-primary" type="button" disabled={exporting || !users?.length} onClick={() => void exportAll()}>{exporting ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}{exporting ? "Exporting…" : "Export All User Data"}</button><button className="btn-secondary" type="button" onClick={load}><RefreshCw className="size-4" />Refresh</button></div>
    </div>
    {error && <p className="rounded-xl bg-clay-50 p-3 text-sm text-clay-700" role="alert">{error}</p>}
    {!users ? <div className="surface p-8 text-center text-muted">Loading users…</div> : <section className="surface overflow-x-auto p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-serif text-xl font-bold">All users</h2>{selectionMode && <p className="mt-1 text-sm text-muted">{selectedUserIds.length} selected · Administrator accounts are protected.</p>}</div>
        <div className="flex flex-wrap gap-2"><button className="btn-secondary" type="button" onClick={() => { setSelectionMode((current) => !current); setSelectedUserIds([]); }}>{selectionMode ? "Cancel selection" : "Select"}</button>{selectionMode && <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-clay-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-clay-500 disabled:opacity-50" type="button" disabled={!selectedUserIds.length} onClick={() => setDeleteOpen(true)}><Trash2 className="size-4" />Delete selected ({selectedUserIds.length})</button>}</div>
      </div>
      <table className="w-full min-w-[50rem] text-left text-sm">
        <thead><tr className="text-muted">{selectionMode && <th className="w-12"><input type="checkbox" className="size-4 accent-clay-600" aria-label="Select all users" checked={users.length > 0 && selectedUserIds.length === users.length} onChange={(event) => setSelectedUserIds(event.target.checked ? users.map((user) => user.id) : [])} /></th>}<th>Display name</th><th>Username</th><th>Account</th><th>Joined</th><th>Profile</th><th /></tr></thead>
        <tbody>{users.map((user) => <tr className={`border-t border-sage-100 ${selectedUserIds.includes(user.id) ? "bg-clay-50/40" : ""}`} key={user.id}>{selectionMode && <td><input type="checkbox" className="size-4 accent-clay-600" aria-label={`Select ${user.name}`} checked={selectedUserIds.includes(user.id)} onChange={() => toggleUser(user.id)} /></td>}<td className="py-4 font-semibold">{user.name}</td><td>{user.email || "Guest account"}</td><td className="capitalize">{user.authProvider}</td><td>{formatDate(user.createdAt)}</td><td>{user.profileCompleted ? "Completed" : "Not completed"}</td><td className="py-3 text-right"><Link className="btn-secondary whitespace-nowrap" href={`/admin/data/${encodeURIComponent(user.id)}`}>View All Recorded Data</Link></td></tr>)}</tbody>
      </table>
      {!users.length && <p className="py-8 text-center text-muted">No users have been recorded yet.</p>}
    </section>}
    <ConfirmDialog open={deleteOpen} title={`Permanently delete ${selectedUserIds.length} selected user${selectedUserIds.length === 1 ? "" : "s"}?`} description="This permanently removes every selected account, all matching application records from Firebase Firestore, and all profile and reflection media from Firebase Storage. This cannot be undone." confirmLabel="Permanently delete selected users" destructive busy={deleting} onClose={closeDelete} onConfirm={() => void deleteUsers()} headerIcon={<span className="grid size-12 place-items-center rounded-full bg-clay-100 text-clay-700"><ShieldAlert /></span>}>
      <label className="block text-sm font-bold" htmlFor="delete-user-confirmation">Type <strong>DELETE USERS</strong> to continue</label><input id="delete-user-confirmation" className="field mt-2 w-full" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />{confirmation && confirmation !== "DELETE USERS" && <p className="mt-2 text-xs font-semibold text-clay-700">The confirmation text does not match.</p>}
    </ConfirmDialog>
  </>;
}
