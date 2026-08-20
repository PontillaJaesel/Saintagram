"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CircleX,
  Flame,
  HeartHandshake,
  ShieldCheck,
  Snowflake,
  Sparkles,
  X
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { useExclusivePopup } from "@/components/ui/use-exclusive-popup";
import { usePopupPresence } from "@/components/ui/use-popup-presence";
import { appService } from "@/lib/app-service";
import {
  calculateFiatStats,
  fiatCalendarDayState,
  FIAT_FREEZE_LIMIT,
  localDateKey
} from "@/lib/fiat";
import type { FiatCalendarDayState, ReflectionPost } from "@/types";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

type FiatPanelView = "intro" | "activity";

function currentWeekKeys(today = new Date()): string[] {
  const sunday = new Date(today);
  sunday.setHours(12, 0, 0, 0);
  sunday.setDate(today.getDate() - today.getDay());

  return WEEKDAYS.map((_label, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + index);
    return localDateKey(date);
  });
}

function dayStateLabel(state: FiatCalendarDayState): string {
  switch (state) {
    case "fiat":
      return "FiAt recorded";
    case "freeze-1":
      return "Freeze 1 used";
    case "freeze-2":
      return "Freeze 2 used";
    case "lost":
      return "Streak lost";
    case "future":
      return "Upcoming day";
    default:
      return "No active streak";
  }
}

function DayStateIcon({ state }: { state: FiatCalendarDayState }) {
  if (state === "fiat") {
    return <Check className="size-5" strokeWidth={3.5} aria-hidden="true" />;
  }
  if (state === "freeze-1" || state === "freeze-2") {
    return <Snowflake className="size-5" strokeWidth={2.7} aria-hidden="true" />;
  }
  if (state === "lost") {
    return <CircleX className="size-5" strokeWidth={2.6} aria-hidden="true" />;
  }
  return null;
}

