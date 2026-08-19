"use client";

import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  Images,
  Trash2,
  Video
} from "lucide-react";

import {
  VideoTrimmer
} from "@/components/reflections/video-trimmer";

import {
  LIMITS
} from "@/lib/constants";

import {
  getVideoDuration
} from "@/lib/reflection-media";

const ACCEPTED_IMAGE_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
  ]);

const ACCEPTED_VIDEO_TYPES =
  new Set([
    "video/mp4",
    "video/webm",
    "video/quicktime"
  ]);

export function ReflectionMediaPicker({
  files,
  onChange,
  disabled = false
}: {
  files: File[];
  onChange: (
    files: File[]
  ) => void;
  disabled?: boolean;
}) {
  const [
    previews,
    setPreviews
  ] =
    useState<string[]>([]);

  const [
    active,
    setActive
  ] =
    useState(0);

  const [
    pickerError,
    setPickerError
  ] =
    useState("");

  const [
    checkingVideo,
    setCheckingVideo
  ] =
    useState(false);

  const [
    videoToTrim,
    setVideoToTrim
  ] =
    useState<{
      file: File;
      duration: number;
    } | null>(null);

  const sliderRef =
    useRef<HTMLDivElement>(
      null
    );

  const inputRef =
    useRef<HTMLInputElement>(
      null
    );

  const choose =
    async (
      list:
        FileList |
        null
    ) => {
      if (
        !list?.length
      ) {
        return;
      }

      const selected =
        Array.from(list);

      setPickerError("");

      /**
       * Reset input so the same file can
       * be selected again after cancelling.
       */
      if (
        inputRef.current
      ) {
        inputRef.current.value =
          "";
      }

      const images =
        selected.filter(
          (file) =>
            ACCEPTED_IMAGE_TYPES.has(
              file.type
            )
        );

      const videos =
        selected.filter(
          (file) =>
            ACCEPTED_VIDEO_TYPES.has(
              file.type
            )
        );

      /**
       * Preserve your existing supported
       * file type rules.
       */
      if (
        images.length +
          videos.length !==
        selected.length
      ) {
        setPickerError(
          "Choose JPG, PNG, WebP, MP4, WebM, or MOV media."
        );

        return;
      }

      /**
       * Existing Saintagram behavior:
       * photos OR one video, never both.
       */
      if (
        videos.length &&
        (
          videos.length !==
            1 ||
          images.length
        )
      ) {
        setPickerError(
          "Choose either up to five photos or one video."
        );

        return;
      }

      if (
        images.length >
        LIMITS.reflectionImages
      ) {
        setPickerError(
          `Choose no more than ${LIMITS.reflectionImages} photos.`
        );

        return;
      }

      if (
        images.some(
          (file) =>
            file.size >
            LIMITS.reflectionImageBytes
        )
      ) {
        setPickerError(
          "Each photo must be 10 MB or smaller."
        );

        return;
      }

      /**
       * A single video needs duration
       * inspection before being accepted.
       */
      if (
        videos.length ===
        1
      ) {
        setCheckingVideo(
          true
        );

        try {
          const video =
            videos[0];

          const duration =
            await getVideoDuration(
              video
            );

          /**
           * LONGER THAN ONE MINUTE:
           *
           * Do not put it into mediaFiles.
           * Force the trimming interface first.
           */
          if (
            duration >
            LIMITS.reflectionVideoSeconds +
              0.1
          ) {
            setVideoToTrim({
              file: video,
              duration
            });

            return;
          }

          /**
           * For already-short videos,
           * preserve your existing 50 MB limit.
           */
          if (
            video.size >
            LIMITS.reflectionVideoBytes
          ) {
            setPickerError(
              "The video must be 50 MB or smaller."
            );

            return;
          }
        } catch (
          error
        ) {
          setPickerError(
            error instanceof
            Error
              ? error.message
              : "That video could not be read."
          );

          return;
        } finally {
          setCheckingVideo(
            false
          );
        }
      }

      /**
       * Normal files reach the existing
       * reflection composer exactly as before.
       */
      onChange(
        selected
      );
    };

  useEffect(() => {
    const urls =
      files.map(
        (file) =>
          URL.createObjectURL(
            file
          )
      );

    setPreviews(urls);
    setActive(0);

    return () => {
      urls.forEach(
        (url) =>
          URL.revokeObjectURL(
            url
          )
      );
    };
  }, [files]);

  return (
    <>
      <div className="mt-5 rounded-2xl border border-dashed border-sage-200 p-4">
        <p className="text-sm font-bold">
          Add media{" "}
          <span className="font-normal text-muted">
            (optional)
          </span>
        </p>

        <p className="mt-1 text-xs text-muted">
          Up to{" "}
          {
            LIMITS.reflectionImages
          }{" "}
          photos, or one video
          no longer than{" "}
          {
            LIMITS.reflectionVideoSeconds
          }{" "}
          seconds. Longer
          videos will open the
          crop tool.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <label
            className={`btn-secondary cursor-pointer ${
              checkingVideo
                ? "pointer-events-none opacity-60"
                : ""
            }`}
          >
            <Images className="size-4" />

            {checkingVideo
              ? "Checking video…"
              : "Gallery"}

            <input
              ref={
                inputRef
              }
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
              multiple
              disabled={
                disabled ||
                checkingVideo
              }
              onChange={(
                event
              ) =>
                void choose(
                  event
                    .target
                    .files
                )
              }
            />
          </label>
        </div>

        {pickerError && (
          <p
            className="mt-3 rounded-xl border border-clay-200 bg-clay-50 p-3 text-sm font-semibold text-clay-700"
            role="alert"
          >
            {pickerError}
          </p>
        )}

        {files.length >
          0 && (
          <>
            <div className="relative mt-4 w-full max-w-lg overflow-hidden rounded-2xl bg-black/5">
              <div
                ref={
                  sliderRef
                }
                className={`flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                  files.length >
                  1
                    ? "gap-2"
                    : ""
                }`}
                onScroll={(
                  event
                ) => {
                  const slides =
                    Array.from(
                      event
                        .currentTarget
                        .children
                    ) as HTMLElement[];

                  if (
                    !slides.length
                  ) {
                    return;
                  }

                  const nearest =
                    slides.reduce(
                      (
                        best,
                        slide,
                        index
                      ) =>
                        Math.abs(
                          slide.offsetLeft -
                            event
                              .currentTarget
                              .scrollLeft
                        ) <
                        Math.abs(
                          slides[
                            best
                          ]
                            .offsetLeft -
                            event
                              .currentTarget
                              .scrollLeft
                        )
                          ? index
                          : best,

                      0
                    );

                  setActive(
                    nearest
                  );
                }}
                aria-label="Selected media preview"
              >
                {files.map(
                  (
                    file,
                    index
                  ) => (
                    <div
                      className={`relative aspect-[4/5] shrink-0 snap-start overflow-hidden bg-black/5 ${
                        files.length ===
                        1
                          ? "w-full"
                          : "w-[calc(100%-2.5rem)] sm:w-[calc(100%-4rem)]"
                      }`}
                      key={`${file.name}-${file.lastModified}-${index}`}
                    >
                      {file.type.startsWith(
                        "video/"
                      ) ? (
                        <video
                          src={
                            previews[
                              index
                            ]
                          }
                          className="size-full object-contain"
                          controls
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={
                            previews[
                              index
                            ]
                          }
                          alt={`Selected photo ${index + 1}`}
                          className="size-full object-contain"
                        />
                      )}
                    </div>
                  )
                )}
              </div>

              {files.length >
                1 && (
                <div
                  className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-2"
                  aria-label={`Image ${active + 1} of ${files.length}`}
                >
                  {files.map(
                    (
                      file,
                      index
                    ) => (
                      <span
                        key={`${file.name}-${index}`}
                        className={`size-1.5 rounded-full ${
                          index ===
                          active
                            ? "bg-white"
                            : "bg-white/45"
                        }`}
                      />
                    )
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl bg-sage-50 p-3 text-sm">
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="shrink-0">
                  {files.some(
                    (
                      file
                    ) =>
                      file.type.startsWith(
                        "video/"
                      )
                  ) ? (
                    <Video className="size-4" />
                  ) : (
                    <Images className="size-4" />
                  )}
                </span>

                <span className="truncate">
                  {files.length ===
                  1
                    ? files[0]
                        .name
                    : `${files.length} photos selected`}
                </span>
              </span>

              <button
                type="button"
                className="ml-2 shrink-0 text-clay-700"
                onClick={() => {
                  setPickerError(
                    ""
                  );

                  onChange([]);
                }}
                aria-label="Remove selected media"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {videoToTrim && (
        <VideoTrimmer
          file={
            videoToTrim.file
          }
          duration={
            videoToTrim.duration
          }
          onCancel={() =>
            setVideoToTrim(
              null
            )
          }
          onTrimmed={(
            trimmedFile
          ) => {
            setPickerError(
              ""
            );

            setVideoToTrim(
              null
            );

            /**
             * Only the newly created
             * <= 60-second file reaches
             * the reflection form.
             */
            onChange([
              trimmedFile
            ]);
          }}
        />
      )}
    </>
  );
}