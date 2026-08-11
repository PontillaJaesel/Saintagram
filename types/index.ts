export type SpiritualSymbol =
  | "candle"
  | "seed"
  | "cross"
  | "heart"
  | "open-hands"
  | "road"
  | "";

export interface PrivacyPreferences {
  requirePrivateCheck: boolean;
  showReflectionDates: boolean;
}

export interface AppUser {
  id: string;
  email: string;
  username?: string;
  isGuest?: boolean;
  authProvider?: "password" | "google" | "guest";
  createdAt: string;
  updatedAt: string;
  privacyConsentAt: string | null;
  spiritualIntroSeenAt?: string | null;
  profileCompleted: boolean;
  mustChangePassword?: boolean;
  privacyPreferences?: PrivacyPreferences;
}

export interface PublicSpiritualProfile {
  id: string;
  userId: string;
  profileName: string;
  coverColor?: string;
  imagePath: string;
  selectedSymbol: SpiritualSymbol;
  spiritualBio: string;
  spiritualGuides: string[];
  lifeDirections: string[];
  heartSeeks: string[];
  godsComment: string;
  heavenlyHashtag: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpiritualProfile extends PublicSpiritualProfile {
  hiddenStory: string;
}

export interface ReflectionPost {
  id: string;
  userId: string;
  title?: string;
  content: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  editedAt?: string;
}

export interface SocialProfile {
  id: string;
  userId: string;
  profileName: string;
  imagePath: string;
  spiritualBio: string;
  heavenlyHashtag: string;
  createdAt: string;
  updatedAt: string;
}

export interface FollowRelationship {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface SocialFeedPost extends ReflectionPost {
  author: SocialProfile;
}

export interface ReflectionLike {
  id: string;
  reflectionId: string;
  postOwnerId: string;
  userId: string;
  createdAt: string;
}

export interface ReflectionComment {
  id: string;
  reflectionId: string;
  postOwnerId: string;
  userId: string;

  /*
   * Present only when this comment
   * is a reply.
   */
  parentCommentId?: string;
  replyToUserId?: string;

  content: string;
  createdAt: string;
  updatedAt: string;
}

export type SocialNotificationType =
  | "follow"
  | "like"
  | "comment"
  | "reply";

export interface SocialNotification {
  id: string;
  userId: string;
  actorUserId: string;
  type: SocialNotificationType;
  reflectionId?: string;
  commentId?: string;
  createdAt: string;
  readAt: string | null;
}

export interface ProfileImageHistoryEntry {
  id: string;
  userId: string;
  imagePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileDraftData {
  profileName: string;
  imagePath: string;
  selectedSymbol: SpiritualSymbol;
  spiritualBio: string;
  spiritualGuides: string[];
  lifeDirections: string[];
  onboardingPostTitles?: string[];
  onboardingPosts: string[];
  heartSeeks: string[];
  hiddenStory: string;
  godsComment: string;
  heavenlyHashtag: string;
}

export interface ProfileDraft {
  id: string;
  userId: string;
  currentStep: number;
  draftData: ProfileDraftData;
  updatedAt: string;
}

export interface PersonalDataExport {
  exportedAt: string;
  notice: string;
  user: AppUser;
  profile: SpiritualProfile | null;
  reflections: ReflectionPost[];
  unfinishedDraft: ProfileDraft | null;
}

export const EMPTY_DRAFT: ProfileDraftData = {
  profileName: "",
  imagePath: "",
  selectedSymbol: "",
  spiritualBio: "",
  spiritualGuides: [],
  lifeDirections: [],
  onboardingPostTitles: [""],
  onboardingPosts: [""],
  heartSeeks: [],
  hiddenStory: "",
  godsComment: "",
  heavenlyHashtag: ""
};

export const DEFAULT_PRIVACY_PREFERENCES: PrivacyPreferences = {
  requirePrivateCheck: true,
  showReflectionDates: true
};
