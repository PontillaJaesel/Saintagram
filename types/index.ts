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
  authProvider?: "password" | "google" | "apple" | "guest";
  createdAt: string;
  updatedAt: string;
  privacyConsentAt: string | null;
  spiritualIntroSeenAt?: string | null;
  profileCompleted: boolean;
  mustChangePassword?: boolean;
  fullName?: string;
  role?: "user" | "tester";
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
  fiatCategory?: FiatCategory;
  fiatOther?: string;
  fiatDateKey?: string;
  media?: ReflectionMedia[];
}

export interface ReflectionMedia {
  path: string;
  type: "image" | "video";
}

export type FiatCategory =
  | "prayer"
  | "forgiveness"
  | "service"
  | "sacrifice"
  | "act-of-love"
  | "responsible-choice"
  | "other";

export interface FiatStats {
  currentStreak: number;
  longestStreak: number;
  activeToday: boolean;
  totalFiatEntries: number;
  totalFiatDays: number;
  thisWeekEntries: number;
}

export type FiatLeaderboardPeriod = "today" | "week" | "month";
export interface FiatLeaderboardEntry {
  rank: number;
  userId: string;
  profileName: string;
  imagePath: string;
  eligibleCount: number;
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

export type AdminProfileRequirementKey = "bio" | "guides" | "directions" | "reflection" | "likes" | "godsComment" | "hashtag";
export interface AdminProfileRequirement { key: AdminProfileRequirementKey; label: string; complete: boolean; }
export interface AdminProfileCompletion { completedCount: number; totalCount: 7; percentage: number; status: "Not Started" | "Incomplete" | "Complete"; requirements: AdminProfileRequirement[]; missingFields: string[]; }
export interface LinkOpenEvent { visitId: string; id: string; source: "qr" | "common"; campaign: string | null; openedAt: string; userId: string | null; claimedAt: string | null; city: string | null; region: string | null; country: string | null; latitude: string | null; longitude: string | null; locationLabel: string; locationSource: "cloudflare" | "localhost" | "unavailable"; destination: string; userName?: string; }
export interface SystemNotification { id: string; userId: string; type: "profile_reminder" | "admin_reflection"; title: string; message: string; missingFields: string[]; reflectionId?: string; createdByAdminId: string; createdAt: string; readAt: string | null; }
export interface AdminAuditLog { id: string; adminId: string; action: "profile_reminder_sent" | "user_data_viewed" | "export_generated" | "admin_reflection_published" | "admin_reflection_updated" | "admin_reflection_deleted"; targetUserId: string | null; createdAt: string; metadata: Record<string, string | number | boolean | null>; }
export interface AdminUserSummary { id: string; email: string; name: string; authProvider: string; createdAt: string; profileCompleted: boolean; completion: AdminProfileCompletion; lastLinkOpen: string | null; }
export interface AdminDashboardOverview { totalUsers: number; completeProfiles: number; incompleteProfiles: number; totalVisits: number; qrVisits: number; commonVisits: number; qrOpensToday: number; commonOpensToday: number; recentActivity: LinkOpenEvent[]; recentUsers: AdminUserSummary[]; recentReminders: SystemNotification[]; }
export interface AdminUserData { user: Record<string, unknown>; profile: Record<string, unknown> | null; privateProfile: Record<string, unknown> | null; draft: Record<string, unknown> | null; collections: Record<string, Record<string, unknown>[]>; }
export interface AdminExportOptions { userId?: string; from?: string; to?: string; include: string[]; }

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
