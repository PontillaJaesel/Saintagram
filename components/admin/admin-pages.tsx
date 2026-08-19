"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, RefreshCw } from "lucide-react";
import { adminDownload, adminFetch } from "@/lib/admin-api";
import { AdminProfileStatus } from "@/components/admin/admin-profile-status";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/providers/toast-provider";
import type {
  AdminAuditLog,
  AdminDashboardOverview,
  AdminUserData,
  AdminUserSummary,
  LinkOpenEvent,
  SystemNotification
} from "@/types";

const fmt = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value))
    : "—";

type LinkActivityTimeZone =
  | "Asia/Manila"
  | "America/New_York"
  | "America/Denver";

const LINK_ACTIVITY_TIME_ZONES: Array<{
  value: LinkActivityTimeZone;
  label: string;
  shortLabel: string;
}> = [
  {
    value: "Asia/Manila",
    label: "Philippine Time (PHT)",
    shortLabel: "PHT"
  },
  {
    value: "America/New_York",
    label: "US Eastern Time (ET) · Ashburn / New York",
    shortLabel: "ET"
  },
  {
    value: "America/Denver",
    label: "US Mountain Time (MT) · Denver",
    shortLabel: "MT"
  }
];

const formatActivityTime = (
  value: string | null,
  timeZone: LinkActivityTimeZone
) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        timeZone,
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short"
      }).format(new Date(value))
    : "—";

const Header = ({
  title,
  description,
  refresh
}: {
  title: string;
  description: string;
  refresh?: () => void;
}) => (
  <div className="mb-6 flex items-start justify-between">
    <div>
      <p className="eyebrow">Administration</p>

      <h1 className="mt-2 font-serif text-3xl font-bold">
        {title}
      </h1>

      <p className="mt-1 text-sm text-muted">
        {description}
      </p>
    </div>

    {refresh && (
      <button
        className="btn-secondary"
        onClick={refresh}
      >
        <RefreshCw className="size-4" />
        Refresh
      </button>
    )}
  </div>
);

function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    setError("");

    void adminFetch<T>(path)
      .then(setData)
      .catch((error) =>
        setError(
          error instanceof Error
            ? error.message
            : "Could not load data."
        )
      );
  };

  useEffect(load, [path]);

  return {
    data,
    error,
    load
  };
}

const State = ({
  error
}: {
  error: string;
}) => (
  <div className="surface p-8 text-center text-muted">
    {error || "Loading…"}
  </div>
);

/* ============================================================
   DASHBOARD
   ============================================================ */

