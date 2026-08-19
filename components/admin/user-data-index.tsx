"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Download,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Trash2
} from "lucide-react";
import {
  adminDownload,
  adminFetch
} from "@/lib/admin-api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/providers/toast-provider";
import type { AdminUserSummary } from "@/types";

const formatDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeZone: "Asia/Manila"
      }).format(new Date(value))
    : "—";

const accountTypeLabel = (
  role: AdminUserSummary["accountRole"]
) => {
  switch (role) {
    case "tester":
      return "Tester";

    case "app_admin":
      return "Admin User";

    default:
      return "User";
  }
};

export function UserDataIndex() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [users, setUsers] =
    useState<AdminUserSummary[] | null>(null);

  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const [selectionMode, setSelectionMode] =
    useState(false);

  const [selectedUserIds, setSelectedUserIds] =
    useState<string[]>([]);

  const [deleteOpen, setDeleteOpen] =
    useState(false);

  const [confirmation, setConfirmation] =
    useState("");

  const [deleting, setDeleting] =
    useState(false);

  const { notify } = useToast();

  /* ==========================================================
     LOAD USERS
     ========================================================== */

  const load = () => {
    setError("");

    void adminFetch<{
      users: AdminUserSummary[];
    }>("/api/admin/users")
      .then((result) => {
        setUsers(result.users);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Users could not be loaded."
        );
      });
  };

  useEffect(() => {
    load();
  }, []);

  /*
   * Maintain compatibility with:
   *
   * /admin/data?userId=...
   *
   * and redirect it to the dedicated user data page.
   */
  useEffect(() => {
    const userId =
      searchParams.get("userId");

    if (userId) {
      router.replace(
        `/admin/data/${encodeURIComponent(
          userId
        )}`
      );
    }
  }, [router, searchParams]);

  /* ==========================================================
     EXPORT
     ========================================================== */

  const exportAll = async () => {
    setExporting(true);

    try {
      const blob = await adminDownload(
        "/api/admin/export",
        {
          include: []
        }
      );

      const link =
        document.createElement("a");

      link.href =
        URL.createObjectURL(blob);

      link.download =
        `saintagram-all-user-data-${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`;

      link.click();

      URL.revokeObjectURL(
        link.href
      );

      notify(
        "All user data exported. Each user has a separate worksheet."
      );
    } catch (exportError) {
      notify(
        exportError instanceof Error
          ? exportError.message
          : "The export could not be generated.",
        "error"
      );
    } finally {
      setExporting(false);
    }
  };

  /* ==========================================================
     SELECTION
     ========================================================== */

  const closeDelete = () => {
    if (deleting) {
      return;
    }

    setDeleteOpen(false);
    setConfirmation("");
  };

  const toggleUser = (
    userId: string
  ) => {
    setSelectedUserIds(
      (current) =>
        current.includes(userId)
          ? current.filter(
              (id) => id !== userId
            )
          : [...current, userId]
    );
  };

  const allSelected =
    Boolean(users?.length) &&
    users!.every((user) =>
      selectedUserIds.includes(
        user.id
      )
    );

  const toggleAllUsers = (
    checked: boolean
  ) => {
    if (!users) {
      return;
    }

    setSelectedUserIds(
      checked
        ? users.map(
            (user) => user.id
          )
        : []
    );
  };

  /* ==========================================================
     DELETE SELECTED
     ========================================================== */

  const deleteUsers = async () => {
    if (
      !selectedUserIds.length ||
      confirmation !==
        "DELETE USERS" ||
      deleting
    ) {
      return;
    }

    setDeleting(true);

    try {
      const result =
        await adminFetch<{
          firestoreRecords: number;
          mediaFiles: number;
          userAccounts: number;
          selectedUsers: number;
        }>(
          "/api/admin/users/delete",
          {
            method: "POST",
            body: JSON.stringify({
              confirmation,
              userIds:
                selectedUserIds
            })
          }
        );

      setUsers(
        (current) =>
          current?.filter(
            (user) =>
              !selectedUserIds.includes(
                user.id
              )
          ) ?? []
      );

      setSelectedUserIds([]);
      setSelectionMode(false);
      setDeleteOpen(false);
      setConfirmation("");

      notify(
        `Permanently deleted ${result.selectedUsers} selected user${
          result.selectedUsers === 1
            ? ""
            : "s"
        }, ${result.firestoreRecords} Firestore records, and ${result.mediaFiles} media files.`
      );
    } catch (deleteError) {
      notify(
        deleteError instanceof Error
          ? deleteError.message
          : "The selected users could not be deleted.",
        "error"
      );
    } finally {
      setDeleting(false);
    }
  };

  /* ==========================================================
     PAGE
     ========================================================== */

  return (
    <>
      {/* PAGE HEADER */}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            Administration
          </p>

          <h1 className="mt-2 font-serif text-3xl font-bold">
            User Data
          </h1>

          <p className="mt-1 text-sm text-muted">
            Preview users and open a
            clean, complete record for
            each account.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="btn-primary"
            type="button"
            disabled={
              exporting ||
              !users?.length
            }
            onClick={() =>
              void exportAll()
            }
          >
            {exporting ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}

            {exporting
              ? "Exporting…"
              : "Export All User Data"}
          </button>

          <button
            className="btn-secondary"
            type="button"
            onClick={load}
          >
            <RefreshCw className="size-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* ERROR */}

      {error && (
        <p
          className="mb-4 rounded-xl bg-clay-50 p-3 text-sm text-clay-700"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* LOADING */}

      {!users ? (
        <div className="surface p-8 text-center text-muted">
          Loading users…
        </div>
      ) : (
        <section className="surface overflow-hidden p-0">
          {/* TABLE HEADER / ACTIONS */}

          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-sage-100 px-5 py-5">
            <div>
              <h2 className="font-serif text-xl font-bold">
                All Users
              </h2>

              <p className="mt-1 text-sm text-muted">
                {users.length}{" "}
                {users.length === 1
                  ? "user"
                  : "users"}{" "}
                recorded
              </p>

              {selectionMode && (
                <p className="mt-1 text-xs text-muted">
                  {selectedUserIds.length}{" "}
                  selected
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => {
                  setSelectionMode(
                    (current) =>
                      !current
                  );

                  setSelectedUserIds(
                    []
                  );
                }}
              >
                {selectionMode
                  ? "Cancel Selection"
                  : "Select"}
              </button>

              {selectionMode && (
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-clay-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-clay-500 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={
                    !selectedUserIds.length
                  }
                  onClick={() =>
                    setDeleteOpen(true)
                  }
                >
                  <Trash2 className="size-4" />

                  Delete Selected (
                  {
                    selectedUserIds.length
                  }
                  )
                </button>
              )}
            </div>
          </div>

          {/* ==================================================
              USER TABLE
              ================================================== */}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] table-fixed border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-muted">
                  {selectionMode && (
                    <th className="w-[55px] px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        className="size-4 accent-clay-600"
                        aria-label="Select all users"
                        checked={
                          allSelected
                        }
                        onChange={(
                          event
                        ) =>
                          toggleAllUsers(
                            event.target
                              .checked
                          )
                        }
                      />
                    </th>
                  )}

                  <th className="w-[180px] px-4 py-4 font-semibold">
                    Default Name
                  </th>

                  <th className="w-[195px] px-4 py-4 font-semibold">
                    Display Name / User
                  </th>

                  <th className="w-[235px] px-4 py-4 font-semibold">
                    Email
                  </th>

                  <th className="w-[125px] px-4 py-4 font-semibold">
                    Account Type
                  </th>

                  <th className="w-[135px] px-4 py-4 font-semibold">
                    Joined
                  </th>

                  <th className="w-[135px] px-4 py-4 font-semibold">
                    Profile
                  </th>

                  <th className="w-[210px] px-4 py-4 text-right font-semibold">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {users.map(
                  (user) => {
                    const selected =
                      selectedUserIds.includes(
                        user.id
                      );

                    return (
                      <tr
                        key={user.id}
                        className={`border-t border-sage-100 transition-colors ${
                          selected
                            ? "bg-clay-50/40"
                            : "hover:bg-sage-50/30"
                        }`}
                      >
                        {/* SELECTION */}

                        {selectionMode && (
                          <td className="px-4 py-4 text-center align-middle">
                            <input
                              type="checkbox"
                              className="size-4 accent-clay-600"
                              aria-label={`Select ${
                                user.fullName ||
                                user.displayName ||
                                user.username
                              }`}
                              checked={
                                selected
                              }
                              onChange={() =>
                                toggleUser(
                                  user.id
                                )
                              }
                            />
                          </td>
                        )}

                        {/* DEFAULT NAME */}

                        <td className="px-4 py-4 align-middle">
                          <div className="break-words font-semibold leading-5">
                            {user.fullName ||
                              "—"}
                          </div>
                        </td>

                        {/* DISPLAY NAME + USERNAME */}

                        <td className="px-4 py-4 align-middle">
                          <div className="break-words font-semibold leading-5">
                            {user.displayName ||
                              "No display name yet"}
                          </div>

                          <div className="mt-1 text-xs uppercase tracking-[0.12em] text-muted">
                            {user.username ||
                              "No username"}
                          </div>
                        </td>

                        {/* EMAIL */}

                        <td className="px-4 py-4 align-middle">
                          <span
                            className="whitespace-nowrap"
                            title={
                              user.email ||
                              ""
                            }
                          >
                            {user.email ||
                              "—"}
                          </span>
                        </td>

                        {/* ACCOUNT TYPE */}

                        <td className="px-4 py-4 align-middle">
                          <span className="inline-flex whitespace-nowrap rounded-full border border-sage-100 bg-sage-50 px-2.5 py-1 text-xs font-semibold">
                            {accountTypeLabel(
                              user.accountRole
                            )}
                          </span>
                        </td>

                        {/* JOINED */}

                        <td className="px-4 py-4 align-middle">
                          <span className="whitespace-nowrap">
                            {formatDate(
                              user.createdAt
                            )}
                          </span>
                        </td>

                        {/* PROFILE */}

                        <td className="px-4 py-4 align-middle">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                              user.profileCompleted
                                ? "bg-sage-50 text-sage-700"
                                : "bg-clay-50 text-clay-700"
                            }`}
                          >
                            {user.profileCompleted
                              ? "Completed"
                              : "Not completed"}
                          </span>
                        </td>

                        {/* ACTION */}

                        <td className="px-4 py-4 text-right align-middle">
                          <Link
                            className="btn-secondary inline-flex whitespace-nowrap"
                            href={`/admin/data/${encodeURIComponent(
                              user.id
                            )}`}
                          >
                            View All Recorded Data
                          </Link>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>

          {!users.length && (
            <p className="px-5 py-10 text-center text-muted">
              No users have been
              recorded yet.
            </p>
          )}
        </section>
      )}

      {/* ======================================================
          DELETE CONFIRMATION
          ====================================================== */}

      <ConfirmDialog
        open={deleteOpen}
        title={`Permanently delete ${selectedUserIds.length} selected user${
          selectedUserIds.length ===
          1
            ? ""
            : "s"
        }?`}
        description="This permanently removes every selected account, all matching application records from Firebase Firestore, and all profile and reflection media from Firebase Storage. This cannot be undone."
        confirmLabel="Permanently delete selected users"
        destructive
        busy={deleting}
        onClose={closeDelete}
        onConfirm={() =>
          void deleteUsers()
        }
        headerIcon={
          <span className="grid size-12 place-items-center rounded-full bg-clay-100 text-clay-700">
            <ShieldAlert />
          </span>
        }
      >
        <label
          className="block text-sm font-bold"
          htmlFor="delete-user-confirmation"
        >
          Type{" "}
          <strong>
            DELETE USERS
          </strong>{" "}
          to continue
        </label>

        <input
          id="delete-user-confirmation"
          className="field mt-2 w-full"
          autoComplete="off"
          value={confirmation}
          onChange={(event) =>
            setConfirmation(
              event.target.value
            )
          }
        />

        {confirmation &&
          confirmation !==
            "DELETE USERS" && (
            <p className="mt-2 text-xs font-semibold text-clay-700">
              The confirmation text
              does not match.
            </p>
          )}
      </ConfirmDialog>
    </>
  );
}