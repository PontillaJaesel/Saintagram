import type { AdminProfileCompletion, ProfileDraftData } from "@/types";
const labels = { bio: "Bio", guides: "Who helps me lead closer to God?", directions: "Who or what am I following in life right now?", reflection: "Posts God Sees / Reflection", likes: "Likes", godsComment: "God's Comment", hashtag: "Heavenly Hashtag" } as const;
const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const list = (value: unknown) => Array.isArray(value) && value.some(text);
export function computeAdminProfileCompletion(profile: Record<string, unknown> | null, draft: { draftData?: Partial<ProfileDraftData> } | null, hasReflection: boolean): AdminProfileCompletion {
  const d = draft?.draftData ?? {}; const value = (key: keyof ProfileDraftData) => profile?.[key] ?? d[key];
  const states = { bio: text(value("spiritualBio")), guides: list(value("spiritualGuides")), directions: list(value("lifeDirections")), reflection: hasReflection || list(d.onboardingPosts), likes: list(value("heartSeeks")), godsComment: text(value("godsComment")), hashtag: text(value("heavenlyHashtag")) };
  const requirements = (Object.keys(labels) as (keyof typeof labels)[]).map((key) => ({ key, label: labels[key], complete: states[key] }));
  const completedCount = requirements.filter((item) => item.complete).length;
  return { completedCount, totalCount: 7, percentage: Math.round(completedCount / 7 * 100), status: completedCount === 0 ? "Not Started" : completedCount === 7 ? "Complete" : "Incomplete", requirements, missingFields: requirements.filter((item) => !item.complete).map((item) => item.label) };
}