export function Dashboard() {
  const {
    data,
    error,
    load
  } = useLoad<AdminDashboardOverview>(
    "/api/admin/overview"
  );

  if (!data) {
    return (
      <>
        <Header
          title="Dashboard"
          description="Saintagram at a glance"
        />

        <State error={error} />
      </>
    );
  }

  const cards = [
    ["Total Users", data.totalUsers],
    ["Complete Profiles", data.completeProfiles],
    ["Incomplete Profiles", data.incompleteProfiles],
    ["Total Visits", data.totalVisits],
    ["QR Visits", data.qrVisits],
    ["Common Link Visits", data.commonVisits]
  ];

  return (
    <>
      <Header
        title="Dashboard"
        description="Real account and tracked-link activity"
        refresh={load}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {cards.map(([label, value]) => (
          <div
            className="surface p-5"
            key={label}
          >
            <p className="text-sm text-muted">
              {label}
            </p>

            <p className="mt-2 font-serif text-3xl font-bold">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SimpleActivity
          events={data.recentActivity}
        />

        <section className="surface p-5">
          <h2 className="font-serif text-xl font-bold">
            Recently Registered Users
          </h2>

          <div className="mt-4 space-y-3">
            {data.recentUsers.map((user) => (
              <Link
                className="flex justify-between rounded-xl bg-sage-50 p-3"
                href={`/admin/users/${user.id}`}
                key={user.id}
              >
                <span>{user.name}</span>

                <span className="text-xs text-muted">
                  {fmt(user.createdAt)}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="surface p-5">
          <h2 className="font-serif text-xl font-bold">
            Recent Profile Reminders
          </h2>

          <p className="mt-4 text-sm text-muted">
            {data.recentReminders.length
              ? `${data.recentReminders.length} recently sent reminders`
              : "No reminders sent yet."}
          </p>
        </section>
      </div>
    </>
  );
}

/* ============================================================
   SIMPLE ACTIVITY TABLE
   ============================================================ */

function SimpleActivity({
  events,
  timeZone = "Asia/Manila"
}: {
  events: LinkOpenEvent[];
  timeZone?: LinkActivityTimeZone;
}) {
  const rowsPerPage = 20;
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(events.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const pageEvents = events.slice(startIndex, startIndex + rowsPerPage);
  const firstRow = events.length ? startIndex + 1 : 0;
  const lastRow = Math.min(startIndex + rowsPerPage, events.length);
  const selectedTimeZone =
    LINK_ACTIVITY_TIME_ZONES.find((option) => option.value === timeZone) ??
    LINK_ACTIVITY_TIME_ZONES[0];

  useEffect(() => {
    setPage(1);
  }, [events]);

  return (
    <section className="surface overflow-hidden p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-xl font-bold">Link History</h2>
          <p className="mt-1 text-sm text-muted">
            All QR and common-link visits, including visitors who did not log in.
            Repeated anonymous opens from the same browser session are kept as
            one visit with an open count.
          </p>
        </div>

        {events.length > 0 && (
          <p className="text-sm text-muted">
            Showing {firstRow}-{lastRow} of {events.length}
          </p>
        )}
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[1320px] table-fixed text-left text-sm">
          <thead>
            <tr className="border-b border-sage-100 text-muted">
              <th className="w-[185px] px-3 py-3 font-semibold">Name</th>
              <th className="w-[210px] px-3 py-3 font-semibold">
                Display name / User
              </th>
              <th className="w-[125px] px-3 py-3 font-semibold">Source</th>
              <th className="w-[220px] px-3 py-3 font-semibold">
                Time ({selectedTimeZone.shortLabel})
              </th>
              <th className="w-[190px] px-3 py-3 font-semibold">Visit status</th>
              <th className="px-3 py-3 font-semibold">Place</th>
            </tr>
          </thead>

          <tbody>
            {pageEvents.map((event) => {
              const identified = Boolean(event.userId);
              const repeated = event.openCount > 1;
              const awaitingLogin = event.visitStatus === "awaiting_login";

              return (
                <tr
                  className="border-b border-sage-100 last:border-b-0"
                  key={event.id}
                >
                  <td className="px-3 py-4 align-top">
                    {identified ? (
                      <Link
                        className="font-semibold hover:underline"
                        href={`/admin/users/${event.userId}`}
                      >
                        {event.userFullName || "Unnamed issued account"}
                      </Link>
                    ) : (
                      <div className="font-semibold">Anonymous visitor</div>
                    )}
                  </td>

                  <td className="px-3 py-4 align-top">
                    {identified ? (
                      <>
                        <div className="font-semibold leading-5">
                          {event.userDisplayName || "No display name yet"}
                        </div>
                        <div className="mt-1 text-xs uppercase tracking-[0.12em] text-muted">
                          {event.username || "No username"}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-semibold leading-5">
                          No account identified
                        </div>
                        <div className="mt-1 text-xs text-muted">
                          {awaitingLogin
                            ? "Login window still open"
                            : "Did not proceed to login"}
                        </div>
                      </>
                    )}
                  </td>

                  <td className="px-3 py-4 align-top">
                    <span className="whitespace-nowrap">
                      {event.source === "qr" ? "QR Code" : "Common Link"}
                    </span>
                    {event.campaign ? (
                      <div
                        className="mt-1 max-w-[120px] truncate text-xs text-muted"
                        title={event.campaign}
                      >
                        {event.campaign}
                      </div>
                    ) : null}
                  </td>

                  <td className="px-3 py-4 align-top">
                    <div className="whitespace-nowrap font-medium">
                      {formatActivityTime(event.openedAt, timeZone)}
                    </div>
                    {repeated ? (
                      <div className="mt-1 text-xs text-muted">
                        Last open: {formatActivityTime(event.lastOpenedAt, timeZone)}
                      </div>
                    ) : null}
                  </td>

                  <td className="px-3 py-4 align-top">
                    <div className="font-semibold">
                      {identified
                        ? "Logged in"
                        : awaitingLogin
                          ? "Awaiting login"
                          : "Did not log in"}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {repeated
                        ? `${event.openCount} link opens · same browser visit`
                        : "1 link open"}
                    </div>
                  </td>

                  <td className="px-3 py-4 align-top">
                    {event.locationSource === "device" &&
                    event.latitude &&
                    event.longitude ? (
                      <div>
                        <a
                          className="font-semibold text-sage-700 underline underline-offset-4"
                          href={`https://www.google.com/maps?q=${encodeURIComponent(
                            `${event.latitude},${event.longitude}`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {event.formattedAddress || event.locationLabel}
                        </a>

                        <p className="mt-1 text-xs text-muted">
                          Device location
                          {event.locationAccuracyMeters !== null
                            ? ` · GPS ±${event.locationAccuracyMeters} m`
                            : ""}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium">{event.locationLabel}</div>
                        <p className="mt-1 text-xs text-muted">
                          {event.locationSource === "localhost"
                            ? "Local development"
                            : event.locationSource === "cloudflare"
                              ? "Approximate network location"
                              : "Precise location unavailable"}
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!events.length ? (
        <p className="mt-5 rounded-xl border border-sage-100 p-5 text-sm text-muted">
          No link visits match these filters yet.
        </p>
      ) : totalPages > 1 ? (
        <div className="mt-5 flex flex-col gap-3 border-t border-sage-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            Page {safePage} of {totalPages}
          </p>

          <div className="flex items-center gap-2">
            <button
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>

            <button
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={safePage >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ============================================================
   ACTIVITY
   ============================================================ */

export function Activity() {
  const {
    data,
    error,
    load
  } = useLoad<{
    events: LinkOpenEvent[];
  }>("/api/admin/activity");

  const [source, setSource] =
    useState("all");

  const [search, setSearch] =
    useState("");

  const [timeZone, setTimeZone] =
    useState<LinkActivityTimeZone>("Asia/Manila");

  const events = (
    data?.events ?? []
  ).filter(
    (event) =>
      (source === "all" ||
        event.source === source) &&
      [
        event.userFullName,
        event.userDisplayName,
        event.username,
        event.campaign,
        event.visitStatus.replaceAll("_", " "),
        event.userId ? "logged in" : "anonymous",
        event.locationLabel
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  return (
    <>
      <Header
        title="Link Activity"
        description="Complete QR and common-link history, including anonymous visitors and precise device locations when permission is granted"
        refresh={load}
      />

      <div className="mb-4 flex gap-3">
        <input
          className="field"
          placeholder="Filter name, user, status, place, or campaign"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
        />

        <select
          className="field"
          value={source}
          onChange={(event) =>
            setSource(event.target.value)
          }
        >
          <option value="all">
            All sources
          </option>

          <option value="qr">
            QR
          </option>

          <option value="common">
            Common
          </option>
        </select>

        <select
          className="field"
          value={timeZone}
          aria-label="Link history timezone"
          onChange={(event) =>
            setTimeZone(event.target.value as LinkActivityTimeZone)
          }
        >
          {LINK_ACTIVITY_TIME_ZONES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {!data ? (
        <State error={error} />
      ) : (
        <SimpleActivity
          events={events}
          timeZone={timeZone}
        />
      )}
    </>
  );
}

/* ============================================================
   USERS
   ============================================================ */

export function Users() {
  const {
    data,
    error,
    load
  } = useLoad<{
    users: AdminUserSummary[];
  }>("/api/admin/users");

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState("all");

  const users = (
    data?.users ?? []
  ).filter((user) => {
    const searchable = [
      user.fullName,
      user.displayName,
      user.username,
      user.email,
      user.accountRole
    ]
      .join(" ")
      .toLowerCase();

    return (
      (status === "all" || user.completion.status === status) &&
      searchable.includes(search.toLowerCase())
    );
  });

  return (
    <>
      <Header
        title="Users"
        description="Account, onboarding, and seven-part profile progress"
        refresh={load}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row">
        <input
          className="field lg:max-w-xl"
          placeholder="Search users"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
        />

        <select
          className="field lg:max-w-sm"
          value={status}
          onChange={(event) =>
            setStatus(event.target.value)
          }
        >
          <option value="all">
            All progress
          </option>

          <option>
            Complete
          </option>

          <option>
            Incomplete
          </option>

          <option>
            Not Started
          </option>
        </select>
      </div>

      {!data ? (
        <State error={error} />
      ) : (
        <div className="surface overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-muted">
                  <th className="px-5 py-4 font-semibold whitespace-nowrap">
                    Name
                  </th>
                  <th className="px-5 py-4 font-semibold whitespace-nowrap">
                    Display name / User
                  </th>
                  <th className="px-5 py-4 font-semibold whitespace-nowrap">
                    Email
                  </th>
                  <th className="px-5 py-4 font-semibold whitespace-nowrap">
                    Account
                  </th>
                  <th className="px-5 py-4 font-semibold whitespace-nowrap">
                    Joined
                  </th>
                  <th className="px-5 py-4 font-semibold whitespace-nowrap">
                    Profile Progress
                  </th>
                  <th
                    className="px-5 py-4 font-semibold whitespace-nowrap"
                    title="Whether the user finished Saintagram's initial profile setup. This is separate from the seven-part Profile Progress score."
                  >
                    Onboarding
                  </th>
                  <th className="px-5 py-4 text-right font-semibold whitespace-nowrap">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr
                    className="border-t border-sage-100"
                    key={user.id}
                  >
                    <td className="px-5 py-4 align-top">
                      <div className="font-semibold whitespace-nowrap">
                        {user.fullName || "—"}
                      </div>
                    </td>

                    <td className="px-5 py-4 align-top min-w-[12rem]">
                      <div className="font-semibold leading-snug">
                        {user.displayName || "No display name yet"}
                      </div>
                      <div className="mt-1 text-xs text-muted uppercase tracking-[0.12em]">
                        {user.username || "No username"}
                      </div>
                    </td>

                    <td className="px-5 py-4 align-top whitespace-nowrap">
                      {user.email || "—"}
                    </td>

                    <td className="px-5 py-4 align-top whitespace-nowrap">
                      {user.accountRole === "app_admin"
                        ? "Admin user"
                        : user.accountRole === "tester"
                          ? "Tester"
                          : "User"}
                    </td>

                    <td className="px-5 py-4 align-top whitespace-nowrap">
                      {fmt(user.createdAt)}
                    </td>

                    <td className="px-5 py-4 align-top whitespace-nowrap">
                      {user.completion.completedCount}/7 ·{" "}
                      {user.completion.percentage}%
                    </td>

                    <td className="px-5 py-4 align-top whitespace-nowrap">
                      {user.profileCompleted
                        ? "Completed"
                        : "Not completed"}
                    </td>

                    <td className="px-5 py-4 align-top text-right whitespace-nowrap">
                      <Link
                        className="font-bold text-sage-700"
                        href={`/admin/users/${user.id}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!users.length && (
            <p className="px-5 py-8 text-center text-muted">
              No users match these filters.
            </p>
          )}
        </div>
      )}
    </>
  );
}

/* ============================================================
   USER DETAIL
   ============================================================ */

export function UserDetail({
  id
}: {
  id: string;
}) {
  const {
    data,
    error,
    load
  } = useLoad<{
    summary: AdminUserSummary;
    data: AdminUserData;
  }>(
    `/api/admin/users/${encodeURIComponent(
      id
    )}`
  );

  const [
    reminderConfirm,
    setReminderConfirm
  ] = useState(false);

  const [busy, setBusy] =
    useState(false);

  const [
    destructiveAction,
    setDestructiveAction
  ] = useState<
    | "reset-data"
    | "delete-account"
    | null
  >(null);

  const [
    deleteConfirmation,
    setDeleteConfirmation
  ] = useState("");

  const { notify } = useToast();

  if (!data) {
    return (
      <>
        <Header
          title="User details"
          description="Protected account view"
        />

        <State error={error} />
      </>
    );
  }

  /* ----------------------------------------------------------
     SEND PROFILE REMINDER
     ---------------------------------------------------------- */

  const sendReminder = () => {
    setBusy(true);

    void adminFetch(
      `/api/admin/users/${encodeURIComponent(
        id
      )}/profile-reminder`,
      {
        method: "POST"
      }
    )
      .then(() => {
        notify(
          "Profile reminder sent."
        );

        setReminderConfirm(false);

        load();
      })
      .catch((error) =>
        notify(
          error instanceof Error
            ? error.message
            : "Could not send reminder.",
          "error"
        )
      )
      .finally(() =>
        setBusy(false)
      );
  };

  /* ----------------------------------------------------------
     OPEN DELETE / RESET DIALOG
     ---------------------------------------------------------- */

  const openDestructiveAction = (
    action:
      | "reset-data"
      | "delete-account"
  ) => {
    setDeleteConfirmation("");
    setDestructiveAction(action);
  };

  const closeDestructiveAction =
    () => {
      if (busy) {
        return;
      }

      setDestructiveAction(null);
      setDeleteConfirmation("");
    };

  /* ----------------------------------------------------------
     RUN DELETE / RESET ACTION
     ---------------------------------------------------------- */

  const runDestructiveAction =
    async () => {
      if (
        !destructiveAction ||
        busy
      ) {
        return;
      }

      const expectedConfirmation =
        destructiveAction ===
        "reset-data"
          ? "RESET USER DATA"
          : "DELETE ACCOUNT";

      if (
        deleteConfirmation.trim() !==
        expectedConfirmation
      ) {
        notify(
          `Type ${expectedConfirmation} exactly to continue.`,
          "error"
        );

        return;
      }

      setBusy(true);

      try {
        /*
         * OPTION 1:
         *
         * Delete Saintagram data while
         * keeping the Firebase Auth account.
         */
        if (
          destructiveAction ===
          "reset-data"
        ) {
          await adminFetch(
            `/api/admin/users/${encodeURIComponent(
              id
            )}/reset-data`,
            {
              method: "POST",
              body: JSON.stringify({
                confirmation:
                  expectedConfirmation
              })
            }
          );

          notify(
            "User data reset. The login account was preserved and the password was restored to the issued default password."
          );

          setDestructiveAction(
            null
          );

          setDeleteConfirmation(
            ""
          );

          /*
           * Reload the user because the
           * users/{uid} record still exists.
           */
          load();

          return;
        }

        /*
         * OPTION 2:
         *
         * Delete all Saintagram data and
         * permanently delete the Firebase
         * Authentication account.
         */
        await adminFetch(
          `/api/admin/users/${encodeURIComponent(
            id
          )}/delete`,
          {
            method: "POST",
            body: JSON.stringify({
              confirmation:
                expectedConfirmation
            })
          }
        );

        notify(
          "The user account and all associated data were permanently deleted."
        );

        /*
         * The user no longer exists, so
         * return to the admin users page.
         */
        window.location.assign(
          "/admin/users"
        );
      } catch (actionError) {
        notify(
          actionError instanceof Error
            ? actionError.message
            : "The requested deletion could not be completed.",
          "error"
        );
      } finally {
        setBusy(false);
      }
    };

  const isResetAction =
    destructiveAction ===
    "reset-data";

  const expectedDeleteText =
    isResetAction
      ? "RESET USER DATA"
      : "DELETE ACCOUNT";

  return (
    <>
      <Header
        title={data.summary.name}
        description={
          data.summary.email ||
          "User account"
        }
        refresh={load}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminProfileStatus
          completion={
            data.summary.completion
          }
        />

        {/* ACCOUNT INFORMATION */}

        <section className="surface p-5">
          <h2 className="font-serif text-xl font-bold">
            Account Information
          </h2>

          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-muted">
                Onboarding status
              </dt>

              <dd>
                {data.summary
                  .profileCompleted
                  ? "Completed"
                  : "Not completed"}
              </dd>
            </div>

            <div>
              <dt className="text-muted">
                Joined
              </dt>

              <dd>
                {fmt(
                  data.summary
                    .createdAt
                )}
              </dd>
            </div>

            <div>
              <dt className="text-muted">
                Last link open
              </dt>

              <dd>
                {fmt(
                  data.summary
                    .lastLinkOpen
                )}
              </dd>
            </div>
          </dl>

          {data.summary.completion
            .status !==
            "Complete" && (
            <button
              className="btn-primary mt-6"
              type="button"
              disabled={busy}
              onClick={() =>
                setReminderConfirm(
                  true
                )
              }
            >
              Send Profile Reminder
            </button>
          )}
        </section>

        {/* DATA SUMMARY */}

        <section className="surface p-5 xl:col-span-2">
          <h2 className="font-serif text-xl font-bold">
            Data Summary
          </h2>

          <p className="mt-2 text-sm text-muted">
            Sensitive profile and
            draft data are restricted
            to this protected
            administrator view.
          </p>

          <Link
            className="btn-secondary mt-4"
            href={`/admin/data?userId=${encodeURIComponent(
              id
            )}`}
          >
            View All Recorded Data
          </Link>
        </section>

        {/* ==================================================
            DANGER ZONE
            ================================================== */}

        <section className="surface border-clay-200 p-5 xl:col-span-2">
          <div>
            <p className="eyebrow text-clay-600">
              Danger Zone
            </p>

            <h2 className="mt-2 font-serif text-xl font-bold text-clay-700">
              Delete or Reset User
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              These actions permanently
              remove user information.
              Choose carefully between
              resetting only the
              Saintagram data and
              permanently deleting the
              entire account.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {/* RESET USER DATA ONLY */}

            <div className="rounded-2xl border border-clay-100 bg-clay-50/40 p-5">
              <h3 className="font-serif text-lg font-bold text-ink">
                Reset User Data
              </h3>

              <p className="mt-2 text-sm leading-6 text-muted">
                Reset the user&apos;s
                Saintagram profile,
                reflections, FiAt data,
                likes, comments,
                follows, notifications,
                uploaded media, journey
                records, and other
                application data.
              </p>

              <p className="mt-3 text-sm font-semibold text-sage-700">
                The login account,
                Firebase UID, username,
                and email will remain.
              </p>

              <p className="mt-2 text-sm text-muted">
                The password will be
                restored to the
                originally issued
                default password. The
                user will need to
                change their password
                and complete onboarding
                again.
              </p>

              <button
                type="button"
                className="btn-secondary mt-5"
                disabled={busy}
                onClick={() =>
                  openDestructiveAction(
                    "reset-data"
                  )
                }
              >
                Reset User Data
              </button>
            </div>

            {/* DELETE ENTIRE ACCOUNT */}

            <div className="rounded-2xl border border-clay-200 bg-clay-50 p-5">
              <h3 className="font-serif text-lg font-bold text-clay-700">
                Delete Account &amp; All
                Data
              </h3>

              <p className="mt-2 text-sm leading-6 text-muted">
                Permanently delete the
                user&apos;s Saintagram
                data, uploaded media,
                Firebase Authentication
                account, and user
                record.
              </p>

              <p className="mt-3 text-sm font-bold text-clay-700">
                The user will no longer
                be able to log in after
                this action.
              </p>

              <p className="mt-2 text-sm text-muted">
                This is a complete
                account deletion and
                cannot be undone.
              </p>

              <button
                type="button"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-clay-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-clay-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy}
                onClick={() =>
                  openDestructiveAction(
                    "delete-account"
                  )
                }
              >
                Delete Account &amp; All
                Data
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ====================================================
          PROFILE REMINDER CONFIRMATION
          ==================================================== */}

      <ConfirmDialog
        open={reminderConfirm}
        title="Send profile reminder?"
        description={`Saintagram will notify ${data.summary.name} about ${data.summary.completion.missingFields.length} missing sections.`}
        confirmLabel="Send reminder"
        onConfirm={sendReminder}
        onClose={() => {
          if (!busy) {
            setReminderConfirm(false);
          }
        }}
        busy={busy}
      />

      {/* ====================================================
          DELETE / RESET CONFIRMATION
          ==================================================== */}

      <ConfirmDialog
        open={
          destructiveAction !== null
        }
        title={
          isResetAction
            ? "Reset this user's data?"
            : "Permanently delete this account?"
        }
        description={
          isResetAction
            ? "This permanently removes this user's Saintagram data and uploaded media. Their Firebase Authentication account will remain. Their password will be restored to the issued default password, and they will need to change it and complete onboarding again."
            : "This permanently removes the Firebase Authentication account together with all Saintagram data and uploaded media associated with this user. The user will no longer be able to log in."
        }
        confirmLabel={
          isResetAction
            ? "Reset User Data"
            : "Delete Account & All Data"
        }
        destructive
        busy={busy}
        onClose={
          closeDestructiveAction
        }
        onConfirm={() => {
          void runDestructiveAction();
        }}
      >
        <div>
          <label
            className="block text-sm font-bold text-ink"
            htmlFor="delete-confirmation"
          >
            Type{" "}
            <span className="text-clay-700">
              {expectedDeleteText}
            </span>{" "}
            to continue
          </label>

          <input
            id="delete-confirmation"
            className="field mt-2 w-full"
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            value={
              deleteConfirmation
            }
            placeholder={
              expectedDeleteText
            }
            onChange={(event) =>
              setDeleteConfirmation(
                event.target.value
              )
            }
            onKeyDown={(event) => {
              if (
                event.key ===
                  "Enter" &&
                !busy
              ) {
                event.preventDefault();

                void runDestructiveAction();
              }
            }}
          />

          <p className="mt-2 text-xs leading-5 text-muted">
            This confirmation is
            case-sensitive and must
            match exactly.
          </p>
        </div>
      </ConfirmDialog>
    </>
  );
}

/* ============================================================
   NOTIFICATIONS
   ============================================================ */

export function Notifications() {
  const {
    data,
    error,
    load
  } = useLoad<{
    notifications: SystemNotification[];
    users: Record<string, string>;
  }>("/api/admin/notifications");

  return (
    <>
      <Header
        title="Notifications"
        description="Profile reminder history"
        refresh={load}
      />

      {!data ? (
        <State error={error} />
      ) : (
        <div className="surface overflow-x-auto p-5">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Target</th>
                <th>Sent by</th>
                <th>Sent at</th>
                <th>
                  Missing fields
                </th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {data.notifications.map(
                (notification) => (
                  <tr
                    className="border-t border-sage-100"
                    key={
                      notification.id
                    }
                  >
                    <td className="py-4">
                      {data.users[
                        notification
                          .userId
                      ] ??
                        notification.userId}
                    </td>

                    <td>
                      {
                        notification.createdByAdminId
                      }
                    </td>

                    <td>
                      {fmt(
                        notification.createdAt
                      )}
                    </td>

                    <td>
                      {notification.missingFields.join(
                        ", "
                      )}
                    </td>

                    <td>
                      {notification.readAt
                        ? "Read"
                        : "Unread"}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ============================================================
   AUDIT LOGS
   ============================================================ */

export function Audit() {
  const {
    data,
    error,
    load
  } = useLoad<{
    logs: AdminAuditLog[];
  }>("/api/admin/audit");

  return (
    <>
      <Header
        title="Audit Logs"
        description="Sensitive administrator actions"
        refresh={load}
      />

      {!data ? (
        <State error={error} />
      ) : (
        <div className="surface p-5">
          {data.logs.map((log) => (
            <div
              className="border-b border-sage-100 py-3 text-sm"
              key={log.id}
            >
              <strong>
                {log.action.replaceAll(
                  "_",
                  " "
                )}
              </strong>

              <span className="ml-3 text-muted">
                {fmt(log.createdAt)} ·{" "}
                {log.adminId}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ============================================================
   USER DATA PAGE
   ============================================================ */

export function DataPage() {
  const params =
    typeof window !==
    "undefined"
      ? new URLSearchParams(
          window.location.search
        )
      : null;

  const initialId =
    params?.get("userId") ?? "";

  const {
    data: usersData,
    error: usersError,
    load: reloadUsers
  } = useLoad<{
    users: AdminUserSummary[];
  }>("/api/admin/users");

  const [
    selectedId,
    setSelectedId
  ] = useState(initialId);

  const [
    data,
    setData
  ] =
    useState<AdminUserData | null>(
      null
    );

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const load = (
    userId: string
  ) => {
    setSelectedId(userId);
    setData(null);
    setError("");
    setLoading(true);

    void adminFetch<AdminUserData>(
      `/api/admin/user-data?userId=${encodeURIComponent(
        userId
      )}`
    )
      .then(setData)
      .catch((error) =>
        setError(
          error instanceof Error
            ? error.message
            : "Could not load data."
        )
      )
      .finally(() =>
        setLoading(false)
      );
  };

  useEffect(() => {
    if (initialId) {
      load(initialId);
    }
  }, [initialId]);

  const selectedUser =
    usersData?.users.find(
      (user) =>
        user.id === selectedId
    );

  return (
    <>
      <Header
        title="User Data"
        description="Preview every user, then inspect their complete protected account record"
        refresh={reloadUsers}
      />

      {!usersData ? (
        <State error={usersError} />
      ) : (
        <section className="surface overflow-hidden p-0">
          <div className="flex flex-col gap-1 border-b border-sage-100 px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-serif text-xl font-bold">
                All Users
              </h2>

              <p className="mt-1 text-sm text-muted">
                {usersData.users.length}{" "}
                user
                {usersData.users.length === 1 ? "" : "s"}{" "}
                recorded
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] table-fixed border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-muted">
                  <th className="w-[190px] px-5 py-4 font-semibold whitespace-nowrap">
                    Default Name
                  </th>

                  <th className="w-[200px] px-5 py-4 font-semibold whitespace-nowrap">
                    Display Name / User
                  </th>

                  <th className="w-[245px] px-5 py-4 font-semibold whitespace-nowrap">
                    Email
                  </th>

                  <th className="w-[125px] px-5 py-4 font-semibold whitespace-nowrap">
                    Account Type
                  </th>

                  <th className="w-[175px] px-5 py-4 font-semibold whitespace-nowrap">
                    Joined
                  </th>

                  <th className="w-[135px] px-5 py-4 font-semibold whitespace-nowrap">
                    Profile
                  </th>

                  <th className="w-[210px] px-5 py-4 text-right font-semibold whitespace-nowrap">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {usersData.users.map((user) => (
                  <tr
                    className={`border-t border-sage-100 transition-colors ${
                      selectedId === user.id
                        ? "bg-sage-50/70"
                        : "hover:bg-sage-50/30"
                    }`}
                    key={user.id}
                  >
                    <td className="px-5 py-4 align-middle">
                      <div className="break-words font-semibold leading-5">
                        {user.fullName || "—"}
                      </div>
                    </td>

                    <td className="px-5 py-4 align-middle">
                      <div className="break-words font-semibold leading-5">
                        {user.displayName || "No display name yet"}
                      </div>

                      <div className="mt-1 text-xs uppercase tracking-[0.12em] text-muted">
                        {user.username || "No username"}
                      </div>
                    </td>

                    <td className="px-5 py-4 align-middle">
                      <span className="whitespace-nowrap">
                        {user.email || "—"}
                      </span>
                    </td>

                    <td className="px-5 py-4 align-middle">
                      <span className="inline-flex whitespace-nowrap rounded-full border border-sage-100 px-2.5 py-1 text-xs font-semibold">
                        {user.accountRole === "app_admin"
                          ? "Admin User"
                          : user.accountRole === "tester"
                            ? "Tester"
                            : "User"}
                      </span>
                    </td>

                    <td className="px-5 py-4 align-middle whitespace-nowrap">
                      {fmt(user.createdAt)}
                    </td>

                    <td className="px-5 py-4 align-middle">
                      <span className="whitespace-nowrap font-medium">
                        {user.profileCompleted
                          ? "Completed"
                          : "Not completed"}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right align-middle">
                      <button
                        className="btn-secondary whitespace-nowrap"
                        type="button"
                        disabled={
                          loading && selectedId === user.id
                        }
                        onClick={() => load(user.id)}
                      >
                        {loading && selectedId === user.id
                          ? "Loading…"
                          : "View All Recorded Data"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!usersData.users.length && (
            <p className="px-5 py-10 text-center text-muted">
              No users have been recorded yet.
            </p>
          )}
        </section>
      )}

      {error && (
        <p
          className="mt-4 rounded-xl bg-clay-50 p-3 text-sm text-clay-700"
          role="alert"
        >
          {error}
        </p>
      )}

      {data && (
        <div className="mt-6 grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">
                Complete user record
              </p>

              <h2 className="mt-1 font-serif text-2xl font-bold">
                {selectedUser?.name ||
                  selectedId}
              </h2>

              <p className="text-sm text-muted">
                {selectedUser?.email ||
                  "Guest account"}
              </p>
            </div>

            <Link
              className="btn-secondary"
              href={`/admin/users/${selectedId}`}
            >
              View User Summary
            </Link>
          </div>

          <section className="surface p-5">
            <h2 className="font-bold">
              Account &amp; Profile
            </h2>

            <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs">
              {JSON.stringify(
                {
                  user: data.user,
                  profile:
                    data.profile
                },
                null,
                2
              )}
            </pre>
          </section>

          <section className="surface border-clay-200 p-5">
            <h2 className="font-bold text-clay-600">
              Private / Sensitive
            </h2>

            <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs">
              {JSON.stringify(
                {
                  privateProfile:
                    data.privateProfile,
                  draft: data.draft
                },
                null,
                2
              )}
            </pre>
          </section>

          {Object.entries(
            data.collections
          ).map(
            ([name, rows]) => (
              <section
                className="surface p-5"
                key={name}
              >
                <h2 className="font-bold">
                  {name}{" "}
                  <span className="text-sm font-normal text-muted">
                    ({rows.length})
                  </span>
                </h2>

                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs">
                  {JSON.stringify(
                    rows,
                    null,
                    2
                  )}
                </pre>
              </section>
            )
          )}
        </div>
      )}
    </>
  );
}

/* ============================================================
   EXPORT
   ============================================================ */

export function ExportPage() {
  const [scope, setScope] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const { notify } = useToast();

  const download = () => {
    setBusy(true);

    void adminDownload(
      "/api/admin/export",
      {
        userId:
          scope || undefined,
        include: []
      }
    )
      .then((blob) => {
        const anchor =
          document.createElement(
            "a"
          );

        anchor.href =
          URL.createObjectURL(blob);

        anchor.download = `saintagram-export-${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`;

        anchor.click();

        URL.revokeObjectURL(
          anchor.href
        );

        notify(
          "Excel export generated."
        );
      })
      .catch((error) =>
        notify(
          error instanceof Error
            ? error.message
            : "Export failed.",
          "error"
        )
      )
      .finally(() =>
        setBusy(false)
      );
  };

  return (
    <>
      <Header
        title="Export Data"
        description="Generate one organized multi-sheet Excel workbook"
      />

      <section className="surface max-w-2xl p-6">
        <label className="block text-sm font-bold">
          Selected user ID (leave
          empty for all users)
        </label>

        <input
          className="field mt-2 w-full"
          value={scope}
          onChange={(event) =>
            setScope(
              event.target.value
            )
          }
          placeholder="All users"
        />

        <p className="mt-4 text-sm text-muted">
          The export excludes
          passwords, tokens, secrets,
          raw IP addresses, and image
          binaries. User text is
          neutralized against Excel
          formulas.
        </p>

        <button
          className="btn-primary mt-6"
          disabled={busy}
          onClick={download}
        >
          <Download className="size-4" />

          {busy
            ? "Generating…"
            : "Generate Excel"}
        </button>
      </section>
    </>
  );
}
