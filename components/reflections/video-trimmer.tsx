"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  LoaderCircle,
  Play,
  Scissors,
  X,
} from "lucide-react";

import { LIMITS } from "@/lib/constants";
import { getVideoDuration } from "@/lib/reflection-media";

/*
 * IMPORTANT:
 *
 * Do NOT import @ffmpeg/ffmpeg here.
 *
 * Vinext/Rolldown has trouble resolving FFmpeg's
 * internal Web Worker when @ffmpeg/ffmpeg is bundled
 * directly.
 *
 * Instead, FFmpeg's UMD browser build is served from:
 *
 * public/ffmpeg/ffmpeg.js
 * public/ffmpeg/814.ffmpeg.js
 */
const FFMPEG_BROWSER_SCRIPT =
  "/ffmpeg/ffmpeg.js";

/*
 * The large FFmpeg core remains on the CDN.
 *
 * The small FFmpeg wrapper and worker are served
 * locally from public/ffmpeg.
 */
const FFMPEG_CORE_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";

type FFmpegLogEvent = {
  message: string;
};

type FFmpegInstance = {
  on(
    event: "log",
    callback: (event: FFmpegLogEvent) => void
  ): void;

  load(config: {
    coreURL: string;
    wasmURL: string;
  }): Promise<boolean>;

  writeFile(
    path: string,
    data: Uint8Array
  ): Promise<void>;

  exec(
    args: string[]
  ): Promise<number>;

  readFile(
    path: string
  ): Promise<Uint8Array | string>;

  deleteFile(
    path: string
  ): Promise<void>;
};

type FFmpegConstructor =
  new () => FFmpegInstance;

declare global {
  interface Window {
    FFmpegWASM?: {
      FFmpeg: FFmpegConstructor;
    };
  }
}

type LoadedFFmpeg = {
  ffmpeg: FFmpegInstance;
};

let ffmpegScriptPromise:
  Promise<void> | null = null;

let ffmpegLoadPromise:
  Promise<LoadedFFmpeg> | null = null;

let latestFFmpegLog = "";

function normalizeError(
  error: unknown
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Event) {
    return `Browser worker error (${error.type}).`;
  }

  if (
    typeof error === "object" &&
    error !== null
  ) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

function loadFFmpegBrowserScript():
  Promise<void> {
  if (
    typeof window === "undefined"
  ) {
    return Promise.reject(
      new Error(
        "The video editor is only available in the browser."
      )
    );
  }

  /*
   * FFmpeg has already been loaded.
   */
  if (
    window.FFmpegWASM?.FFmpeg
  ) {
    return Promise.resolve();
  }

  /*
   * Avoid loading the same script multiple times.
   */
  if (
    ffmpegScriptPromise
  ) {
    return ffmpegScriptPromise;
  }

  ffmpegScriptPromise =
    new Promise<void>(
      (resolve, reject) => {
        /*
         * Remove a previously failed script,
         * if one exists.
         */
        const existing =
          document.querySelector<HTMLScriptElement>(
            `script[src="${FFMPEG_BROWSER_SCRIPT}"]`
          );

        if (existing) {
          existing.remove();
        }

        const script =
          document.createElement(
            "script"
          );

        script.src =
          FFMPEG_BROWSER_SCRIPT;

        script.async = true;

        script.onload = () => {
          if (
            window.FFmpegWASM?.FFmpeg
          ) {
            console.log(
              "[Saintagram FFmpeg] Browser wrapper loaded."
            );

            resolve();

            return;
          }

          reject(
            new Error(
              "FFmpeg browser script loaded, but FFmpegWASM was not initialized."
            )
          );
        };

        script.onerror = () => {
          reject(
            new Error(
              "Could not load /ffmpeg/ffmpeg.js."
            )
          );
        };

        document.head.appendChild(
          script
        );
      }
    ).catch((error) => {
      ffmpegScriptPromise = null;

      throw error;
    });

  return ffmpegScriptPromise;
}

async function createBlobUrl(
  url: string,
  mimeType: string
): Promise<string> {
  const response =
    await fetch(url, {
      cache: "force-cache",
    });

  if (!response.ok) {
    throw new Error(
      `Failed to download FFmpeg resource (${response.status}).`
    );
  }

  const data =
    await response.arrayBuffer();

  const blob =
    new Blob(
      [data],
      {
        type: mimeType,
      }
    );

  return URL.createObjectURL(
    blob
  );
}

