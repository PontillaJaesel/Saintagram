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
  const moments = data.onboardingPosts
    .map((post, index) => ({
      content: cleanText(post, LIMITS.post),
      title: cleanText(data.onboardingPostTitles?.[index] ?? "", LIMITS.momentTitle)
    }))
    .filter((moment) => Boolean(moment.content))
    .slice(0, 20);
  return {
    profileName: cleanText(data.profileName, LIMITS.profileName),
    imagePath: normalizeProfileImageReference(data.imagePath),
    selectedSymbol: data.selectedSymbol,
    spiritualBio: cleanText(data.spiritualBio, LIMITS.bio),
    spiritualGuides: normalizeList(data.spiritualGuides),
    lifeDirections: normalizeList(data.lifeDirections),
    onboardingPostTitles: moments.map((moment) => moment.title),
    onboardingPosts: moments.map((moment) => moment.content),
    heartSeeks: normalizeList(data.heartSeeks),
    hiddenStory: cleanText(data.hiddenStory, LIMITS.hiddenStory),
    godsComment: cleanText(data.godsComment, LIMITS.godsComment),
    heavenlyHashtag: normalizeHashtag(data.heavenlyHashtag)
  };
}
