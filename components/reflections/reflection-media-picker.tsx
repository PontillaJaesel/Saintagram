"use client";

import { useEffect, useState } from "react";
import { Camera, Images, Trash2, Video } from "lucide-react";

export function ReflectionMediaPicker({ files, onChange, disabled = false }: { files: File[]; onChange: (files: File[]) => void; disabled?: boolean }) {
  const [previews, setPreviews] = useState<string[]>([]);
  const choose = (list: FileList | null) => { if (list) onChange(Array.from(list)); };

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  return <div className="mt-5 rounded-2xl border border-dashed border-sage-200 p-4">
    <p className="text-sm font-bold">Add media <span className="font-normal text-muted">(optional)</span></p>
    <p className="mt-1 text-xs text-muted">Up to 5 photos, or one video no longer than 15 seconds.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <label className="btn-secondary cursor-pointer"><Camera className="size-4" />Camera<input className="sr-only" type="file" accept="image/*,video/*" capture="environment" disabled={disabled} onChange={(event) => choose(event.target.files)} /></label>
      <label className="btn-secondary cursor-pointer"><Images className="size-4" />Gallery<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple disabled={disabled} onChange={(event) => choose(event.target.files)} /></label>
    </div>
    {files.length > 0 && <>
      <div className="mt-4 flex max-w-full gap-2 overflow-x-auto rounded-2xl bg-sage-50 p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {files.map((file, index) => <div className="aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-xl bg-black/5 sm:w-28" key={`${file.name}-${file.lastModified}-${index}`}>
          {file.type.startsWith("video/")
            ? <video src={previews[index]} className="size-full object-cover" controls playsInline preload="metadata" />
            : <img src={previews[index]} alt={`Selected photo ${index + 1}`} className="size-full object-cover" />}
        </div>)}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-sage-50 p-3 text-sm">
        <span className="inline-flex min-w-0 items-center gap-2"><span className="shrink-0">{files.some((file) => file.type.startsWith("video/")) ? <Video className="size-4" /> : <Images className="size-4" />}</span><span className="truncate">{files.length === 1 ? files[0].name : `${files.length} photos selected — swipe to preview`}</span></span>
        <button type="button" className="ml-2 shrink-0 text-clay-700" onClick={() => onChange([])} aria-label="Remove selected media"><Trash2 className="size-4" /></button>
      </div>
    </>}
  </div>;
}
