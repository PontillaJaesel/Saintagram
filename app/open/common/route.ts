import { handleTrackedEntry } from "@/lib/link-entry-route";
export async function GET(request: Request) { return handleTrackedEntry(request, "common"); }
