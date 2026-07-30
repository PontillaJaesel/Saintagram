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
  createdAt: string;
  updatedAt: string;
  privacyConsentAt: string | null;
  spiritualIntroSeenAt?: string | null;
  profileCompleted: boolean;
  privacyPreferences?: PrivacyPreferences;
}

export interface PublicSpiritualProfile {
  id: string;
  userId: string;
  profileName: string;
  coverColor: string;
  imagePath: string;
  selectedSymbol: SpiritualSymbol;
  spiritualBio: string;
  followers: string[];
  following: string[];
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
  content: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileDraftData {
  profileName: string;
  imagePath: string;
  selectedSymbol: SpiritualSymbol;
  spiritualBio: string;
  followers: string[];
  following: string[];
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
  followers: [],
  following: [],
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
