"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, Expand, Play, X } from "lucide-react";
import { reflectionMediaUrl } from "@/lib/reflection-media";
import { getFirebaseServices } from "@/lib/firebase";
import type { ReflectionMedia } from "@/types";

type ResolvedMedia = ReflectionMedia & { url: string };

async function downloadMedia(item: ResolvedMedia): Promise<void> {
  const user = getFirebaseServices()?.auth.currentUser;
  if (!user) throw new Error("Please sign in again before downloading media.");
  const response = await fetch("/api/reflection-media/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ path: item.path })
  });
  if (!response.ok) throw new Error("The media could not be downloaded.");
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = item.path.split("/").pop() || `saintagram-${item.type}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}

export function ReflectionMediaView({ media, compact = false }: { media?: ReflectionMedia[]; compact?: boolean }) {
  const [items, setItems] = useState<ResolvedMedia[]>([]);
  const [active, setActive] = useState(0);
  const [fullscreen, setFullscreen] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const sliderRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    let current = true;
    if (!media?.length) { setItems([]); return; }
    void Promise.all(media.map(async (item) => ({ ...item, url: await reflectionMediaUrl(item.path) })))
      .then((resolved) => { if (current) setItems(resolved); })
      .catch(() => { if (current) setItems([]); });
    return () => { current = false; };
  }, [media]);

  useEffect(() => {
    if (fullscreen === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(null);
      if (event.key === "ArrowLeft") setFullscreen((value) => value === null ? null : Math.max(0, value - 1));
      if (event.key === "ArrowRight") setFullscreen((value) => value === null ? null : Math.min(items.length - 1, value + 1));
    };
    window.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", keydown); };
  }, [fullscreen, items.length]);

  if (!items.length) return null;

  const moveTo = (index: number) => {
    const next = Math.max(0, Math.min(items.length - 1, index));
    const slide = sliderRef.current?.children[next] as HTMLElement | undefined;
    if (slide && sliderRef.current) {
      sliderRef.current.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
    }
    setActive(next);
  };

  const preview = (
    <div className={`relative mt-4 w-full overflow-hidden rounded-2xl bg-black/5 ${compact ? "max-w-lg" : "max-w-none"}`}>
      <div
        ref={sliderRef}
        className={`flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${items.length > 1 ? "gap-2" : ""}`}
        onScroll={(event) => {
          const slides = Array.from(event.currentTarget.children) as HTMLElement[];
          if (!slides.length) return;
          const nearest = slides.reduce((best, slide, index) =>
            Math.abs(slide.offsetLeft - event.currentTarget.scrollLeft) <
            Math.abs(slides[best].offsetLeft - event.currentTarget.scrollLeft) ? index : best, 0);
          setActive(nearest);
        }}
      >
        {items.map((item, index) => (
          <button
            key={item.path}
            type="button"
            className={`relative shrink-0 snap-start overflow-hidden bg-black/5 ${items.length === 1 ? "w-full" : "aspect-[4/5] w-[calc(100%-2.5rem)] sm:w-[calc(100%-4rem)]"}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDownloadError("");
              setFullscreen(index);
            }}
            aria-label={`Open ${item.type} ${index + 1} in full screen`}
          >
            {item.type === "video" ? (
              <><video src={item.url} className={items.length === 1 ? "block h-auto w-full" : "size-full object-cover"} playsInline muted preload="metadata" /><span className="absolute inset-0 grid place-items-center"><span className="grid size-14 place-items-center rounded-full bg-black/60 text-white"><Play className="ml-1 size-7" fill="currentColor" /></span></span></>
            ) : (
              <img src={item.url} alt={`Reflection photo ${index + 1}`} className={items.length === 1 ? "block h-auto w-full" : "size-full object-cover"} loading="lazy" />
            )}
            <span className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/55 text-white"><Expand className="size-4" /></span>
          </button>
        ))}
      </div>
      {items.length > 1 && <>
        {active > 0 && <button type="button" className="absolute left-2 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white sm:grid" onClick={() => moveTo(active - 1)} aria-label="Previous photo"><ChevronLeft /></button>}
        {active < items.length - 1 && <button type="button" className="absolute right-2 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white sm:grid" onClick={() => moveTo(active + 1)} aria-label="Next photo"><ChevronRight /></button>}
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-2" aria-label={`Image ${active + 1} of ${items.length}`}>
          {items.map((item, index) => <span key={item.path} className={`size-1.5 rounded-full ${index === active ? "bg-white" : "bg-white/45"}`} />)}
        </div>
      </>}
    </div>
  );

  const overlay = fullscreen !== null && typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/95 text-white" role="dialog" aria-modal="true" aria-label="Full-screen reflection media">
      <div className="flex min-h-16 items-center justify-between gap-3 px-4">
        <span className="text-sm font-semibold">{fullscreen + 1} of {items.length}</span>
        <div className="flex gap-2">
          <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/15 px-4 font-bold hover:bg-white/25" onClick={() => void downloadMedia(items[fullscreen]).catch((error) => setDownloadError(error instanceof Error ? error.message : "Download failed."))}><Download className="size-5" />Save</button>
          <button type="button" className="grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25" onClick={() => setFullscreen(null)} aria-label="Close full-screen preview"><X /></button>
        </div>
      </div>
      <div
        className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center p-4"
        onTouchStart={(event) => { touchStart.current = event.changedTouches[0]?.clientX ?? null; }}
        onTouchEnd={(event) => {
          if (touchStart.current === null) return;
          const distance = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
          if (distance > 50 && fullscreen > 0) setFullscreen(fullscreen - 1);
          if (distance < -50 && fullscreen < items.length - 1) setFullscreen(fullscreen + 1);
          touchStart.current = null;
        }}
      >
        {items[fullscreen].type === "video" ? <video src={items[fullscreen].url} className="max-h-full max-w-full object-contain" controls autoPlay playsInline /> : <img src={items[fullscreen].url} alt={`Reflection photo ${fullscreen + 1}`} className="max-h-full max-w-full object-contain" />}
        {fullscreen > 0 && <button type="button" className="absolute left-3 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 hover:bg-white/25" onClick={() => setFullscreen(fullscreen - 1)} aria-label="Previous media"><ChevronLeft /></button>}
        {fullscreen < items.length - 1 && <button type="button" className="absolute right-3 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 hover:bg-white/25" onClick={() => setFullscreen(fullscreen + 1)} aria-label="Next media"><ChevronRight /></button>}
      </div>
      {downloadError && <p className="px-4 pb-4 text-center text-sm text-clay-200" role="alert">{downloadError}</p>}
    </div>, document.body
  ) : null;

  return <>{preview}{overlay}</>;
}
