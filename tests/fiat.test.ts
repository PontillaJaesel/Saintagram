import { describe, expect, it } from "vitest";

import {
  calculateFiatStats,
  eligibleFiatCount,
  fiatCalendarDayState,
  fiatPeriodBounds,
  findLatestFiatStreakLoss,
  isFiatCategory,
  localDateKey
} from "@/lib/fiat";
import type { FiatCategory, ReflectionPost } from "@/types";

const post = (
  date: string,
  category: FiatCategory = "prayer",
  id = date,
  isPrivate = false
): ReflectionPost => ({
  id,
  userId: "alice",
  content: "A yes",
  isPrivate,
  createdAt: `${date}T12:00:00.000Z`,
  updatedAt: `${date}T12:00:00.000Z`,
  fiatCategory: category,
  fiatDateKey: date
});

describe("FiAt domain", () => {
  it("validates only canonical categories", () => {
    expect(isFiatCategory("prayer")).toBe(true);
    expect(isFiatCategory("score")).toBe(false);
  });

  it("counts multiple reflections on one date as one streak day", () => {
    const stats = calculateFiatStats([
      post("2026-08-11", "prayer", "1"),
      post("2026-08-11", "service", "2")
    ], "2026-08-11");

    expect(stats.currentStreak).toBe(1);
    expect(stats.totalFiatEntries).toBe(2);
    expect(stats.totalFiatDays).toBe(1);
  });

  it("counts private FiAt for the personal streak but excludes it from leaderboard counts", () => {
    const privatePost = post("2026-08-11", "service", "private", true);
    const stats = calculateFiatStats([privatePost], "2026-08-11");

    expect(stats).toMatchObject({
      currentStreak: 1,
      activeToday: true,
      totalFiatEntries: 1,
      totalFiatDays: 1,
      thisWeekEntries: 1
    });
    expect(eligibleFiatCount([privatePost], "2026-08-11", "2026-08-11")).toBe(0);
  });

  it("uses Freeze 1 on the first missed day and keeps the streak count unchanged", () => {
    const stats = calculateFiatStats([post("2026-08-18")], "2026-08-19");

    expect(stats).toMatchObject({
      currentStreak: 1,
      frozenToday: true,
      freezeUsed: 1,
      freezeRemaining: 1,
      streakLostToday: false
    });
    expect(fiatCalendarDayState([post("2026-08-18")], "2026-08-19", "2026-08-19")).toBe("freeze-1");
  });

  it("uses Freeze 2 on the second consecutive missed day", () => {
    const stats = calculateFiatStats([post("2026-08-18")], "2026-08-20");

    expect(stats).toMatchObject({
      currentStreak: 1,
      frozenToday: true,
      freezeUsed: 2,
      freezeRemaining: 0,
      streakLostToday: false
    });
    expect(fiatCalendarDayState([post("2026-08-18")], "2026-08-20", "2026-08-20")).toBe("freeze-2");
  });

  it("loses the streak on the third consecutive missed day", () => {
    const stats = calculateFiatStats([post("2026-08-18")], "2026-08-21");

    expect(stats).toMatchObject({
      currentStreak: 0,
      frozenToday: false,
      freezeUsed: 0,
      streakLostToday: true,
      streakLostDate: "2026-08-21"
    });
    expect(fiatCalendarDayState([post("2026-08-18")], "2026-08-21", "2026-08-21")).toBe("lost");
    expect(findLatestFiatStreakLoss([post("2026-08-18")], "2026-08-21")).toEqual({
      lostDate: "2026-08-21",
      lastFiatDate: "2026-08-18",
      previousStreak: 1
    });
  });

  it("starts a new streak after a loss", () => {
    const posts = [post("2026-08-18"), post("2026-08-22")];
    const stats = calculateFiatStats(posts, "2026-08-22");

    expect(stats.currentStreak).toBe(1);
    expect(stats.activeToday).toBe(true);
    expect(stats.streakLostToday).toBe(false);
    expect(stats.streakLostDate).toBe("2026-08-21");
  });

  it("resumes the same streak after one or two freeze days", () => {
    const oneFreeze = [post("2026-08-18"), post("2026-08-20")];
    const twoFreezes = [post("2026-08-18"), post("2026-08-21")];

    expect(calculateFiatStats(oneFreeze, "2026-08-20").currentStreak).toBe(2);
    expect(calculateFiatStats(twoFreezes, "2026-08-21").currentStreak).toBe(2);
  });

  it("uses creation date rather than edit time", () => {
    const edited = {
      ...post("2026-08-01"),
      updatedAt: "2026-08-12T12:00:00.000Z",
      editedAt: "2026-08-12T12:00:00.000Z"
    };

    expect(calculateFiatStats([edited], "2026-08-12").activeToday).toBe(false);
  });

  it("counts every public leaderboard entry without a daily cap", () => {
    const entries = Array.from({ length: 5 }, (_, index) =>
      post("2026-08-11", "prayer", String(index))
    );

    expect(eligibleFiatCount(entries, "2026-08-11", "2026-08-11")).toBe(5);
  });

  it("calculates Monday week and calendar month bounds", () => {
    expect(fiatPeriodBounds("week", "2026-08-12")).toEqual({
      start: "2026-08-10",
      end: "2026-08-16"
    });
    expect(fiatPeriodBounds("month", "2026-08-12")).toEqual({
      start: "2026-08-01",
      end: "2026-08-31"
    });
  });

  it("creates stable local keys", () => {
    expect(localDateKey(new Date(2026, 7, 11, 12))).toBe("2026-08-11");
  });
});
