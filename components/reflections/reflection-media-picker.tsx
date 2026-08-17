"use client";

import { useEffect, useRef, useState } from "react";
import { Images, Trash2, Video } from "lucide-react";

export function ReflectionMediaPicker({ files, onChange, disabled = false }: { files: File[]; onChange: (files: File[]) => void; disabled?: boolean }) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  const choose = (list: FileList | null) => { if (list) onChange(Array.from(list)); };

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    setActive(0);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  return <div className="mt-5 rounded-2xl border border-dashed border-sage-200 p-4">
    <p className="text-sm font-bold">Add media <span className="font-normal text-muted">(optional)</span></p>
    <p className="mt-1 text-xs text-muted">Up to 5 photos, or one video no longer than 15 seconds.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <label className="btn-secondary cursor-pointer"><Images className="size-4" />Gallery<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple disabled={disabled} onChange={(event) => choose(event.target.files)} /></label>
    </div>

    {files.length > 0 && <>
      <div className="relative mt-4 w-full max-w-lg overflow-hidden rounded-2xl bg-black/5">
        <div
          ref={sliderRef}
          className={`flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${files.length > 1 ? "gap-2" : ""}`}
          onScroll={(event) => {
            const slides = Array.from(event.currentTarget.children) as HTMLElement[];
            if (!slides.length) return;
            const nearest = slides.reduce((best, slide, index) => Math.abs(slide.offsetLeft - event.currentTarget.scrollLeft) < Math.abs(slides[best].offsetLeft - event.currentTarget.scrollLeft) ? index : best, 0);
            setActive(nearest);
          }}
          aria-label="Selected media preview"
        >
          {files.map((file, index) => <div className={`relative aspect-[4/5] shrink-0 snap-start overflow-hidden bg-black/5 ${files.length === 1 ? "w-full" : "w-[calc(100%-2.5rem)] sm:w-[calc(100%-4rem)]"}`} key={`${file.name}-${file.lastModified}-${index}`}>
            {file.type.startsWith("video/")
              ? <video src={previews[index]} className="size-full object-contain" controls playsInline preload="metadata" />
              : <img src={previews[index]} alt={`Selected photo ${index + 1}`} className="size-full object-contain" />}
          </div>)}
        </div>
        {files.length > 1 && <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-2" aria-label={`Image ${active + 1} of ${files.length}`}>
          {files.map((file, index) => <span key={`${file.name}-${index}`} className={`size-1.5 rounded-full ${index === active ? "bg-white" : "bg-white/45"}`} />)}
        </div>}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-sage-50 p-3 text-sm">
        <span className="inline-flex min-w-0 items-center gap-2"><span className="shrink-0">{files.some((file) => file.type.startsWith("video/")) ? <Video className="size-4" /> : <Images className="size-4" />}</span><span className="truncate">{files.length === 1 ? files[0].name : `${files.length} photos selected`}</span></span>
        <button type="button" className="ml-2 shrink-0 text-clay-700" onClick={() => onChange([])} aria-label="Remove selected media"><Trash2 className="size-4" /></button>
      </div>
    </>}
  </div>;
}
