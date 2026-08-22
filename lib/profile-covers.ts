export const PROFILE_COVERS = [
  {
    id: "cover-01",
    name: "Sunset Sky",
    src: "/covers/cover-01.webp",
  },
  {
    id: "cover-02",
    name: "Mountain Meadow",
    src: "/covers/cover-02.webp",
  },
  {
    id: "cover-03",
    name: "Mount Fuji",
    src: "/covers/cover-03.webp",
  },
  {
    id: "cover-04",
    name: "Church Interior",
    src: "/covers/cover-04.webp",
  },
  {
    id: "cover-05",
    name: "Ocean Sunset",
    src: "/covers/cover-05.webp",
  },
  {
    id: "cover-06",
    name: "Flower Field",
    src: "/covers/cover-06.webp",
  },
  {
    id: "cover-07",
    name: "Lighthouse",
    src: "/covers/cover-07.webp",
  },
  {
    id: "cover-08",
    name: "Mountain Lake",
    src: "/covers/cover-08.webp",
  },
  {
    id: "cover-09",
    name: "Desert Road",
    src: "/covers/cover-09.webp",
  },
  {
    id: "cover-10",
    name: "Rocky Lake",
    src: "/covers/cover-10.webp",
  },
  {
    id: "cover-11",
    name: "Misty Forest",
    src: "/covers/cover-11.webp",
  },
  {
    id: "cover-12",
    name: "Mountain Vista",
    src: "/covers/cover-12.webp",
  },
  {
    id: "cover-13",
    name: "Highland Sheep",
    src: "/covers/cover-13.webp",
  },
  {
    id: "cover-14",
    name: "Sunset Clouds",
    src: "/covers/cover-14.webp",
  },
  {
    id: "cover-15",
    name: "Cross in Wildflowers",
    src: "/covers/cover-15.webp",
  },
  {
    id: "cover-16",
    name: "Cross on the Hill",
    src: "/covers/cover-16.webp",
  },
  {
    id: "cover-17",
    name: "Hands in Prayer",
    src: "/covers/cover-17.webp",
  },
  {
    id: "cover-18",
    name: "Sunset Grasses",
    src: "/covers/cover-18.webp",
  },
  {
    id: "cover-19",
    name: "Golden Rice Field",
    src: "/covers/cover-19.webp",
  },
  {
    id: "cover-20",
    name: "Sunlit Wildflowers",
    src: "/covers/cover-20.webp",
  },
  {
    id: "cover-21",
    name: "Quiet Beach",
    src: "/covers/cover-21.webp",
  },
  {
    id: "cover-22",
    name: "Bubbles in the Sky",
    src: "/covers/cover-22.webp",
  },
  {
    id: "cover-23",
    name: "Tropical Sunset",
    src: "/covers/cover-23.webp",
  },
  {
    id: "cover-24",
    name: "Rolling Green Hills",
    src: "/covers/cover-24.webp",
  },
  {
    id: "cover-25",
    name: "Running Horses",
    src: "/covers/cover-25.webp",
  },
  {
    id: "cover-26",
    name: "Ducks on the Pond",
    src: "/covers/cover-26.webp",
  },
  {
    id: "cover-27",
    name: "The Last Supper",
    src: "/covers/cover-27.webp",
  },
  {
    id: "cover-28",
    name: "Stories in Stained Glass",
    src: "/covers/cover-28.webp",
  },
  {
    id: "cover-29",
    name: "Sacred Light",
    src: "/covers/cover-29.webp",
  },
  {
    id: "cover-30",
    name: "Mountain Wildflowers",
    src: "/covers/cover-30.webp",
  },
] as const;

export type ProfileCoverId = (typeof PROFILE_COVERS)[number]["id"];
export type ProfileCover = (typeof PROFILE_COVERS)[number];

