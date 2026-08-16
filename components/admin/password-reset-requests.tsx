"use client";
import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/providers/toast-provider";

type ResetRequest = { id: string; username: string; status: string; requestedAt: string; reviewedAt: string | null };

export function PasswordResetRequests() {
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ResetRequest | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [busy, setBusy] = useState(false);
  const { notify } = useToast();
  const load = () => void adminFetch<{ requests: ResetRequest[] }>("/api/admin/password-reset-requests").then((data) => setRequests(data.requests)).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load requests."));
  useEffect(load, []);
  const decide = () => {
    if (!selected) return;
    setBusy(true);
    void adminFetch(`/api/admin/password-reset-requests/${selected.id}`, { method: "POST", body: JSON.stringify({ decision }) })
      .then(() => { notify(decision === "approve" ? "Password reset approved." : "Password reset rejected."); setSelected(null); load(); })
      .catch((actionError) => notify(actionError instanceof Error ? actionError.message : "The request could not be reviewed.", "error"))
      .finally(() => setBusy(false));
  };
  return <><div className="mb-6"><p className="eyebrow">Administration</p><h1 className="mt-2 font-serif text-3xl font-bold">Password Reset Requests</h1><p className="mt-1 text-sm text-muted">Approve or reject issued-account password recovery.</p></div>{error ? <p className="surface p-5 text-clay-600">{error}</p> : <div className="surface overflow-x-auto p-5"><table className="w-full text-left text-sm"><thead><tr><th>Username</th><th>Requested</th><th>Status</th><th /></tr></thead><tbody>{requests.map((item) => <tr className="border-t border-sage-100" key={item.id}><td className="py-4 font-bold">{item.username}</td><td>{item.requestedAt ? new Date(item.requestedAt).toLocaleString() : "Pending"}</td><td className="capitalize">{item.status}</td><td className="flex justify-end gap-2 py-2">{item.status === "pending" && <><button className="btn-primary" onClick={() => { setSelected(item); setDecision("approve"); }}>Approve</button><button className="btn-secondary" onClick={() => { setSelected(item); setDecision("reject"); }}>Reject</button></>}</td></tr>)}</tbody></table>{!requests.length && <p className="py-8 text-center text-muted">No password reset requests.</p>}</div>}<ConfirmDialog open={Boolean(selected)} title={decision === "approve" ? "Approve password reset?" : "Reject password reset?"} description={decision === "approve" ? `Reset ${selected?.username} to its issued default password and require a new password at next login.` : `Reject the request from ${selected?.username}.`} confirmLabel={decision === "approve" ? "Approve reset" : "Reject request"} destructive={decision === "reject"} busy={busy} onClose={() => setSelected(null)} onConfirm={decide} /></>;
}
