import "server-only";

import {
  getGoogleServiceAccountAccessToken
} from "@/lib/google-service-account";

const AUTH_SCOPE =
  "https://www.googleapis.com/auth/identitytoolkit";

type IdentityToolkitError = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

type IdentityUser = {
  localId: string;
  email?: string;
  displayName?: string;
  customAttributes?: string;
  disabled?: boolean;
};

export type FirebaseAuthRestUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
  customClaims: Record<
    string,
    unknown
  >;
};

function projectId(): string {
  const value =
    process.env
      .FIREBASE_ADMIN_PROJECT_ID
      ?.trim() ||
    process.env
      .NEXT_PUBLIC_FIREBASE_PROJECT_ID
      ?.trim();

  if (!value) {
    throw new Error(
      "The Firebase project ID is not configured."
    );
  }

  return value;
}

async function identityRequest<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const token =
    await getGoogleServiceAccountAccessToken(
      [AUTH_SCOPE]
    );

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${path}`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${token}`,
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  const text =
    await response.text();

  let result: unknown = {};

  if (text) {
    try {
      result = JSON.parse(text);
    } catch {
      result = {
        error: {
          message: text
        }
      };
    }
  }

  if (!response.ok) {
    const apiError =
      result as IdentityToolkitError;

    throw new Error(
      `Firebase Auth REST ${response.status}: ${
        apiError.error?.message ??
        response.statusText
      }`
    );
  }

  return result as T;
}

function parseCustomClaims(
  value: string | undefined
): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed =
      JSON.parse(value);

    return parsed &&
      typeof parsed === "object"
      ? parsed
      : {};
  } catch {
    return {};
  }
}

export async function getFirebaseAuthUser(
  userId: string
): Promise<FirebaseAuthRestUser | null> {
  const project = projectId();

  const result =
    await identityRequest<{
      users?: IdentityUser[];
    }>(
      `projects/${encodeURIComponent(
        project
      )}/accounts:lookup`,
      {
        localId: [userId]
      }
    );

  const user =
    result.users?.[0];

  if (!user) {
    return null;
  }

  return {
    uid: user.localId,
    email: user.email ?? null,
    displayName:
      user.displayName ?? null,
    disabled:
      user.disabled === true,
    customClaims:
      parseCustomClaims(
        user.customAttributes
      )
  };
}

export async function setFirebaseAuthPassword(
  userId: string,
  password: string
): Promise<void> {
  const project = projectId();

  await identityRequest(
    `projects/${encodeURIComponent(
      project
    )}/accounts:update`,
    {
      localId: userId,
      password
    }
  );
}

export async function deleteFirebaseAuthUser(
  userId: string
): Promise<void> {
  const project = projectId();

  await identityRequest(
    `projects/${encodeURIComponent(
      project
    )}/accounts:delete`,
    {
      localId: userId
    }
  );
}