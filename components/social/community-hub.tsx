"use client";

import { useState } from "react";

import {
  Compass,
  Search,
  UsersRound,
  X
} from "lucide-react";

import { DiscoverFeed } from "@/components/social/discover-feed";
import { FollowingFeed } from "@/components/social/following-feed";
import { UserDirectory } from "@/components/social/user-directory";

type CommunityTab =
  | "following"
  | "discover";

export function CommunityHub() {
  const [tab, setTab] =
    useState<CommunityTab>(
      "following"
    );

  const [
    searchOpen,
    setSearchOpen
  ] = useState(false);

  return (
    <div className="space-y-6">
      {/* FOLLOWING + DISCOVER */}
      <div
        role="tablist"
        aria-label="Community feed"
        className="grid grid-cols-2 gap-2"
      >
        <button
          id="community-following-tab"
          type="button"
          role="tab"
          aria-selected={
            tab === "following"
          }
          aria-controls="community-feed-panel"
          className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition ${
            tab === "following"
              ? "bg-sage-100 text-sage-800"
              : "text-muted hover:bg-sage-50 hover:text-ink"
          }`}
          onClick={() =>
            setTab("following")
          }
        >
          <UsersRound
            className="size-4"
            aria-hidden="true"
          />

          Following
        </button>

        <button
          id="community-discover-tab"
          type="button"
          role="tab"
          aria-selected={
            tab === "discover"
          }
          aria-controls="community-feed-panel"
          className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition ${
            tab === "discover"
              ? "bg-sage-100 text-sage-800"
              : "text-muted hover:bg-sage-50 hover:text-ink"
          }`}
          onClick={() =>
            setTab("discover")
          }
        >
          <Compass
            className="size-4"
            aria-hidden="true"
          />

          Discover
        </button>
      </div>

      {/* SEARCH BUTTON */}
      <button
        type="button"
        className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold transition ${
          searchOpen
            ? "border-sage-200 bg-sage-50 text-sage-800"
            : "border-sage-100 bg-paper text-muted hover:bg-sage-50 hover:text-ink"
        }`}
        aria-expanded={searchOpen}
        aria-controls="community-search-panel"
        onClick={() =>
          setSearchOpen(
            (current) => !current
          )
        }
      >
        {searchOpen ? (
          <X
            className="size-4"
            aria-hidden="true"
          />
        ) : (
          <Search
            className="size-4"
            aria-hidden="true"
          />
        )}

        {searchOpen
          ? "Close search"
          : "Search people"}
      </button>

      {/* PEOPLE SEARCH */}
      {searchOpen && (
        <section
          id="community-search-panel"
          aria-label="Search people"
        >
          <UserDirectory />
        </section>
      )}

      {/* COMMUNITY FEED */}
      <div
        id="community-feed-panel"
        role="tabpanel"
        aria-labelledby={
          tab === "following"
            ? "community-following-tab"
            : "community-discover-tab"
        }
      >
        {tab === "following" ? (
          <FollowingFeed />
        ) : (
          <DiscoverFeed />
        )}
      </div>
    </div>
  );
}