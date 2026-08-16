import { NextResponse } from "next/server";

import {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore
} from "@/lib/firebase-admin";

import {
  eligibleFiatCount,
  fiatPeriodBounds,
  isFiatCategory
} from "@/lib/fiat";

import type {
  FiatLeaderboardEntry,
  FiatLeaderboardPeriod,
  ReflectionPost
} from "@/types";

const headers = {
  "Cache-Control": "no-store"
};

type LeaderboardView =
  | "preview"
  | "full";

export async function GET(
  request: Request
) {
  try {
    /*
     * AUTHENTICATION
     */
    const bearer =
      request.headers.get(
        "authorization"
      ) ?? "";

    if (
      !bearer.startsWith(
        "Bearer "
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Authentication is required."
        },
        {
          status: 401,
          headers
        }
      );
    }

    const token =
      await getFirebaseAdminAuth()
        .verifyIdToken(
          bearer.slice(7)
        );

    /*
     * QUERY PARAMETERS
     */
    const url =
      new URL(request.url);

    const period =
      url.searchParams.get(
        "period"
      ) as FiatLeaderboardPeriod;

    const today =
      url.searchParams.get(
        "today"
      ) ?? "";

    const requestedView =
      url.searchParams.get(
        "view"
      );

    const view: LeaderboardView =
      requestedView === "full"
        ? "full"
        : "preview";

    if (
      ![
        "today",
        "week",
        "month"
      ].includes(period) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(
        today
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid leaderboard period."
        },
        {
          status: 400,
          headers
        }
      );
    }

    /*
     * The full page only supports
     * weekly and monthly rankings.
     */
    if (
      view === "full" &&
      period === "today"
    ) {
      return NextResponse.json(
        {
          error:
            "The full leaderboard is available only for weekly and monthly rankings."
        },
        {
          status: 400,
          headers
        }
      );
    }

    const db =
      getFirebaseAdminFirestore();

    /*
     * LOAD REFLECTIONS + PROFILES
     */
    const [
      reflections,
      profiles
    ] =
      await Promise.all([
        db
          .collection(
            "reflectionPosts"
          )
          .get(),

        db
          .collection(
            "socialProfiles"
          )
          .get()
      ]);

    /*
     * PROFILE LOOKUP
     */
    const profileMap =
      new Map(
        profiles.docs.map(
          (document) => [
            document.id,
            document.data()
          ]
        )
      );

    /*
     * GROUP FIAT POSTS
     * BY USER
     */
    const byUser =
      new Map<
        string,
        ReflectionPost[]
      >();

    for (
      const document
      of reflections.docs
    ) {
      const data =
        document.data();

      const userId =
        typeof data.userId ===
        "string"
          ? data.userId
          : "";

      /*
       * Ignore:
       *
       * - invalid users
       * - users without a social profile
       * - reflections without FiAt
       */
      if (
        !userId ||
        !profileMap.has(
          userId
        ) ||
        !isFiatCategory(
          data.fiatCategory
        )
      ) {
        continue;
      }

      const createdAt =
        data.createdAt
          ?.toDate?.()
          ?.toISOString?.() ??
        String(
          data.createdAt ?? ""
        );

      const post:
        ReflectionPost = {
          id: document.id,
          userId,

          /*
           * Content itself is not
           * needed for leaderboard
           * calculations.
           */
          content: "",

          isPrivate:
            Boolean(
              data.isPrivate
            ),

          createdAt,
          updatedAt:
            createdAt,

          fiatCategory:
            data.fiatCategory,

          ...(
            typeof data.fiatDateKey ===
            "string"
              ? {
                  fiatDateKey:
                    data.fiatDateKey
                }
              : {}
          )
        };

      byUser.set(
        userId,
        [
          ...(
            byUser.get(
              userId
            ) ?? []
          ),
          post
        ]
      );
    }

    /*
     * PERIOD RANGE
     */
    const bounds =
      fiatPeriodBounds(
        period,
        today
      );

    /*
     * CALCULATE RANKINGS
     */
    const ranked =
      [...byUser.entries()]
        .map(
          ([
            userId,
            posts
          ]) => {
            const profile =
              profileMap.get(
                userId
              )!;

            return {
              userId,

              profileName:
                typeof profile
                  .profileName ===
                "string"
                  ? profile
                      .profileName
                  : "Saintagram user",

              imagePath:
                typeof profile
                  .imagePath ===
                "string"
                  ? profile
                      .imagePath
                  : "",

              eligibleCount:
                eligibleFiatCount(
                  posts,
                  bounds.start,
                  bounds.end
                )
            };
          }
        )

        /*
         * Users with zero FiAt
         * activity are not ranked.
         */
        .filter(
          (entry) =>
            entry
              .eligibleCount >
            0
        )

        /*
         * Ranking order:
         *
         * 1. Most FiAt entries
         * 2. Profile name
         * 3. UID
         *
         * This keeps ties
         * deterministic.
         */
        .sort(
          (a, b) =>
            b.eligibleCount -
              a.eligibleCount ||
            a.profileName
              .localeCompare(
                b.profileName
              ) ||
            a.userId
              .localeCompare(
                b.userId
              )
        )

        /*
         * Assign actual rank.
         */
        .map(
          (
            entry,
            index
          ):
            FiatLeaderboardEntry => ({
              ...entry,
              rank:
                index + 1
            })
        );

    /*
     * IMPORTANT:
     *
     * The current user is found
     * BEFORE limiting the preview.
     *
     * Example:
     *
     * User rank = 73
     *
     * Popup can still display:
     *
     * Your Rank: 73
     */
    const currentUser =
      ranked.find(
        (entry) =>
          entry.userId ===
          token.uid
      ) ?? null;

    /*
     * PREVIEW
     *
     * Top 5 only.
     *
     * FULL
     *
     * Every ranked user.
     */
    const entries =
      view === "full"
        ? ranked
        : ranked.slice(
            0,
            5
          );

    return NextResponse.json(
      {
        entries,
        currentUser,
        period,
        view,
        bounds,
        totalRankedUsers:
          ranked.length
      },
      {
        headers
      }
    );
  } catch (error) {
    console.error(
      "FiAt leaderboard request failed.",
      error
    );

    const code =
      typeof error ===
        "object" &&
      error &&
      "code" in error
        ? String(
            error.code
          )
        : "";

    const authenticationError =
      code.startsWith(
        "auth/"
      );

    return NextResponse.json(
      {
        error:
          authenticationError
            ? "Please sign in again."
            : "The FiAt leaderboard could not be loaded."
      },
      {
        status:
          authenticationError
            ? 401
            : 500,
        headers
      }
    );
  }
}