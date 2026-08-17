import { randomUUID } from "node:crypto";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const projectId =
  process.env.FIREBASE_ADMIN_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const storageBucket =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  (projectId ? `${projectId}.firebasestorage.app` : undefined);

if (!projectId || !storageBucket) {
  throw new Error("Firebase project ID and Storage bucket are required.");
}

const credential =
  clientEmail && privateKey
    ? cert({ projectId, clientEmail, privateKey })
    : applicationDefault();
const app =
  getApps()[0] || initializeApp({ credential, projectId, storageBucket });
const checkId = randomUUID();
const document = getFirestore(app).doc(`_turnoverChecks/${checkId}`);
const object = getStorage(app)
  .bucket(storageBucket)
  .file(`_turnoverChecks/${checkId}.txt`);

let documentCreated = false;
let objectCreated = false;

function withTimeout(promise, label, milliseconds = 15_000) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${milliseconds} ms.`)),
        milliseconds
      );
    })
  ]).finally(() => clearTimeout(timer));
}

const staleDocuments = await withTimeout(
  getFirestore(app).collection("_turnoverChecks").get(),
  "Stale Firestore check lookup",
  30_000
);
await Promise.all(
  staleDocuments.docs.map((snapshot) =>
    withTimeout(snapshot.ref.delete(), "Stale Firestore check cleanup")
  )
);
await withTimeout(
  getStorage(app).bucket(storageBucket).deleteFiles({
    force: true,
    prefix: "_turnoverChecks/"
  }),
  "Stale Storage check cleanup",
  30_000
);

try {
  await withTimeout(
    document.set({ checkId, createdAt: new Date().toISOString() }),
    "Firestore write",
    30_000
  );
  documentCreated = true;
  const snapshot = await withTimeout(
    document.get(),
    "Firestore read",
    30_000
  );
  if (!snapshot.exists || snapshot.data()?.checkId !== checkId) {
    throw new Error("Firestore verification read did not match its write.");
  }

  await object.save(Buffer.from(checkId), {
    contentType: "text/plain",
    resumable: false,
    timeout: 15_000
  });
  objectCreated = true;
  const [stored] = await withTimeout(object.download(), "Storage read");
  if (stored.toString() !== checkId) {
    throw new Error("Storage verification read did not match its write.");
  }

  console.log(
    `Firebase connectivity passed for project ${projectId} and bucket ${storageBucket}.`
  );
} finally {
  if (objectCreated) {
    await withTimeout(
      object.delete({ ignoreNotFound: true }),
      "Storage cleanup"
    );
  }
  if (documentCreated) await withTimeout(document.delete(), "Firestore cleanup");
}
