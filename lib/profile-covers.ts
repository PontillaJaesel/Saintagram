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
] as const;

export type ProfileCoverId = (typeof PROFILE_COVERS)[number]["id"];

export function getProfileCover(coverImageId: string | undefined) {
  return PROFILE_COVERS.find((cover) => cover.id === coverImageId);
}

export function isProfileCoverId(value: unknown): value is ProfileCoverId {
  return typeof value === "string" && Boolean(getProfileCover(value));
}
