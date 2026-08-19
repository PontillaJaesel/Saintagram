import {
  access,
  copyFile,
  mkdir,
  readdir,
  rm,
} from "node:fs/promises";

import { resolve } from "node:path";

const sourceDirectory = resolve(
  "node_modules",
  "@ffmpeg",
  "ffmpeg",
  "dist",
  "umd"
);

const targetDirectory = resolve(
  "public",
  "ffmpeg"
);

async function main() {
  try {
    await access(sourceDirectory);
  } catch {
    throw new Error(
      [
        "FFmpeg browser assets were not found.",
        "",
        "Run:",
        "",
        "npm install @ffmpeg/ffmpeg@0.12.15",
      ].join("\n")
    );
  }

  await rm(targetDirectory, {
    recursive: true,
    force: true,
  });

  await mkdir(targetDirectory, {
    recursive: true,
  });

  const entries =
    await readdir(sourceDirectory, {
      withFileTypes: true,
    });

  let copied = 0;

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    /*
     * We only need browser JavaScript files.
     *
     * This normally includes:
     *
     * ffmpeg.js
     * 814.ffmpeg.js
     *
     * The second file is FFmpeg's internal Worker.
     */
    if (!entry.name.endsWith(".js")) {
      continue;
    }

    await copyFile(
      resolve(
        sourceDirectory,
        entry.name
      ),
      resolve(
        targetDirectory,
        entry.name
      )
    );

    copied += 1;
  }

  if (copied < 2) {
    throw new Error(
      `Only ${copied} FFmpeg browser asset(s) were found. Expected ffmpeg.js and its Worker chunk.`
    );
  }

  console.log(
    `Prepared ${copied} FFmpeg browser assets in public/ffmpeg.`
  );
}

await main();