async function loadFFmpeg():
  Promise<LoadedFFmpeg> {
  if (
    ffmpegLoadPromise
  ) {
    return ffmpegLoadPromise;
  }

  ffmpegLoadPromise =
    (async () => {
      console.log(
        "[Saintagram FFmpeg] Loading browser wrapper..."
      );

      await loadFFmpegBrowserScript();

      const FFmpeg =
        window.FFmpegWASM
          ?.FFmpeg;

      if (!FFmpeg) {
        throw new Error(
          "FFmpegWASM.FFmpeg is unavailable."
        );
      }

      const ffmpeg =
        new FFmpeg();

      latestFFmpegLog = "";

      ffmpeg.on(
        "log",
        ({ message }) => {
          latestFFmpegLog =
            message;

          console.log(
            "[Saintagram FFmpeg]",
            message
          );
        }
      );

      console.log(
        "[Saintagram FFmpeg] Downloading WebAssembly core..."
      );

      let coreURL = "";
      let wasmURL = "";

      try {
        [
          coreURL,
          wasmURL,
        ] = await Promise.all([
          createBlobUrl(
            `${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`,
            "text/javascript"
          ),

          createBlobUrl(
            `${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`,
            "application/wasm"
          ),
        ]);

        console.log(
          "[Saintagram FFmpeg] Starting WebAssembly core..."
        );

        await ffmpeg.load({
          coreURL,
          wasmURL,
        });

        console.log(
          "[Saintagram FFmpeg] Video editor ready."
        );

        return {
          ffmpeg,
        };
      } catch (error) {
        if (coreURL) {
          URL.revokeObjectURL(
            coreURL
          );
        }

        if (wasmURL) {
          URL.revokeObjectURL(
            wasmURL
          );
        }

        throw error;
      }
    })().catch((error) => {
      ffmpegLoadPromise =
        null;

      console.error(
        "[Saintagram FFmpeg] Loading failed:",
        error
      );

      throw new Error(
        `The browser video editor could not load. ${normalizeError(
          error
        )}`
      );
    });

  return ffmpegLoadPromise;
}

function formatTime(
  value: number
): string {
  const seconds =
    Math.max(
      0,
      Math.floor(value)
    );

  const minutes =
    Math.floor(
      seconds / 60
    );

  const remaining =
    seconds % 60;

  return `${minutes}:${remaining
    .toString()
    .padStart(2, "0")}`;
}

function safeBaseName(
  filename: string
): string {
  const withoutExtension =
    filename.replace(
      /\.[^/.]+$/,
      ""
    );

  const cleaned =
    withoutExtension.replace(
      /[^a-zA-Z0-9_-]+/g,
      "-"
    );

  return (
    cleaned ||
    "reflection-video"
  );
}

function inputExtension(
  file: File
): string {
  if (
    file.type ===
    "video/webm"
  ) {
    return "webm";
  }

  if (
    file.type ===
    "video/quicktime"
  ) {
    return "mov";
  }

  return "mp4";
}

async function cleanFFmpegFile(
  ffmpeg: FFmpegInstance,
  filename: string
): Promise<void> {
  try {
    await ffmpeg.deleteFile(
      filename
    );
  } catch {
    /*
     * Ignore cleanup failures.
     *
     * The file may not have been created
     * if FFmpeg failed earlier.
     */
  }
}

