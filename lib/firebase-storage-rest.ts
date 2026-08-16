import "server-only";

import {
  getGoogleServiceAccountAccessToken
} from "@/lib/google-service-account";

const STORAGE_SCOPE =
  "https://www.googleapis.com/auth/devstorage.read_write";

function storageBucket(): string {
  const value =
    process.env
      .NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      ?.trim();

  if (!value) {
    throw new Error(
      "The Firebase Storage bucket is not configured."
    );
  }

  return value;
}

async function storageToken() {
  return getGoogleServiceAccountAccessToken(
    [STORAGE_SCOPE]
  );
}

async function deleteStorageObject(
  bucket: string,
  name: string
): Promise<void> {
  const token =
    await storageToken();

  const response = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(
      bucket
    )}/o/${encodeURIComponent(
      name
    )}`,
    {
      method: "DELETE",
      headers: {
        Authorization:
          `Bearer ${token}`
      }
    }
  );

  if (
    response.status === 404
  ) {
    return;
  }

  if (!response.ok) {
    throw new Error(
      `Firebase Storage delete failed (${response.status}): ${await response.text()}`
    );
  }
}

export async function deleteFirebaseStoragePrefix(
  prefix: string
): Promise<number> {
  const bucket =
    storageBucket();

  const token =
    await storageToken();

  let pageToken = "";
  let deleted = 0;

  do {
    const query =
      new URLSearchParams({
        prefix,
        maxResults: "1000"
      });

    if (pageToken) {
      query.set(
        "pageToken",
        pageToken
      );
    }

    const response = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(
        bucket
      )}/o?${query.toString()}`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Firebase Storage listing failed (${response.status}): ${await response.text()}`
      );
    }

    const result =
      (await response.json()) as {
        items?: Array<{
          name: string;
        }>;
        nextPageToken?: string;
      };

    const names =
      result.items?.map(
        (item) => item.name
      ) ?? [];

    /*
     * Avoid firing a very large number
     * of Worker subrequests at once.
     */
    for (
      let index = 0;
      index < names.length;
      index += 25
    ) {
      const batch =
        names.slice(
          index,
          index + 25
        );

      await Promise.all(
        batch.map((name) =>
          deleteStorageObject(
            bucket,
            name
          )
        )
      );

      deleted += batch.length;
    }

    pageToken =
      result.nextPageToken ?? "";
  } while (pageToken);

  return deleted;
}