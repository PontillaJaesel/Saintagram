import type {
  FiatCalendarDayState,
  FiatCategory,
  FiatLeaderboardPeriod,
  FiatStats,
  FiatStreakLoss,
  ReflectionPost
} from "@/types";

export const FIAT_FREEZE_LIMIT = 2 as const;

export const FIAT_CATEGORIES: readonly { value: FiatCategory; label: string }[] = [
  { value: "prayer", label: "Prayer" },
  { value: "forgiveness", label: "Forgiveness" },
  { value: "service", label: "Service" },
  { value: "sacrifice", label: "Sacrifice" },
  { value: "act-of-love", label: "Act of Love" },
  { value: "responsible-choice", label: "Responsible Choice" },
  { value: "other", label: "Other" }
] as const;

const categorySet = new Set<string>(FIAT_CATEGORIES.map((item) => item.value));

export function isFiatCategory(value: unknown): value is FiatCategory {
  return typeof value === "string" && categorySet.has(value);
}

export function fiatCategoryLabel(value: FiatCategory): string {
  return FIAT_CATEGORIES.find((item) => item.value === value)?.label ?? "Other";
}

export function localDateKey(value: Date | string = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function reflectionFiatDateKey(
  post: Pick<ReflectionPost, "createdAt" | "fiatDateKey">
): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(post.fiatDateKey ?? "")
    ? post.fiatDateKey!
    : localDateKey(post.createdAt);
}

function dateKeyParts(key: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const value = new Date(Date.UTC(year, month - 1, day));

  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  ) {
    return null;
  }

  return [year, month, day];
}

function dateKeyDayNumber(key: string): number {
  const parts = dateKeyParts(key);
  if (!parts) return Number.NaN;
  return Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86_400_000);
}

