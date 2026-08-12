"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, LoaderCircle, RefreshCw } from "lucide-react";
import { adminDownload, adminFetch } from "@/lib/admin-api";
import { useToast } from "@/components/providers/toast-provider";
import type { AdminUserSummary } from "@/types";

const formatDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(value))
    : "—";

export function UserDataIndex() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const { notify } = useToast();

  const load = () => {
    setError("");
    void adminFetch<{ users: AdminUserSummary[] }>("/api/admin/users")
      .then((result) => setUsers(result.users))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Users could not be loaded."));
  };

  useEffect(load, []);
  useEffect(() => {
    const userId = searchParams.get("userId");
    if (userId) router.replace(`/admin/data/${encodeURIComponent(userId)}`);
  }, [router, searchParams]);

  const exportAll = async () => {
    setExporting(true);
    try {
      const blob = await adminDownload("/api/admin/export", { include: [] });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `saintagram-all-user-data-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
      notify("All user data exported. Each user has a separate worksheet.");
    } catch (exportError) {
      notify(exportError instanceof Error ? exportError.message : "The export could not be generated.", "error");
    } finally {
      setExporting(false);
    }
  };

  return <>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div><p className="eyebrow">Administration</p><h1 className="mt-2 font-serif text-3xl font-bold">User Data</h1><p className="mt-1 text-sm text-muted">Preview users and open a clean, complete record for each account.</p></div>
      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" type="button" disabled={exporting || !users?.length} onClick={() => void exportAll()}>{exporting ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}{exporting ? "Exporting…" : "Export All User Data"}</button>
        <button className="btn-secondary" type="button" onClick={load}><RefreshCw className="size-4" />Refresh</button>
      </div>
    </div>
    {error && <p className="rounded-xl bg-clay-50 p-3 text-sm text-clay-700" role="alert">{error}</p>}
    {!users ? <div className="surface p-8 text-center text-muted">Loading users…</div> : <section className="surface overflow-x-auto p-5">
      <table className="w-full min-w-[50rem] text-left text-sm">
        <thead><tr className="text-muted"><th>Display name</th><th>Username</th><th>Account</th><th>Joined</th><th>Profile</th><th /></tr></thead>
        <tbody>{users.map((user) => <tr className="border-t border-sage-100" key={user.id}><td className="py-4 font-semibold">{user.name}</td><td>{user.email || "Guest account"}</td><td className="capitalize">{user.authProvider}</td><td>{formatDate(user.createdAt)}</td><td>{user.profileCompleted ? "Completed" : "Not completed"}</td><td className="py-3 text-right"><Link className="btn-secondary whitespace-nowrap" href={`/admin/data/${encodeURIComponent(user.id)}`}>View All Recorded Data</Link></td></tr>)}</tbody>
      </table>
      {!users.length && <p className="py-8 text-center text-muted">No users have been recorded yet.</p>}
    </section>}
  </>;
}
