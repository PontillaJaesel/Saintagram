import "server-only";

import { fallback } from "google-gax";
import firestoreProtoJson from "../node_modules/@google-cloud/firestore/build/protos/v1.json";
import type { Field, Method, Service, Type } from "protobufjs";

/**
 * protobufjs lazily generates encoders and decoders with `Function(...)`.
 * Cloudflare Workers permits that during module startup but rejects it while
 * handling a request. Firestore's REST client uses google-gax's shared proto
 * cache, so eagerly setting up every message type here makes later requests
 * use the already-generated functions.
 */
function setupReachableType(type: Type, completed: Set<Type>): void {
  if (completed.has(type)) return;
  completed.add(type);
  type.resolveAll();
  for (const field of type.fieldsArray as Field[]) {
    field.resolve();
    if (field.resolvedType instanceof fallback.protobuf.Type) {
      setupReachableType(field.resolvedType as Type, completed);
    }
  }
  type.setup();
}

const firestoreProtoRoot = fallback.GrpcClient.protobufFromJSON(
  firestoreProtoJson
);
firestoreProtoRoot.resolveAll();
const firestoreService = firestoreProtoRoot.lookupService(
  "google.firestore.v1.Firestore"
) as Service;
const startupMethods = new Set([
  "BatchGetDocuments",
  "BeginTransaction",
  "Commit",
  "GetDocument",
  "Rollback",
  "RunQuery",
]);
const completedTypes = new Set<Type>();
for (const method of firestoreService.methodsArray as Method[]) {
  if (!startupMethods.has(method.name)) continue;
  method.resolve();
  if (method.resolvedRequestType) {
    setupReachableType(method.resolvedRequestType, completedTypes);
  }
  if (method.resolvedResponseType) {
    setupReachableType(method.resolvedResponseType, completedTypes);
  }
}