export function addFiatDays(key: string, amount: number): string {
  const dayNumber = dateKeyDayNumber(key);
  if (!Number.isFinite(dayNumber)) return "";

  const date = new Date((dayNumber + amount) * 86_400_000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fiatDaysBetween(start: string, end: string): number {
  const startDay = dateKeyDayNumber(start);
  const endDay = dateKeyDayNumber(end);
  return Number.isFinite(startDay) && Number.isFinite(endDay)
    ? endDay - startDay
    : Number.NaN;
}

export function fiatPeriodBounds(
  period: FiatLeaderboardPeriod,
  today = localDateKey()
): { start: string; end: string } {
  if (period === "today") return { start: today, end: today };

  const parts = dateKeyParts(today);
  if (!parts) return { start: today, end: today };

  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12));

  if (period === "week") {
    const offset = (date.getUTCDay() + 6) % 7;
    return {
      start: addFiatDays(today, -offset),
      end: addFiatDays(today, 6 - offset)
    };
  }

  const start = `${today.slice(0, 7)}-01`;
  const endDate = new Date(Date.UTC(parts[0], parts[1], 0, 12));
  const end = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, "0")}-${String(endDate.getUTCDate()).padStart(2, "0")}`;
  return { start, end };
}

/**
 * Personal FiAt streaks count both public and private FiAt reflections.
 * Privacy only affects public surfaces such as the leaderboard.
 */
export function personalFiatDays(posts: readonly ReflectionPost[]): Set<string> {
  return new Set(
    posts
      .filter((post) => Boolean(post.fiatCategory))
      .map(reflectionFiatDateKey)
      .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
  );
}

function sortedPersonalFiatDays(
  posts: readonly ReflectionPost[],
  today?: string
): string[] {
  const keys = [...personalFiatDays(posts)].sort();
  return today ? keys.filter((key) => key <= today) : keys;
}

/**
 * A FiAt streak survives up to two consecutive missed calendar days.
 * Those missed days are automatic freezes and do not increase the streak count.
 * The third consecutive missed day breaks the streak.
 */
export function findLatestFiatStreakLoss(
  posts: readonly ReflectionPost[],
  today = localDateKey()
): FiatStreakLoss | null {
  const days = sortedPersonalFiatDays(posts, today);
  if (!days.length) return null;

  let segmentCount = 1;
  let previous = days[0];
  let latestLoss: FiatStreakLoss | null = null;

  for (let index = 1; index < days.length; index += 1) {
    const current = days[index];
    const gap = fiatDaysBetween(previous, current);

    if (gap > FIAT_FREEZE_LIMIT + 1) {
      latestLoss = {
        lostDate: addFiatDays(previous, FIAT_FREEZE_LIMIT + 1),
        lastFiatDate: previous,
        previousStreak: segmentCount
      };
      segmentCount = 1;
    } else {
      segmentCount += 1;
    }

    previous = current;
  }

  const trailingGap = fiatDaysBetween(previous, today);
  if (trailingGap >= FIAT_FREEZE_LIMIT + 1) {
    latestLoss = {
      lostDate: addFiatDays(previous, FIAT_FREEZE_LIMIT + 1),
      lastFiatDate: previous,
      previousStreak: segmentCount
    };
  }

  return latestLoss;
}

export function fiatCalendarDayState(
  posts: readonly ReflectionPost[],
  dateKey: string,
  today = localDateKey()
): FiatCalendarDayState {
  if (dateKey > today) return "future";

  const days = sortedPersonalFiatDays(posts, today);
  if (days.includes(dateKey)) return "fiat";

  let previousFiat = "";
  for (const key of days) {
    if (key >= dateKey) break;
    previousFiat = key;
  }

  if (!previousFiat) return "inactive";

  const missedDays = fiatDaysBetween(previousFiat, dateKey);
  if (missedDays === 1) return "freeze-1";
  if (missedDays === 2) return "freeze-2";
  if (missedDays === 3) return "lost";
  return "inactive";
}

export function calculateFiatStats(
  posts: readonly ReflectionPost[],
  today = localDateKey()
): FiatStats {
  const fiatEntries = posts.filter(
    (post) => Boolean(post.fiatCategory) && reflectionFiatDateKey(post)
  );
  const allDays = personalFiatDays(posts);
  const days = [...allDays].filter((key) => key <= today).sort();

  let longest = 0;
  let segmentCount = 0;
  let previous = "";

  for (const key of days) {
    const gap = previous ? fiatDaysBetween(previous, key) : Number.NaN;
    segmentCount = previous && gap <= FIAT_FREEZE_LIMIT + 1
      ? segmentCount + 1
      : 1;
    longest = Math.max(longest, segmentCount);
    previous = key;
  }

  let currentStreak = 0;
  let freezeUsed: 0 | 1 | 2 = 0;
  let activeToday = false;
  let frozenToday = false;

  if (days.length) {
    const last = days.at(-1)!;
    const trailingGap = fiatDaysBetween(last, today);

    if (trailingGap <= FIAT_FREEZE_LIMIT) {
      currentStreak = segmentCount;
      activeToday = trailingGap === 0;
      frozenToday = trailingGap === 1 || trailingGap === 2;
      freezeUsed = frozenToday ? (trailingGap as 1 | 2) : 0;
    }
  }

  const latestLoss = findLatestFiatStreakLoss(posts, today);
  const week = fiatPeriodBounds("week", today);

  return {
    currentStreak,
    longestStreak: longest,
    activeToday,
    frozenToday,
    freezeUsed,
    freezeRemaining: FIAT_FREEZE_LIMIT - freezeUsed,
    streakLostToday: latestLoss?.lostDate === today,
    streakLostDate: latestLoss?.lostDate ?? null,
    totalFiatEntries: fiatEntries.length,
    totalFiatDays: allDays.size,
    thisWeekEntries: fiatEntries.filter((post) => {
      const key = reflectionFiatDateKey(post);
      return key >= week.start && key <= week.end;
    }).length
  };
}

/**
 * Leaderboards remain public-only: private FiAt reflections never contribute.
 */
export function eligibleFiatCount(
  posts: readonly ReflectionPost[],
  start: string,
  end: string
): number {
  return posts.filter((post) => {
    if (post.isPrivate || !post.fiatCategory) return false;
    const key = reflectionFiatDateKey(post);
    return key >= start && key <= end;
  }).length;
}
