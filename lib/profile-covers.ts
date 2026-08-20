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
] as const;

export type ProfileCoverId = (typeof PROFILE_COVERS)[number]["id"];

export function getProfileCover(coverImageId: string | undefined) {
  return PROFILE_COVERS.find((cover) => cover.id === coverImageId);
}

export function isProfileCoverId(value: unknown): value is ProfileCoverId {
  return typeof value === "string" && Boolean(getProfileCover(value));
}
