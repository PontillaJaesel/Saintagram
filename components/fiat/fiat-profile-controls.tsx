"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Trophy, X } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useExclusivePopup } from "@/components/ui/use-exclusive-popup";
import { usePopupPresence } from "@/components/ui/use-popup-presence";
import { appService } from "@/lib/app-service";
import { calculateFiatStats, eligibleFiatCount, fiatPeriodBounds, localDateKey } from "@/lib/fiat";
import { getFirebaseServices } from "@/lib/firebase";
import type { FiatLeaderboardEntry, FiatLeaderboardPeriod, ReflectionPost } from "@/types";

function FiatLogo() {
  return <span className="font-serif text-base font-black tracking-tight" aria-hidden="true">Fi@</span>;
}

export function FiatProfileControls() {
  const { user, mode } = useAuth();
  const [posts, setPosts] = useState<ReflectionPost[]>([]);
  const [statsOpen, setStatsOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  useExclusivePopup("fiat-streak", statsOpen, setStatsOpen);
  useExclusivePopup("fiat-leaderboard", boardOpen, setBoardOpen);
  const statsPresence = usePopupPresence(statsOpen);
  const boardPresence = usePopupPresence(boardOpen);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void appService.getReflections(user.id).then((items) => {
      if (active) setPosts(items);
    });
    return () => { active = false; };
  }, [user]);

  const stats = useMemo(() => calculateFiatStats(posts), [posts]);

  return <div className="ml-auto flex items-center gap-2">
    <div className="relative">
      <button type="button" className={`fiat-streak-badge ${stats.activeToday ? "fiat-streak-active" : ""}`} aria-label={`FiAt current streak: ${stats.currentStreak} days. ${stats.activeToday ? "Completed today" : "Not yet recorded today"}`} aria-expanded={statsOpen} onClick={() => setStatsOpen((value) => !value)}>
        <FiatLogo /><strong>{stats.currentStreak}</strong>
      </button>
      {statsPresence.rendered && <div className={`${statsPresence.closing ? "popup-panel-exit" : "popup-panel-enter"} absolute right-0 top-[calc(100%+.6rem)] z-40 w-72 rounded-3xl border border-sage-100 bg-paper p-5 shadow-lift`} role="dialog" aria-label="FiAt statistics">
        <h2 className="font-serif text-xl font-bold">FiAt</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-muted">Current Streak</dt><dd className="font-bold">{stats.currentStreak} days</dd></div>
          <div><dt className="text-muted">Today</dt><dd className="font-bold">{stats.activeToday ? "✓ FiAt completed" : "Not yet recorded"}</dd></div>
          <div><dt className="text-muted">This Week</dt><dd className="font-bold">{stats.thisWeekEntries} reflections</dd></div>
          <div><dt className="text-muted">Longest Streak</dt><dd className="font-bold">{stats.longestStreak} days</dd></div>
        </dl>
        <Link href="/reflect" className="btn-primary mt-5 w-full" onClick={() => setStatsOpen(false)}>Add today&apos;s FiAt</Link>
      </div>}
    </div>
    <button type="button" className="grid size-11 place-items-center rounded-full border border-gold-300 bg-paper text-gold-700 transition hover:bg-gold-50" aria-label="Open FiAt leaderboard" aria-expanded={boardOpen} onClick={() => setBoardOpen((value) => !value)}><Trophy className="size-5" /></button>
    {boardPresence.rendered && <FiatLeaderboardDialog posts={posts} mode={mode} closing={boardPresence.closing} onClose={() => setBoardOpen(false)} />}
  </div>;
}

