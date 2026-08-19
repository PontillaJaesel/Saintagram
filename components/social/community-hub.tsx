"use client";

import { useEffect, useState } from "react";
import {
  Compass,
  Pin,
  Search,
  UsersRound,
  X
} from "lucide-react";

import {
  CommunityBulletin,
  useCommunityBulletins
} from "@/components/social/community-bulletin";
import { DiscoverFeed } from "@/components/social/discover-feed";
import { FollowingFeed } from "@/components/social/following-feed";
import { UserDirectory } from "@/components/social/user-directory";

type FeedTab = "following" | "discover";

export function CommunityHub() {
  const [feedTab, setFeedTab] = useState<FeedTab>("following");
  const [mobileBulletinOpen, setMobileBulletinOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const bulletins = useCommunityBulletins();

  useEffect(() => {
    function openBulletinFromNavigation() {
      const parameters =
        new URLSearchParams(
          window.location.search
        );

      const requested =
        parameters.get(
          "bulletin"
        ) === "open";

      if (!requested) {
        return;
      }

      /*
      * Desktop already displays the Bulletin in
      * the right-hand column.
      *
      * Mobile/tablet must activate its Pin tab.
      */
      const desktop =
        window.matchMedia(
          "(min-width: 1280px)"
        );

      if (!desktop.matches) {
        setMobileBulletinOpen(
          true
        );

        setSearchOpen(
          false
        );
      }

      window.requestAnimationFrame(
        () => {
          window.scrollTo({
            top: 0,
            behavior: "smooth"
          });
        }
      );
    }

    openBulletinFromNavigation();

    window.addEventListener(
      "saintagram:open-bulletin",
      openBulletinFromNavigation
    );

    return () => {
      window.removeEventListener(
        "saintagram:open-bulletin",
        openBulletinFromNavigation
      );
    };
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1280px)");
    const syncDesktopState = () => {
      if (desktop.matches) setMobileBulletinOpen(false);
    };

    syncDesktopState();
    desktop.addEventListener("change", syncDesktopState);
    return () => desktop.removeEventListener("change", syncDesktopState);
  }, []);

  const chooseFeedTab = (nextTab: FeedTab) => {
    setFeedTab(nextTab);
    setMobileBulletinOpen(false);
  };

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        <div
          role="tablist"
          aria-label="Community feed"
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3.5rem] gap-2 xl:grid-cols-2"
        >
          <button
            id="community-following-tab"
            type="button"
            role="tab"
            aria-selected={!mobileBulletinOpen && feedTab === "following"}
            aria-controls="community-feed-panel"
            className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition ${
              !mobileBulletinOpen && feedTab === "following"
                ? "community-tab-active bg-brand-50 text-brand-500"
                : "text-muted hover:bg-sage-50 hover:text-ink"
            }`}
            onClick={() => chooseFeedTab("following")}
          >
            <UsersRound className="size-4" aria-hidden="true" />
            Following
          </button>

          <button
            id="community-discover-tab"
            type="button"
            role="tab"
            aria-selected={!mobileBulletinOpen && feedTab === "discover"}
            aria-controls="community-feed-panel"
            className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition ${
              !mobileBulletinOpen && feedTab === "discover"
                ? "community-tab-active bg-brand-50 text-brand-500"
                : "text-muted hover:bg-sage-50 hover:text-ink"
            }`}
            onClick={() => chooseFeedTab("discover")}
          >
            <Compass className="size-4" aria-hidden="true" />
            Discover
          </button>

          <button
            id="community-bulletin-tab"
            type="button"
            role="tab"
            aria-label="Bulletin"
            title="Bulletin"
            aria-selected={mobileBulletinOpen}
            aria-controls="community-feed-panel"
            className={`flex min-h-12 items-center justify-center rounded-2xl px-2 transition xl:hidden ${
              mobileBulletinOpen
                ? "community-tab-active bg-brand-50 text-brand-500"
                : "text-muted hover:bg-sage-50 hover:text-ink"
            }`}
            onClick={() => {
              setMobileBulletinOpen(true);
              setSearchOpen(false);
            }}
          >
            <Pin className="size-4" aria-hidden="true" />
          </button>
        </div>

        {!mobileBulletinOpen && (
          <>
            <button
              type="button"
              className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold transition ${
                searchOpen
                  ? "border-sage-200 bg-sage-50 text-sage-800"
                  : "border-sage-100 bg-paper text-muted hover:bg-sage-50 hover:text-ink"
              }`}
              aria-expanded={searchOpen}
              aria-controls="community-search-panel"
              onClick={() => setSearchOpen((current) => !current)}
            >
              {searchOpen ? (
                <X className="size-4" aria-hidden="true" />
              ) : (
                <Search className="size-4" aria-hidden="true" />
              )}

              {searchOpen ? "Close search" : "Search people"}
            </button>

            {searchOpen && (
              <section id="community-search-panel" aria-label="Search people">
                <UserDirectory />
              </section>
            )}
          </>
        )}

        <div
          id="community-feed-panel"
          role="tabpanel"
          aria-labelledby={
            mobileBulletinOpen
              ? "community-bulletin-tab"
              : feedTab === "following"
                ? "community-following-tab"
                : "community-discover-tab"
          }
        >
          {mobileBulletinOpen ? (
            <>
              <div className="xl:hidden">
                <CommunityBulletin {...bulletins} />
              </div>

              <div className="hidden xl:block">
                {feedTab === "following" ? (
                  <FollowingFeed onFindPeople={() => chooseFeedTab("discover")} />
                ) : (
                  <DiscoverFeed />
                )}
              </div>
            </>
          ) : feedTab === "following" ? (
            <FollowingFeed onFindPeople={() => chooseFeedTab("discover")} />
          ) : (
            <DiscoverFeed />
          )}
        </div>
      </div>

      <aside className="sticky top-6 hidden min-w-0 xl:block" aria-label="Saintagram bulletin">
        <CommunityBulletin {...bulletins} compact />
      </aside>
    </div>
  );
}