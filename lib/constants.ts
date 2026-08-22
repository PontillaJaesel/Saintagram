import type { SpiritualSymbol } from "@/types";

export const APP_NAME = "Saintagram";
export const APP_TAGLINE = "No Filter. Seen by God. Loved by Heaven.";

export const SPIRITUAL_SYMBOLS: Array<{
  id: Exclude<SpiritualSymbol, "">;
  label: string;
  description: string;
}> = [
  { id: "candle", label: "Candle", description: "A light held in hope" },
  { id: "seed", label: "Seed", description: "Faith that is still growing" },
  { id: "cross", label: "Cross", description: "Love that gives itself" },
  { id: "heart", label: "Heart", description: "Known and loved by God" },
  { id: "open-hands", label: "Open hands", description: "Ready to receive and serve" },
  { id: "road", label: "Road", description: "A journey walked with God" }
];

export const FOLLOWING_IDEAS = [
  "Jesus",
  "Friends",
  "Approval",
  "Popularity",
  "Comfort",
  "Success",
  "Social-media trends",
  "Personal plans",
  "God’s will"
];

export const HEART_SEEKS_IDEAS = [
  "Attention",
  "Approval",
  "Friendship",
  "Peace",
  "Success",
  "Comfort",
  "God’s love",
  "Forgiveness",
  "Belonging",
  "Popularity",
  "Truth",
  "Healing"
];

export const HASHTAG_IDEAS = [
  "#Beloved",
  "#StillGrowing",
  "#SeenByGod",
  "#NoFilterBeforeGod",
  "#CalledToServe",
  "#MoreThanMyProfile",
  "#GodKnowsMe",
  "#HumbleHeart",
  "#LearningToTrust"
];

export const LIMITS = {
  profileName: 60,
  bio: 320,
  listEntry: 60,
  momentTitle: 30,
  post: 500,
  fiatOther: 25,
  hiddenStory: 1000,
  godsComment: 280,
  hashtag: 40,
  imageBytes: 2 * 1024 * 1024,
  imagePath: 512,
  localImageDataUrl: 3 * 1024 * 1024,
  reflectionImages: 5,
  reflectionImageBytes: 10 * 1024 * 1024,
  reflectionVideoBytes: 50 * 1024 * 1024,

  // Maximum reflection video duration:
  // 1 minute / 60 seconds.
  reflectionVideoSeconds: 60
} as const;