export function VideoTrimmer({
  file,
  duration,
  onCancel,
  onTrimmed,
}: {
  file: File;
  duration: number;
  onCancel: () => void;
  onTrimmed: (
    file: File
  ) => void;
}) {
  const videoRef =
    useRef<HTMLVideoElement>(
      null
    );

  const [
    previewUrl,
    setPreviewUrl,
  ] = useState("");

  const [
    startTime,
    setStartTime,
  ] = useState(0);

  const [
    endTime,
    setEndTime,
  ] = useState(
    Math.min(
      duration,
      LIMITS.reflectionVideoSeconds
    )
  );

  const [
    trimming,
    setTrimming,
  ] = useState(false);

  const [
    progressText,
    setProgressText,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const clipDuration =
    Math.max(
      0,
      endTime -
        startTime
    );

  const maxEnd =
    Math.min(
      duration,
      startTime +
        LIMITS.reflectionVideoSeconds
    );

  const canTrim =
    clipDuration > 0 &&
    clipDuration <=
      LIMITS.reflectionVideoSeconds;

  useEffect(() => {
    const url =
      URL.createObjectURL(
        file
      );

    setPreviewUrl(
      url
    );

    return () => {
      URL.revokeObjectURL(
        url
      );
    };
  }, [file]);

  useEffect(() => {
    const video =
      videoRef.current;

    if (
      !video ||
      !previewUrl
    ) {
      return;
    }

    try {
      video.currentTime =
        Math.min(
          startTime,
          duration
        );
    } catch {
      /*
       * Metadata may not be ready
       * for seeking yet.
       */
    }
  }, [
    duration,
    previewUrl,
    startTime,
  ]);

  const selectedLabel =
    useMemo(
      () =>
        `${formatTime(
          startTime
        )}–${formatTime(
          endTime
        )} (${formatTime(
          clipDuration
        )})`,
      [
        clipDuration,
        endTime,
        startTime,
      ]
    );

  async function previewSelection() {
    const video =
      videoRef.current;

    if (!video) {
      return;
    }

    try {
      video.currentTime =
        startTime;

      await video.play();
    } catch {
      /*
       * Native controls remain available
       * if autoplay is blocked.
       */
    }
  }

  async function trim() {
    if (
      !canTrim ||
      trimming
    ) {
      return;
    }

    setTrimming(true);
    setError("");

    setProgressText(
      "Loading video editor…"
    );

    latestFFmpegLog = "";

    const extension =
      inputExtension(
        file
      );

    const inputName =
      `input-${crypto.randomUUID()}.${extension}`;

    const outputName =
      `output-${crypto.randomUUID()}.mp4`;

    let ffmpeg:
      | FFmpegInstance
      | null = null;

    try {
      const loaded =
        await loadFFmpeg();

      ffmpeg =
        loaded.ffmpeg;

      setProgressText(
        "Preparing video…"
      );

      const sourceData =
        new Uint8Array(
          await file.arrayBuffer()
        );

      await ffmpeg.writeFile(
        inputName,
        sourceData
      );

      setProgressText(
        "Cropping video…"
      );

      /*
       * Re-encode the selected range.
       *
       * This gives a more accurate cut than
       * simply copying the source stream.
       */
      const exitCode =
        await ffmpeg.exec([
          "-ss",
          startTime.toFixed(3),

          "-i",
          inputName,

          "-t",
          clipDuration.toFixed(3),

          "-map",
          "0:v:0",

          "-map",
          "0:a?",

          "-c:v",
          "libx264",

          "-preset",
          "ultrafast",

          "-crf",
          "28",

          "-pix_fmt",
          "yuv420p",

          "-c:a",
          "aac",

          "-b:a",
          "128k",

          "-movflags",
          "+faststart",

          "-avoid_negative_ts",
          "make_zero",

          "-threads",
          "1",

          outputName,
        ]);

      if (
        exitCode !== 0
      ) {
        throw new Error(
          latestFFmpegLog
            ? `FFmpeg could not process this video. ${latestFFmpegLog}`
            : `FFmpeg stopped with code ${exitCode}.`
        );
      }

      setProgressText(
        "Finalizing cropped video…"
      );

      const result =
        await ffmpeg.readFile(
          outputName
        );

      if (
        typeof result ===
        "string"
      ) {
        throw new Error(
          "The video editor returned invalid output."
        );
      }

      if (
        result.byteLength ===
        0
      ) {
        throw new Error(
          "The cropped video is empty."
        );
      }

      /*
       * Make a clean ArrayBuffer copy for Blob.
       */
      const outputBytes =
        new Uint8Array(
          result.byteLength
        );

      outputBytes.set(
        result
      );

      const outputBlob =
        new Blob(
          [
            outputBytes.buffer,
          ],
          {
            type:
              "video/mp4",
          }
        );

      const trimmedFile =
        new File(
          [
            outputBlob,
          ],

          `${safeBaseName(
            file.name
          )}-trimmed.mp4`,

          {
            type:
              "video/mp4",

            lastModified:
              Date.now(),
          }
        );

      const actualDuration =
        await getVideoDuration(
          trimmedFile
        );

      /*
       * Small tolerance for encoded
       * frame timing.
       */
      if (
        actualDuration >
        LIMITS.reflectionVideoSeconds +
          0.25
      ) {
        throw new Error(
          `The resulting clip is ${actualDuration.toFixed(
            1
          )} seconds long. Please choose a slightly shorter section.`
        );
      }

      if (
        trimmedFile.size >
        LIMITS.reflectionVideoBytes
      ) {
        throw new Error(
          "The cropped video is larger than 50 MB. Choose a shorter section or a lower-resolution video."
        );
      }

      setProgressText("");

      onTrimmed(
        trimmedFile
      );
    } catch (
      caughtError
    ) {
      console.error(
        "[Saintagram Video Trimmer]",
        caughtError
      );

      const message =
        normalizeError(
          caughtError
        );

      const logSuffix =
        latestFFmpegLog &&
        !message.includes(
          latestFFmpegLog
        )
          ? ` Last FFmpeg message: ${latestFFmpegLog}`
          : "";

      setError(
        `${message}${logSuffix}`
      );
    } finally {
      if (ffmpeg) {
        await Promise.all([
          cleanFFmpegFile(
            ffmpeg,
            inputName
          ),

          cleanFFmpegFile(
            ffmpeg,
            outputName
          ),
        ]);
      }

      setProgressText("");
      setTrimming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4">
      <section
        className="surface max-h-[92vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-trimmer-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">
              Video is too long
            </p>

            <h2
              id="video-trimmer-title"
              className="mt-1 font-serif text-2xl font-bold"
            >
              Crop your video to 60 seconds or less
            </h2>

            <p className="mt-2 text-sm text-muted">
              The original video is{" "}
              {formatTime(
                duration
              )}
              . Choose the section you want to keep.
            </p>
          </div>

          <button
            type="button"
            className="rounded-lg p-2 text-muted transition hover:bg-sage-50 hover:text-ink"
            onClick={
              onCancel
            }
            disabled={
              trimming
            }
            aria-label="Close video cropper"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl bg-black">
          {previewUrl && (
            <video
              ref={
                videoRef
              }
              src={
                previewUrl
              }
              className="max-h-[48vh] w-full object-contain"
              controls
              playsInline
              preload="metadata"
              onTimeUpdate={(
                event
              ) => {
                if (
                  event.currentTarget
                    .currentTime >=
                  endTime
                ) {
                  event.currentTarget.pause();

                  event.currentTarget.currentTime =
                    startTime;
                }
              }}
            />
          )}
        </div>

        <div className="mt-5 rounded-2xl border border-sage-100 bg-sage-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold">
              Selected clip
            </p>

            <p className="text-sm tabular-nums text-muted">
              {
                selectedLabel
              }
            </p>
          </div>

          <label className="mt-4 block text-sm font-semibold">
            Start:{" "}
            <span className="tabular-nums">
              {formatTime(
                startTime
              )}
            </span>
          </label>

          <input
            type="range"
            className="mt-2 w-full accent-sage-700"
            min={0}
            max={Math.max(
              0,
              duration -
                0.1
            )}
            step={0.1}
            value={
              startTime
            }
            disabled={
              trimming
            }
            onChange={(
              event
            ) => {
              const nextStart =
                Number(
                  event.target.value
                );

              setStartTime(
                nextStart
              );

              setEndTime(
                (
                  currentEnd
                ) => {
                  const allowedEnd =
                    Math.min(
                      duration,

                      nextStart +
                        LIMITS.reflectionVideoSeconds
                    );

                  if (
                    currentEnd <=
                    nextStart
                  ) {
                    return Math.min(
                      duration,

                      nextStart +
                        LIMITS.reflectionVideoSeconds
                    );
                  }

                  return Math.min(
                    currentEnd,
                    allowedEnd
                  );
                }
              );
            }}
          />

          <label className="mt-4 block text-sm font-semibold">
            End:{" "}
            <span className="tabular-nums">
              {formatTime(
                endTime
              )}
            </span>
          </label>

          <input
            type="range"
            className="mt-2 w-full accent-sage-700"
            min={Math.min(
              duration,
              startTime +
                0.1
            )}
            max={Math.max(
              Math.min(
                duration,
                startTime +
                  0.1
              ),

              maxEnd
            )}
            step={0.1}
            value={Math.min(
              endTime,
              maxEnd
            )}
            disabled={
              trimming
            }
            onChange={(
              event
            ) =>
              setEndTime(
                Number(
                  event.target.value
                )
              )
            }
          />

          <p className="mt-3 text-xs text-muted">
            Maximum selected duration:{" "}
            {
              LIMITS.reflectionVideoSeconds
            }{" "}
            seconds.
          </p>
        </div>

        {progressText && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-sage-200 bg-sage-50 p-3 text-sm font-semibold">
            <LoaderCircle className="size-4 animate-spin" />

            <span>
              {
                progressText
              }
            </span>
          </div>
        )}

        {error && (
          <div
            className="mt-4 rounded-xl border border-clay-200 bg-clay-50 p-3 text-sm text-clay-700"
            role="alert"
          >
            <p className="font-bold">
              Video cropping failed
            </p>

            <p className="mt-1 break-words">
              {error}
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              void previewSelection()
            }
            disabled={
              trimming
            }
          >
            <Play className="size-4" />

            Preview selection
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={
              onCancel
            }
            disabled={
              trimming
            }
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              void trim()
            }
            disabled={
              !canTrim ||
              trimming
            }
          >
            {trimming ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Scissors className="size-4" />
            )}

            {trimming
              ? "Cropping video…"
              : "Use cropped video"}
          </button>
        </div>
      </section>
    </div>
  );
}