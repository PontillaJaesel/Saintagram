"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Flame, Star, X } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { appService } from "@/lib/app-service";
import {
  calculateFiatStats,
  localDateKey,
  reflectionFiatDateKey
} from "@/lib/fiat";
import type { ReflectionPost } from "@/types";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

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

export function FiatStreakInterface() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<ReflectionPost[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void appService.getReflections(user.id).then((items) => {
      if (active) setPosts(items);
    });
    return () => {
      active = false;
    };
  }, [user]);

  const stats = useMemo(() => calculateFiatStats(posts), [posts]);
  const weekKeys = useMemo(() => currentWeekKeys(), []);
  const completedDays = useMemo(
    () => new Set(posts.filter((post) => post.fiatCategory).map(reflectionFiatDateKey)),
    [posts]
  );
  const today = localDateKey();
  const perfectWeek = weekKeys.every((date) => completedDays.has(date));

  return (
    <div className="relative">
      <button
        type="button"
        className={`fiat-streak-badge ${stats.activeToday ? "fiat-streak-active" : ""}`}
        aria-label={`FiAt current streak: ${stats.currentStreak} days. ${stats.activeToday ? "Completed today" : "Not yet recorded today"}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="font-serif text-base font-black tracking-tight" aria-hidden="true">Fi@</span>
        <strong>{stats.currentStreak}</strong>
      </button>

      {open && (
        <section
          className="fiat-streak-surface fixed left-4 right-4 top-20 z-[90] max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain rounded-3xl border text-slate-800 shadow-lift sm:left-auto sm:right-4 sm:w-[22rem] lg:absolute lg:right-0 lg:top-[calc(100%+.65rem)] lg:max-h-[calc(100dvh-5.5rem)]"
          role="dialog"
          aria-label="FiAt streak"
        >
          <div className="px-5 pb-5 pt-5 sm:px-6">
            <div className="flex items-start justify-between gap-4 text-left">
              <div>
                <p className="text-xs font-black uppercase tracking-[.18em] text-[#9a7000]">FiAt activity</p>
                <h2 className="fiat-streak-title mt-1 font-serif text-2xl font-bold text-[#991f22]">FiAt streak</h2>
              </div>
              <button
                type="button"
                className="fiat-streak-close grid size-11 shrink-0 place-items-center rounded-full text-slate-800 transition hover:bg-[#fdf8e8]"
                aria-label="Close FiAt streak"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="text-center">
              <div className="relative mx-auto mt-1 grid h-20 w-20 place-items-center" aria-hidden="true">
                <Flame className="absolute size-20 fill-[#ff9418] text-[#ff9418]" strokeWidth={1.8} />
                <Flame className="absolute bottom-1 size-9 fill-[#ffc928] text-[#ffc928]" strokeWidth={1.8} />
                <span className="fiat-streak-number relative mt-14 text-4xl font-black leading-none drop-shadow-md">
                  {stats.currentStreak}
                </span>
              </div>
              <p className="mt-5 text-2xl font-black tracking-wide text-[#d98200]">day streak!</p>
            </div>

            <div className="fiat-streak-week mt-6 overflow-hidden rounded-[1.6rem] border border-[#eadc9f] bg-[#fdf9ea]">
              <div className="grid grid-cols-7 gap-2 px-4 pb-5 pt-4 sm:gap-3">
                {weekKeys.map((date, index) => {
                  const completed = completedDays.has(date);
                  const isToday = date === today;
                  return (
                    <div className="flex min-w-0 flex-col items-center gap-3" key={date}>
                      <span className={`text-sm font-black ${isToday ? "text-[#b57600]" : "text-slate-500"}`}>
                        {WEEKDAYS[index]}
                      </span>
                      <span
                        className={`grid size-9 place-items-center rounded-full sm:size-10 ${
                          completed
                            ? "bg-[#ffad32] text-[#3c2c00]"
                            : isToday
                            ? "fiat-streak-day-today border-2 border-[#e5a900] bg-white text-[#c78b00]"
                              : "fiat-streak-day-empty bg-slate-300 text-slate-500"
                        }`}
                        aria-label={`${WEEKDAYS[index]}: ${completed ? "FiAt recorded" : "not recorded"}`}
                      >
                        {completed ? (
                          <Check className="size-5" strokeWidth={3.5} aria-hidden="true" />
                        ) : isToday ? (
                          <Star className="size-6" strokeWidth={2.5} aria-hidden="true" />
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="fiat-streak-copy border-t border-[#eadc9f] px-5 py-5 text-center text-base leading-6 text-slate-700">
                {perfectWeek ? (
                  <p><strong className="text-[#b57600]">Perfect streak!</strong> You recorded a FiAt every day this week.</p>
                ) : (
                  <p>Record a FiAt every day this week to get a <strong className="text-[#b57600]">perfect streak!</strong></p>
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
              Add today&apos;s FiAt
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