function FiatLeaderboardDialog({ posts, mode, closing, onClose }: { posts: ReflectionPost[]; mode: "firebase" | "local"; closing: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [period, setPeriod] = useState<FiatLeaderboardPeriod>("today");
  const [entries, setEntries] = useState<FiatLeaderboardEntry[]>([]);
  const [current, setCurrent] = useState<FiatLeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError("");
    if (mode === "local") {
      const bounds = fiatPeriodBounds(period);
      const count = eligibleFiatCount(posts, bounds.start, bounds.end);
      const entry = count ? { rank: 1, userId: user.id, profileName: "You", imagePath: "", eligibleCount: count } : null;
      setEntries(entry ? [entry] : []);
      setCurrent(entry);
      setLoading(false);
      return;
    }
    const auth = getFirebaseServices()?.auth.currentUser;
    if (!auth) {
      setError("Firebase authentication is required.");
      setLoading(false);
      return;
    }
    const requestLeaderboard = async () => {
      let token = await auth.getIdToken();
      let response = await fetch(`/api/fiat/leaderboard?period=${period}&today=${localDateKey()}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (response.status === 401) {
        token = await auth.getIdToken(true);
        response = await fetch(`/api/fiat/leaderboard?period=${period}&today=${localDateKey()}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      }
      return response;
    };
    void requestLeaderboard()
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? "Leaderboard unavailable.");
        }
        return response.json() as Promise<{ entries: FiatLeaderboardEntry[]; currentUser: FiatLeaderboardEntry | null }>;
      })
      .then((data) => { setEntries(data.entries); setCurrent(data.currentUser); })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Leaderboard unavailable."))
      .finally(() => setLoading(false));
  }, [mode, period, posts, user]);

  return <div className={`${closing ? "popup-backdrop-exit" : "popup-backdrop-enter"} fixed inset-0 z-[100] grid place-items-center bg-ink/45 p-4 backdrop-blur-sm`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="fiat-leaderboard-title" className={`${closing ? "popup-panel-exit" : "popup-panel-enter"} w-full max-w-lg rounded-4xl border border-sage-100 bg-paper p-6 shadow-lift`}>
      <div className="flex items-start justify-between"><div><p className="eyebrow">FiAt activity</p><h2 id="fiat-leaderboard-title" className="mt-1 font-serif text-2xl font-bold">FiAt Leaderboard</h2></div><button type="button" className="grid size-11 place-items-center rounded-full hover:bg-sage-50" onClick={onClose} aria-label="Close leaderboard"><X /></button></div>
      <div className="mt-5 grid grid-cols-3 rounded-full bg-sage-50 p-1" role="tablist" aria-label="Leaderboard period">
        {(["today", "week", "month"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={period === value} className={`min-h-10 rounded-full px-3 text-sm font-bold capitalize ${period === value ? "bg-paper text-sage-700 shadow-sm" : "text-muted"}`} onClick={() => setPeriod(value)}>{value}</button>)}
      </div>
      <p className="mt-4 text-xs leading-5 text-muted">Ranks reflect all recorded FiAt activity, not a measure of holiness. Every FiAt entry counts.</p>
      {loading ? <p className="py-8 text-center text-muted">Loading…</p> : error ? <p className="py-8 text-center text-clay-600" role="alert">{error}</p> : entries.length ? <ol className="mt-4 max-h-72 space-y-2 overflow-y-auto">{entries.map((entry) => { const isCurrentUser = entry.userId === user?.id; return <li key={entry.userId} className={`flex items-center gap-3 rounded-2xl border p-3 transition ${isCurrentUser ? "border-gold-300 bg-gold-50 shadow-sm" : "border-sage-100"}`}><strong className={`w-7 text-center ${isCurrentUser ? "text-gold-700" : ""}`}>{entry.rank}</strong><span className={`min-w-0 flex-1 truncate font-semibold ${isCurrentUser ? "text-gold-700" : "text-ink"}`}>{isCurrentUser ? "You" : entry.profileName}</span><span className={`text-sm font-bold ${isCurrentUser ? "text-gold-700" : "text-sage-700"}`}>{entry.eligibleCount} FiAt{entry.eligibleCount === 1 ? "" : "s"}</span></li>; })}</ol> : <p className="py-8 text-center text-muted">No recorded FiAt activity in this period.</p>}
      {current && !entries.some((entry) => entry.userId === current.userId) && <div className="mt-4 border-t border-sage-100 pt-4 text-sm"><strong>Your Rank: {current.rank}</strong> · {current.eligibleCount} FiAts</div>}
    </section>
  </div>;
}
