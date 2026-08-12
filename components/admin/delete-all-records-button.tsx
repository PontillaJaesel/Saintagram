"use client";

import { useState } from "react";
import { ShieldAlert, Trash2 } from "lucide-react";
import { adminFetch } from "@/lib/admin-api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/providers/toast-provider";

const CONFIRMATION = "DELETE ALL RECORDS";

export function DeleteAllRecordsButton() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const { notify } = useToast();

  const close = () => { if (!busy) { setOpen(false); setConfirmation(""); } };
  const remove = async () => {
    if (confirmation !== CONFIRMATION || busy) return;
    setBusy(true);
    try {
      const result = await adminFetch<{ firestoreRecords: number; mediaFiles: number; userAccounts: number }>("/api/admin/delete-all-records", { method: "POST", body: JSON.stringify({ confirmation }) });
      notify(`Deleted ${result.userAccounts} user accounts, ${result.firestoreRecords} Firestore records, and ${result.mediaFiles} media files.`);
      close();
      window.location.assign("/admin");
    } catch (error) {
      notify(error instanceof Error ? error.message : "All records could not be deleted.", "error");
    } finally {
      setBusy(false);
    }
  };

  return <>
    <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-clay-700 transition hover:bg-clay-50" type="button" onClick={() => setOpen(true)}><Trash2 className="size-4" />Delete All Records</button>
    <ConfirmDialog open={open} title="Delete all user records?" description="This permanently deletes every non-admin user account, all application records in Firestore, and all non-admin profile and reflection media in Firebase Storage. This cannot be undone." confirmLabel="Delete everything" destructive busy={busy} onClose={close} onConfirm={() => void remove()} headerIcon={<span className="grid size-12 place-items-center rounded-full bg-clay-100 text-clay-700"><ShieldAlert /></span>}>
      <label className="label" htmlFor="delete-all-confirmation">Type <strong>{CONFIRMATION}</strong> to continue</label>
      <input id="delete-all-confirmation" className="field mt-2 w-full" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
      {confirmation && confirmation !== CONFIRMATION && <p className="mt-2 text-xs font-semibold text-clay-700">The confirmation text does not match.</p>}
    </ConfirmDialog>
  </>;
}