export function FiatStreakInterface() {
  const { user, updateUser } = useAuth();
  const [posts, setPosts] = useState<ReflectionPost[]>([]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<FiatPanelView>("activity");
  const [introSaving, setIntroSaving] = useState(false);
  const [introError, setIntroError] = useState("");

  useExclusivePopup("fiat-streak", open, setOpen);
  const popupPresence = usePopupPresence(open);

  useEffect(() => {
    if (!user) {
      setPosts([]);
      return;
    }

    let active = true;
    void appService.getReflections(user.id).then((items) => {
      if (active) setPosts(items);
    });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const today = localDateKey();
  const stats = useMemo(() => calculateFiatStats(posts, today), [posts, today]);
  const weekKeys = useMemo(() => currentWeekKeys(), [today]);
  const dayStates = useMemo(
    () => weekKeys.map((date) => fiatCalendarDayState(posts, date, today)),
    [posts, today, weekKeys]
  );

  const hasFiatActivity = posts.some((post) => Boolean(post.fiatCategory));
  const introAlreadySeen = Boolean(user?.fiatIntroSeenAt) || hasFiatActivity;
  const perfectWeek = dayStates.every((state) => state === "fiat");

  const openFiatPanel = () => {
    if (open) {
      setOpen(false);
      return;
    }

    setIntroError("");
    setView(introAlreadySeen ? "activity" : "intro");
    setOpen(true);
  };

  const continueFromIntro = async () => {
    setIntroError("");

    if (!user) return;

    if (user.fiatIntroSeenAt) {
      setView("activity");
      return;
    }

    setIntroSaving(true);
    try {
      await updateUser({ fiatIntroSeenAt: new Date().toISOString() });
      setView("activity");
    } catch {
      setIntroError("FiAt could not be started. Please try again.");
    } finally {
      setIntroSaving(false);
    }
  };

  const streakStatus = stats.streakLostToday
    ? "Streak lost today"
    : stats.activeToday
      ? "FiAt recorded today"
      : stats.frozenToday
        ? `Freeze ${stats.freezeUsed} of ${FIAT_FREEZE_LIMIT} is protecting your streak`
        : stats.currentStreak > 0
          ? "Your streak is protected"
          : "Start a new streak today";

  return (
    <div className="relative">
      <button
        type="button"
        className={`fiat-activity-button ${stats.currentStreak > 0 ? "fiat-activity-button-active" : ""} ${stats.frozenToday ? "fiat-activity-button-frozen" : ""}`}
        aria-label={`FiAt current streak: ${stats.currentStreak} days. ${streakStatus}`}
        aria-expanded={open}
        onClick={openFiatPanel}
      >
        <span className="fiat-mark-shell" aria-hidden="true">
          <Image
            src="/images/fiat-logo.png"
            alt=""
            width={44}
            height={44}
            className="size-8 object-contain"
            priority
          />
        </span>

        <strong className="fiat-streak-count">
          {stats.currentStreak}
        </strong>
      </button>

      {popupPresence.rendered && (
        <section
          className={`fiat-streak-surface fixed left-4 right-4 top-20 bottom-[4.5rem] z-[90] overflow-hidden rounded-3xl border text-slate-800 shadow-lift sm:left-auto sm:right-4 sm:w-[23rem] lg:absolute lg:right-0 lg:top-[calc(100%+.65rem)] lg:bottom-auto lg:max-h-[calc(100dvh-9rem)] ${popupPresence.closing ? "popup-panel-exit" : "popup-panel-enter"}`}
          role="dialog"
          aria-label="FiAt activity"
        >
          <div className="fiat-streak-scroll overscroll-contain">
          {view === "intro" ? (
            <div className="px-5 pb-5 pt-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span
                    className="fiat-intro-logo grid size-12 place-items-center rounded-2xl"
                    aria-hidden="true"
                  >
                    <Image
                      src="/images/fiat-logo.png"
                      alt=""
                      width={40}
                      height={40}
                      className="size-10 object-contain"
                      priority
                    />
                  </span>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.18em] text-[#9a7000]">Welcome to FiAt</p>
                    <h2 className="fiat-streak-title mt-1 font-serif text-2xl font-bold text-[#991f22]">Your daily “yes” to God</h2>
                  </div>
                </div>
                <button
                  type="button"
                  className="fiat-streak-close grid size-10 shrink-0 place-items-center rounded-full text-slate-800 transition hover:bg-[#fdf8e8]"
                  aria-label="Close FiAt activity"
                  onClick={() => setOpen(false)}
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>

              <div className="fiat-intro-callout mt-5 rounded-[1.4rem] border border-[#f0d889] bg-[#fffaf0] p-4">
                <p className="text-sm leading-6 text-slate-700">
                  <strong className="text-[#a76500]">1 Fi@</strong> is one concrete “yes” to God lived through a desire, choice, prayer, sacrifice, or act of love.
                </p>
              </div>

              <div className="mt-4 grid gap-3">
                <div className="fiat-info-card flex gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4">
                  <HeartHandshake className="mt-0.5 size-5 shrink-0 text-[#c44b34]" aria-hidden="true" />
                  <div>
                    <h3 className="text-sm font-black">What counts as a FiAt?</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">Prayer, forgiveness, service, sacrifice, an act of love, a responsible choice, or another sincere response to grace.</p>
                  </div>
                </div>

                <div className="fiat-info-card flex gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4">
                  <BookOpen className="mt-0.5 size-5 shrink-0 text-[#b98400]" aria-hidden="true" />
                  <div>
                    <h3 className="text-sm font-black">It is not a holiness score</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">FiAt encourages concrete responses to God’s grace. It does not measure how holy one person is compared with another.</p>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="size-5 text-[#4c7f9b]" aria-hidden="true" />
                  <h3 className="font-serif text-lg font-bold">Streak rules</h3>
                </div>
                <ol className="space-y-2 text-sm leading-5 text-slate-700">
                  <li className="flex gap-3"><span className="fiat-rule-number">1</span><span>Record at least one FiAt on a calendar day to add <strong>1 day</strong> to your streak. Extra FiAt entries that day do not add extra streak days.</span></li>
                  <li className="flex gap-3"><span className="fiat-rule-number">2</span><span>Miss one day and <strong>Freeze 1</strong> automatically protects the streak. The freeze day does not increase the streak number.</span></li>
                  <li className="flex gap-3"><span className="fiat-rule-number">3</span><span>Miss a second consecutive day and <strong>Freeze 2</strong> protects it one final time.</span></li>
                  <li className="flex gap-3"><span className="fiat-rule-number">4</span><span>Miss a third consecutive day and the streak is <strong>lost</strong>. Your next FiAt starts a new streak at 1.</span></li>
                  <li className="flex gap-3"><span className="fiat-rule-number">5</span><span>Recording a FiAt after a freeze resumes the same streak and resets the consecutive-freeze counter.</span></li>
                </ol>
              </div>

              {introError && (
                <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">
                  {introError}
                </p>
              )}

              <button
                type="button"
                className="btn-primary mt-5 w-full !text-white"
                disabled={introSaving}
                onClick={() => void continueFromIntro()}
              >
                <Sparkles className="size-4" aria-hidden="true" />
                {introSaving ? "Starting FiAt…" : "Continue to FiAt"}
              </button>
            </div>
          ) : (
            <>
              <div className="px-5 pb-5 pt-5 sm:px-6">
                <div className="flex items-start justify-between gap-4 text-left">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="fiat-streak-close grid size-10 shrink-0 place-items-center rounded-full text-slate-800 transition hover:bg-[#fdf8e8]"
                      aria-label="Back to What is FiAt"
                      onClick={() => setView("intro")}
                    >
                      <ArrowLeft className="size-5" aria-hidden="true" />
                    </button>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.18em] text-[#9a7000]">FiAt activity</p>
                      <h2 className="fiat-streak-title mt-1 font-serif text-2xl font-bold text-[#991f22]">FiAt streak</h2>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="fiat-streak-close grid size-10 shrink-0 place-items-center rounded-full text-slate-800 transition hover:bg-[#fdf8e8]"
                    aria-label="Close FiAt activity"
                    onClick={() => setOpen(false)}
                  >
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-3 text-center">
                  <div
                    className={`fiat-hero-logo relative mx-auto grid size-24 place-items-center rounded-[2rem] ${
                      stats.currentStreak > 0 ? "is-active" : ""
                    } ${
                      stats.frozenToday ? "is-frozen" : ""
                    }`}
                    aria-hidden="true"
                  >
                    <Image
                      src="/images/fiat-logo.png"
                      alt=""
                      width={80}
                      height={80}
                      className="size-20 object-contain"
                      priority
                    />
                  </div>

                  <div className="mt-3 flex items-baseline justify-center gap-2">
                    <strong className="text-4xl font-black tracking-tight text-[#bd6b00]">{stats.currentStreak}</strong>
                    <span className="text-lg font-black text-[#bd6b00]">day streak</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{streakStatus}</p>
                </div>

                <div
                  className={`fiat-status-card mt-5 rounded-2xl border px-4 py-2.5 ${
                    stats.streakLostToday
                      ? "border-red-200 bg-red-50"
                      : stats.frozenToday
                        ? "border-sky-200 bg-sky-50"
                        : "border-[#eadc9f] bg-[#fffaf0]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {stats.streakLostToday ? (
                      <CircleX
                        className="size-5 shrink-0 text-red-600"
                        aria-hidden="true"
                      />
                    ) : stats.frozenToday ? (
                      <Snowflake
                        className="size-5 shrink-0 text-sky-600"
                        aria-hidden="true"
                      />
                    ) : (
                      <ShieldCheck
                        className="size-5 shrink-0 text-[#9a7000]"
                        aria-hidden="true"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex min-h-8 items-center justify-between gap-4">
                        <strong className="min-w-0 flex-1 text-sm leading-5">
                          {stats.streakLostToday ? "Streak lost" : "Automatic streak freeze"}
                        </strong>

                        {!stats.streakLostToday && (
                          <span className="flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-white/75 px-3 py-1 text-center text-[11px] font-black leading-4 text-slate-700">
                            {stats.freezeUsed}/{FIAT_FREEZE_LIMIT}
                          </span>
                        )}
                      </div>

                      {(stats.streakLostToday || stats.frozenToday) && (
                        <p className="mt-2 text-xs leading-5 text-slate-600">
                          {stats.streakLostToday
                            ? "Both freeze days were used and a third consecutive day was missed. Your next FiAt starts a new streak."
                            : `Your streak is safe today. ${stats.freezeRemaining} consecutive freeze ${
                                stats.freezeRemaining === 1 ? "day remains" : "days remain"
                              }. Record a FiAt to resume it.`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="fiat-streak-week mt-5 overflow-hidden rounded-[1.6rem] border border-[#eadc9f] bg-[#fdf9ea]">
                  <div className="grid grid-cols-7 gap-2 px-4 pb-5 pt-4 sm:gap-3">
                    {weekKeys.map((date, index) => {
                      const state = dayStates[index];
                      const isToday = date === today;

                      return (
                        <div className="flex min-w-0 flex-col items-center gap-3" key={date}>
                          <span className={`text-sm font-black ${isToday ? "text-[#b57600]" : "text-slate-500"}`}>
                            {WEEKDAYS[index]}
                          </span>
                          <span
                            className={`fiat-calendar-day grid size-9 place-items-center rounded-full sm:size-10 state-${state} ${isToday ? "is-today" : ""}`}
                            aria-label={`${WEEKDAYS[index]}: ${dayStateLabel(state)}`}
                            title={dayStateLabel(state)}
                          >
                            <DayStateIcon state={state} />
                            {state === "freeze-1" && <span className="sr-only">1</span>}
                            {state === "freeze-2" && <span className="sr-only">2</span>}
                          </span>
                          {(state === "freeze-1" || state === "freeze-2") && (
                            <span className="-mt-2 text-[9px] font-black uppercase tracking-wide text-sky-700">
                              F{state === "freeze-1" ? "1" : "2"}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="fiat-streak-copy border-t border-[#eadc9f] px-5 py-4 text-center text-sm leading-6 text-slate-700">
                    {perfectWeek ? (
                      <p><strong className="text-[#b57600]">Perfect week!</strong> You recorded a FiAt every day.</p>
                    ) : stats.frozenToday ? (
                      <p><strong className="text-sky-700">Streak frozen.</strong> Add today&apos;s FiAt to continue without using another freeze tomorrow.</p>
                    ) : stats.streakLostToday ? (
                      <p><strong className="text-red-700">The streak ended today.</strong> A new FiAt will begin a fresh streak.</p>
                    ) : (
                      <p>Record a FiAt today and keep your daily “yes” moving forward.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="fiat-streak-footer sticky bottom-0 border-t border-[#eadc9f] bg-white p-4">
                <Link
                  href="/reflect"
                  className="btn-primary w-full !text-white"
                  onClick={() => setOpen(false)}
                >
                  <Flame className="size-4" aria-hidden="true" />
                  Add today&apos;s FiAt
                </Link>
              </div>
            </>
          )}
          </div>
        </section>
      )}
    </div>
  );
}
