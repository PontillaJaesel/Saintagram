export type SpiritualSymbol =
  | "candle"
  | "seed"
  | "cross"
  | "heart"
  | "open-hands"
  | "road"
  | "";

export interface PrivacyPreferences {
  accountPrivate?: boolean;
  requirePrivateCheck: boolean;
  showReflectionDates: boolean;
}

export interface AppUser {
  id: string;
  email: string;
  username?: string;
  isGuest?: boolean;
  authProvider?: "password";
  createdAt: string;
  updatedAt: string;
  privacyConsentAt: string | null;
  spiritualIntroSeenAt?: string | null;
  fiatIntroSeenAt?: string | null;
  profileCompleted: boolean;
  mustChangePassword?: boolean;
  fullName?: string;
  role?: "user" | "tester" | "app_admin";
  adminAccessGranted?: boolean;
  privacyPreferences?: PrivacyPreferences;
}

export interface PublicSpiritualProfile {
  id: string;
  userId: string;
  profileName: string;
  coverColor?: string;
  coverImageId?: string;
  coverImagePath?: string;
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
  accountPrivate?: boolean;
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
  frozenToday: boolean;
  freezeUsed: 0 | 1 | 2;
  freezeRemaining: number;
  streakLostToday: boolean;
  streakLostDate: string | null;
  totalFiatEntries: number;
  totalFiatDays: number;
  thisWeekEntries: number;
}

export interface FiatStreakLoss {
  lostDate: string;
  lastFiatDate: string;
  previousStreak: number;
}

export type FiatCalendarDayState =
  | "fiat"
  | "freeze-1"
  | "freeze-2"
  | "lost"
  | "inactive"
  | "future";

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
  coverColor?: string;
  coverImageId?: string;
  coverImagePath?: string;
  imagePath: string;
  spiritualBio: string;
  heavenlyHashtag: string;
  isPrivateAccount?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FollowRelationship {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface FollowRequest {
  id: string;
  requesterId: string;
  targetUserId: string;
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
export interface LinkOpenEvent { visitId: string; id: string; source: "qr" | "common"; campaign: string | null; openedAt: string; lastOpenedAt: string; openCount: number; trackingVersion: number; visitStatus: "logged_in" | "awaiting_login" | "did_not_login"; userId: string | null; claimedAt: string | null; streetAddress: string | null; city: string | null; region: string | null; country: string | null; postalCode: string | null; formattedAddress: string | null; latitude: string | null; longitude: string | null; locationAccuracyMeters: number | null; locationLabel: string; locationSource: "device" | "cloudflare" | "localhost" | "unavailable"; destination: string; userName?: string; userFullName?: string; userDisplayName?: string; username?: string; }
export interface SystemNotification { id: string; userId: string; type: "profile_reminder" | "admin_reflection" | "fiat_streak_lost" | "admin_access_granted" | "admin_access_revoked"; title: string; message: string; missingFields: string[]; reflectionId?: string; fiatLostDate?: string; previousStreak?: number; createdByAdminId: string; createdAt: string; readAt: string | null; }
export interface AdminAuditLog {
  id: string;
  adminId: string;
  action:
    | "profile_reminder_sent"
    | "notification_resent"
    | "user_data_deleted"
    | "user_data_reset"
    | "user_account_deleted"
    | "user_data_viewed"
    | "export_generated"
    | "admin_reflection_published"
    | "admin_reflection_updated"
    | "admin_reflection_deleted"
    | "admin_access_granted"
    | "admin_access_revoked";
  targetUserId: string | null;
  createdAt: string;
  metadata: Record<
    string,
    string | number | boolean | null
  >;
}
export interface AdminUserSummary { id: string; email: string; name: string; fullName?: string; displayName?: string; username?: string; accountRole?: "user" | "tester" | "app_admin"; adminAccessGranted?: boolean; authProvider: string; createdAt: string; profileCompleted: boolean; completion: AdminProfileCompletion; lastLinkOpen: string | null; }
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

export interface PersonalDataJourneyEvent {
  id: string;
  userId: string;
  changes: string[];
  imagePath?: string;
  createdAt: string;
}

export interface PersonalDataDownloadLinks {
  profileImage?: string;
  coverImage?: string;
  reflectionMedia: Record<string, string>;
}

export interface PersonalDataExport {
  exportedAt: string;
  notice: string;
  user: AppUser;
  profile: SpiritualProfile | null;
  reflections: ReflectionPost[];
  unfinishedDraft: ProfileDraft | null;
  likes: ReflectionLike[];
  comments: ReflectionComment[];
  profileJourneyEvents: PersonalDataJourneyEvent[];
  downloadLinks: PersonalDataDownloadLinks;
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
  accountPrivate: false,
  requirePrivateCheck: true,
  showReflectionDates: true
};

export type BulletinItemType = "announcement" | "event";

export interface BulletinItem {
  id: string;
  type: BulletinItemType;
  title: string;
  description: string;
  eventAt: string | null;
  location: string;
  linkUrl: string;
  expiresAt: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}
