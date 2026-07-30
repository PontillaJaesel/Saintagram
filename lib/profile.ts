import { LIMITS } from "@/lib/constants";
import {
  cleanText,
  normalizeHashtag,
  normalizeList
} from "@/lib/validation";
import type {
  ProfileDraftData,
  PublicSpiritualProfile,
  ReflectionPost,
  SpiritualProfile
} from "@/types";

export function toPublicProfile(
  profile: SpiritualProfile
): PublicSpiritualProfile {
  const {
    hiddenStory: _hiddenStory,
    ...safeProfile
  } = profile;
  return safeProfile;
}

export function publicReflections(posts: ReflectionPost[]): ReflectionPost[] {
  return posts.filter((post) => !post.isPrivate);
}

export function normalizeProfileImageReference(value: string): string {
  const imagePath = value.trim();
  return imagePath.startsWith("data:image/")
    ? imagePath.slice(0, LIMITS.localImageDataUrl)
    : cleanText(imagePath, LIMITS.imagePath);
}

export function normalizeDraft(data: ProfileDraftData): ProfileDraftData {
  return {
    profileName: cleanText(data.profileName, LIMITS.profileName),
    imagePath: normalizeProfileImageReference(data.imagePath),
    selectedSymbol: data.selectedSymbol,
    spiritualBio: cleanText(data.spiritualBio, LIMITS.bio),
    followers: normalizeList(data.followers),
    following: normalizeList(data.following),
    onboardingPosts: data.onboardingPosts
      .map((post) => cleanText(post, LIMITS.post))
      .filter(Boolean)
      .slice(0, 20),
    heartSeeks: normalizeList(data.heartSeeks),
    hiddenStory: cleanText(data.hiddenStory, LIMITS.hiddenStory),
    godsComment: cleanText(data.godsComment, LIMITS.godsComment),
    heavenlyHashtag: normalizeHashtag(data.heavenlyHashtag)
  };
}
