"use client";

import {
  useEffect,
  useState
} from "react";

import Link from "next/link";

import {
  ArrowLeft,
  CalendarDays,
  Trophy
} from "lucide-react";

import {
  useRouter,
  useSearchParams
} from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";

import { appService } from "@/lib/app-service";

import {
  eligibleFiatCount,
  fiatPeriodBounds,
  localDateKey
} from "@/lib/fiat";

import {
  getFirebaseServices
} from "@/lib/firebase";

import type {
  FiatLeaderboardEntry,
  ReflectionPost
} from "@/types";

type FullLeaderboardPeriod =
  | "week"
  | "month";

function normalizePeriod(
  value: string | null
): FullLeaderboardPeriod {
  return value === "month"
    ? "month"
    : "week";
}

export function FiatLeaderboardPage() {
  const {
    user,
    mode
  } = useAuth();

  const router = useRouter();
  const searchParams =
    useSearchParams();

  const [
    period,
    setPeriod
  ] =
    useState<FullLeaderboardPeriod>(
      () =>
        normalizePeriod(
          searchParams.get("period")
        )
    );

  const [
    entries,
    setEntries
  ] =
    useState<
      FiatLeaderboardEntry[]
    >([]);

  const [
    current,
    setCurrent
  ] =
    useState<
      FiatLeaderboardEntry | null
    >(null);

  const [
    loading,
    setLoading
  ] =
    useState(true);

  const [
    error,
    setError
  ] =
    useState("");

  /*
   * Page entrance animation.
   */
  const [
    pageVisible,
    setPageVisible
  ] =
    useState(false);

  /*
   * Ranking list animation when
   * changing Week / Month.
   */
  const [
    listVisible,
    setListVisible
  ] =
    useState(false);

  useEffect(() => {
    const frame =
      window.requestAnimationFrame(
        () => {
          setPageVisible(true);
        }
      );

    return () =>
      window.cancelAnimationFrame(
        frame
      );
  }, []);

  /*
   * Keep the selected period synced
   * with the URL.
   */
  useEffect(() => {
    const next =
      normalizePeriod(
        searchParams.get("period")
      );

    setPeriod(next);
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;

    let active = true;

    setLoading(true);
    setError("");
    setListVisible(false);

    /*
     * LOCAL DEVELOPMENT MODE
     */
    if (mode === "local") {
      void appService
        .getReflections(user.id)
        .then(
          (
            posts:
              ReflectionPost[]
          ) => {
            if (!active) return;

            const bounds =
              fiatPeriodBounds(
                period
              );

            const count =
              eligibleFiatCount(
                posts,
                bounds.start,
                bounds.end
              );

            const entry =
              count > 0
                ? {
                    rank: 1,
                    userId:
                      user.id,
                    profileName:
                      "You",
                    imagePath:
                      "",
                    eligibleCount:
                      count
                  }
                : null;

            setEntries(
              entry
                ? [entry]
                : []
            );

            setCurrent(entry);
          }
        )
        .catch(
          (loadError) => {
            if (!active) return;

            setError(
              loadError instanceof
                Error
                ? loadError.message
                : "Leaderboard unavailable."
            );
          }
        )
        .finally(() => {
          if (!active) return;

          setLoading(false);

          window.setTimeout(
            () => {
              if (active) {
                setListVisible(
                  true
                );
              }
            },
            40
          );
        });

      return () => {
        active = false;
      };
    }

    /*
     * FIREBASE MODE
     */
    const auth =
      getFirebaseServices()
        ?.auth.currentUser;

    if (!auth) {
      setError(
        "Firebase authentication is required."
      );

      setLoading(false);
      setListVisible(true);

      return;
    }

    const requestLeaderboard =
      async () => {
        let token =
          await auth.getIdToken();

        let response =
          await fetch(
            `/api/fiat/leaderboard?period=${period}&today=${localDateKey()}&view=full`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`
              },
              cache: "no-store"
            }
          );

        if (
          response.status ===
          401
        ) {
          token =
            await auth.getIdToken(
              true
            );

          response =
            await fetch(
              `/api/fiat/leaderboard?period=${period}&today=${localDateKey()}&view=full`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`
                },
                cache:
                  "no-store"
              }
            );
        }

        return response;
      };

    void requestLeaderboard()
      .then(
        async (response) => {
          if (!response.ok) {
            const body =
              await response
                .json()
                .catch(
                  () => ({})
                ) as {
                  error?: string;
                };

            throw new Error(
              body.error ??
                "Leaderboard unavailable."
            );
          }

          return response.json() as Promise<{
            entries: FiatLeaderboardEntry[];
            currentUser:
                FiatLeaderboardEntry | null;
            totalRankedUsers: number;
            }>;
        }
      )
      .then((data) => {
        if (!active) return;

        /*
         * NO slice() HERE.
         *
         * This page displays the
         * COMPLETE ranking.
         */
        setEntries(
          data.entries
        );

        setCurrent(
          data.currentUser
        );
      })
      .catch(
        (loadError) => {
          if (!active) return;

          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "Leaderboard unavailable."
          );
        }
      )
      .finally(() => {
        if (!active) return;

        setLoading(false);

        window.setTimeout(
          () => {
            if (active) {
              setListVisible(
                true
              );
            }
          },
          40
        );
      });

    return () => {
      active = false;
    };
  }, [
    mode,
    period,
    user
  ]);

  const changePeriod = (
    next:
      FullLeaderboardPeriod
  ) => {
    if (
      next === period ||
      loading
    ) {
      return;
    }

    /*
     * Fade current list out.
     */
    setListVisible(false);

    /*
     * Let that animation complete
     * before changing the ranking.
     */
    window.setTimeout(() => {
      setPeriod(next);

      router.replace(
        `/fiat/leaderboard?period=${next}`,
        {
          scroll: false
        }
      );
    }, 120);
  };

  return (
    <div
      className={`mx-auto w-full max-w-3xl px-4 py-6 transition-all duration-300 ease-out sm:px-6 sm:py-8 ${
        pageVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-2 opacity-0"
      }`}
    >
      {/* BACK */}
      <Link
        href="/profile"
        className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-bold text-muted transition-all duration-200 hover:-translate-x-1 hover:bg-sage-50 hover:text-sage-700"
      >
        <ArrowLeft
          className="size-4"
          aria-hidden="true"
        />

        Back to profile
      </Link>

      {/* HEADER */}
      <section className="overflow-hidden rounded-[var(--radius-card)] border border-sage-100 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-gold-50 via-paper to-sage-50 px-5 py-7 sm:px-8 sm:py-9">
          <div className="grid size-12 place-items-center rounded-2xl border border-gold-200 bg-white text-gold-700 shadow-sm">
            <Trophy
              className="size-6"
              aria-hidden="true"
            />
          </div>

          <p className="eyebrow mt-5">
            FiAt activity
          </p>

          <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            FiAt Leaderboard
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
            See the full weekly
            and monthly ranking
            of recorded FiAt
            activity.
          </p>

          <p className="mt-2 max-w-xl text-xs leading-5 text-muted">
            Rankings reflect
            recorded FiAt activity,
            not a measure of
            holiness.
          </p>
        </div>

        {/* WEEK / MONTH TABS */}
        <div className="border-t border-sage-100 p-4 sm:p-5">
          <div
            className="relative grid grid-cols-2 rounded-full bg-sage-50 p-1"
            role="tablist"
            aria-label="Full leaderboard period"
          >
            {(
              [
                [
                  "week",
                  "Weekly"
                ],
                [
                  "month",
                  "Monthly"
                ]
              ] as const
            ).map(
              ([
                value,
                label
              ]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={
                    period ===
                    value
                  }
                  className={`min-h-11 rounded-full px-4 text-sm font-bold transition-all duration-300 ease-out ${
                    period ===
                    value
                      ? "scale-100 bg-white text-sage-700 shadow-sm"
                      : "scale-[0.98] text-muted hover:bg-white/50 hover:text-ink"
                  }`}
                  onClick={() =>
                    changePeriod(
                      value
                    )
                  }
                >
                  {label}
                </button>
              )
            )}
          </div>
        </div>
      </section>

      {/* RANKING */}
      <section className="mt-5 rounded-[var(--radius-card)] border border-sage-100 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sage-600">
              <CalendarDays
                className="size-4"
                aria-hidden="true"
              />

              {period === "week"
                ? "This Week"
                : "This Month"}
            </p>

            <h2 className="mt-1 font-serif text-2xl font-bold">
              Full Ranking
            </h2>
          </div>

          {!loading &&
            !error && (
              <span className="rounded-full bg-sage-50 px-3 py-1.5 text-xs font-bold text-sage-700">
                {
                  entries.length
                }{" "}
                {entries.length ===
                1
                  ? "user"
                  : "users"}
              </span>
            )}
        </div>

        <div
          className={`transition-all duration-250 ease-out ${
            listVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-2 opacity-0"
          }`}
        >
          {loading ? (
            <div className="py-16 text-center">
              <div className="mx-auto size-8 animate-spin rounded-full border-[3px] border-sage-200 border-t-sage-600" />

              <p className="mt-4 text-sm font-medium text-muted">
                Loading{" "}
                {period ===
                "week"
                  ? "weekly"
                  : "monthly"}{" "}
                rankings…
              </p>
            </div>
          ) : error ? (
            <div
              className="my-6 rounded-2xl border border-clay-200 bg-clay-50 px-4 py-6 text-center text-sm font-semibold text-clay-600"
              role="alert"
            >
              {error}
            </div>
          ) : entries.length ? (
            <ol className="mt-5 space-y-2">
              {entries.map(
                (
                  entry,
                  index
                ) => {
                  const isCurrentUser =
                    entry.userId ===
                    user?.id;

                  return (
                    <li
                      key={
                        entry.userId
                      }
                      style={{
                        transitionDelay:
                          `${Math.min(
                            index * 15,
                            150
                          )}ms`
                      }}
                      className={`group flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${
                        isCurrentUser
                          ? "border-gold-300 bg-gold-50 shadow-sm"
                          : "border-sage-100 bg-white hover:border-sage-200"
                      }`}
                    >
                      {/* RANK */}
                      <div
                        className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-black ${
                          entry.rank ===
                          1
                            ? "bg-gold-100 text-gold-700"
                            : entry.rank ===
                                2
                              ? "bg-sage-100 text-sage-700"
                              : entry.rank ===
                                  3
                                ? "bg-clay-50 text-clay-600"
                                : "bg-sage-50 text-muted"
                        }`}
                      >
                        {
                          entry.rank
                        }
                      </div>

                      {/* NAME */}
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate font-bold ${
                            isCurrentUser
                              ? "text-gold-700"
                              : "text-ink"
                          }`}
                        >
                          {isCurrentUser
                            ? "You"
                            : entry.profileName}
                        </p>

                        {isCurrentUser && (
                          <p className="mt-0.5 text-[11px] font-semibold text-gold-600">
                            Your current
                            ranking
                          </p>
                        )}
                      </div>

                      {/* COUNT */}
                      <div className="shrink-0 text-right">
                        <strong
                          className={`text-base ${
                            isCurrentUser
                              ? "text-gold-700"
                              : "text-sage-700"
                          }`}
                        >
                          {
                            entry.eligibleCount
                          }
                        </strong>

                        <p className="text-[11px] text-muted">
                          FiAt
                          {entry.eligibleCount ===
                          1
                            ? ""
                            : "s"}
                        </p>
                      </div>
                    </li>
                  );
                }
              )}
            </ol>
          ) : (
            <div className="py-16 text-center">
              <Trophy
                className="mx-auto size-9 text-sage-300"
                aria-hidden="true"
              />

              <p className="mt-4 font-bold text-ink">
                No FiAt activity
                yet
              </p>

              <p className="mt-1 text-sm text-muted">
                No recorded FiAt
                activity exists for
                this period.
              </p>
            </div>
          )}
        </div>

        {/* CURRENT USER SUMMARY */}
        {current &&
          !loading &&
          !error && (
            <div className="mt-6 border-t border-sage-100 pt-5">
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-gold-50 px-4 py-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gold-600">
                    Your ranking
                  </p>

                  <p className="mt-1 font-bold text-gold-800">
                    Rank #
                    {
                      current.rank
                    }
                  </p>
                </div>

                <p className="text-sm font-bold text-gold-700">
                  {
                    current.eligibleCount
                  }{" "}
                  FiAt
                  {current.eligibleCount ===
                  1
                    ? ""
                    : "s"}
                </p>
              </div>
            </div>
          )}
      </section>
    </div>
  );
}