export const PROFILE_COVER_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "peaceful", label: "Peaceful & Serene" },
  { id: "nature", label: "Nature & Scenic" },
  { id: "warm", label: "Warm & Dreamy" },
  { id: "moody", label: "Moody & Cinematic" },
  { id: "sacred", label: "Sacred & Reflective" },
  { id: "adventure", label: "Adventure & Travel" },
] as const;

export type ProfileCoverCategoryId =
  (typeof PROFILE_COVER_CATEGORIES)[number]["id"];
export type ProfileCoverVibeId = Exclude<ProfileCoverCategoryId, "all">;

/**
 * Manual overrides are intentionally keyed by string rather than ProfileCoverId.
 * That keeps this category layer compatible when more cover IDs are appended to
 * PROFILE_COVERS without requiring a database or type migration.
 */
const PROFILE_COVER_CATEGORY_OVERRIDES: Readonly<Record<string, ProfileCoverVibeId>> = {
  "cover-01": "peaceful",
  "cover-02": "nature",
  "cover-03": "adventure",
  "cover-04": "sacred",
  "cover-05": "warm",
  "cover-06": "nature",
  "cover-07": "warm",
  "cover-08": "nature",
  "cover-09": "adventure",
  "cover-10": "nature",
  "cover-11": "moody",
  "cover-12": "adventure",
  "cover-13": "nature",
  "cover-14": "warm",
  "cover-15": "sacred",
  "cover-16": "sacred",
  "cover-17": "sacred",
  "cover-18": "warm",
  "cover-19": "nature",
  "cover-20": "peaceful",
  "cover-21": "peaceful",
  "cover-22": "peaceful",
  "cover-23": "warm",
  "cover-24": "nature",
  "cover-25": "adventure",
  "cover-26": "nature",
  "cover-27": "sacred",
  "cover-28": "sacred",
  "cover-29": "sacred",
  "cover-30": "nature",
};

function inferProfileCoverCategory(name: string): ProfileCoverVibeId {
  const normalizedName = name.toLowerCase();

  if (/(church|chapel|cathedral|sanctuary|altar|cross|basilica|shrine)/.test(normalizedName)) {
    return "sacred";
  }

  if (/(sunset|sunrise|golden|lighthouse|glow|dusk|dawn)/.test(normalizedName)) {
    return "warm";
  }

  if (/(mist|misty|fog|foggy|storm|night|dark|moody|rain)/.test(normalizedName)) {
    return "moody";
  }

  if (/(road|desert|train|city|village|trail|canyon|vista|travel|coast)/.test(normalizedName)) {
    return "adventure";
  }

  if (/(mountain|meadow|forest|flower|garden|waterfall|valley|field|rocky)/.test(normalizedName)) {
    return "nature";
  }

  if (/(sky|ocean|sea|beach|lake|cloud|pastel|calm|serene)/.test(normalizedName)) {
    return "peaceful";
  }

  // A calm category is a safer visual fallback than hiding an unclassified
  // cover. Every new cover remains selectable even before a manual override is
  // added for it.
  return "peaceful";
}

export function getProfileCover(coverImageId: string | undefined) {
  return PROFILE_COVERS.find((cover) => cover.id === coverImageId);
}

export function getProfileCoverCategory(
  cover: Pick<ProfileCover, "id" | "name">
): ProfileCoverVibeId {
  return (
    PROFILE_COVER_CATEGORY_OVERRIDES[cover.id] ??
    inferProfileCoverCategory(cover.name)
  );
}

export function getProfileCoversByCategory(
  categoryId: ProfileCoverCategoryId
): readonly ProfileCover[] {
  if (categoryId === "all") {
    return PROFILE_COVERS;
  }

  return PROFILE_COVERS.filter(
    (cover) => getProfileCoverCategory(cover) === categoryId
  );
}

export function isProfileCoverId(value: unknown): value is ProfileCoverId {
  return typeof value === "string" && Boolean(getProfileCover(value));
}
