import type {
  Content,
  ContentStack,
  TDocumentDefinitions
} from "pdfmake/interfaces";
import type {
  PersonalDataExport,
  ReflectionPost
} from "@/types";

function safeText(value: unknown, fallback = "Not provided"): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.split("\u0000").join("").trim();
  return cleaned || fallback;
}

function friendlyDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Unknown date" : parsed.toLocaleString();
}

function joined(values: string[] | undefined): string {
  const cleaned = (values ?? []).map((value) => value.trim()).filter(Boolean);
  return cleaned.length ? cleaned.join("; ") : "Not provided";
}

function field(label: string, value: string): ContentStack {
  return {
    margin: [0, 0, 0, 9],
    stack: [
      { text: label, bold: true, fontSize: 9, color: "#647067" },
      { text: value, margin: [0, 2, 0, 0], lineHeight: 1.25 }
    ]
  };
}

function reflectionBlock(post: ReflectionPost, index: number): ContentStack {
  return {
    margin: [0, 0, 0, 14],
    stack: [
      {
        text: post.title?.trim() || `Reflection ${index + 1}`,
        bold: true,
        fontSize: 12,
        color: "#315c4b"
      },
      {
        text: safeText(post.content, "(Empty reflection)"),
        margin: [0, 5, 0, 6],
        lineHeight: 1.3
      },
      {
        text: [
          { text: "Created: ", bold: true },
          friendlyDate(post.createdAt),
          { text: "   Updated: ", bold: true },
          friendlyDate(post.updatedAt),
          { text: "   Visibility: ", bold: true },
          post.isPrivate ? "Private" : "Public"
        ],
        fontSize: 9,
        color: "#647067"
      }
    ]
  };
}

function reflectionSection(
  title: string,
  posts: ReflectionPost[],
  pageBreak?: "before"
): Content[] {
  return [
    { text: title, style: "sectionHeading", ...(pageBreak ? { pageBreak } : {}) },
    posts.length
      ? posts.map(reflectionBlock)
      : {
          text: "No reflections in this section.",
          italics: true,
          color: "#647067",
          margin: [0, 0, 0, 16]
        }
  ];
}

function linkLine(label: string, url?: string): Content {
  if (!url) {
    return {
      text: [{ text: `${label}: `, bold: true }, "No downloadable file is currently available."],
      margin: [0, 0, 0, 7]
    };
  }

  return {
    text: [
      { text: `${label}: `, bold: true },
      { text: "Download", link: url, color: "#315c4b", decoration: "underline" }
    ],
    margin: [0, 0, 0, 7]
  };
}

function mediaLinks(archive: PersonalDataExport): Content[] {
  const entries = archive.reflections.flatMap((post) =>
    (post.media ?? []).map((media, mediaIndex) => ({ post, media, mediaIndex }))
  );

  if (!entries.length) {
    return [
      { text: "Reflection media download links", style: "sectionHeading" },
      { text: "No reflection images or videos are currently stored.", italics: true, color: "#647067" }
    ];
  }

  return [
    { text: "Reflection media download links", style: "sectionHeading" },
    ...entries.map(({ post, media, mediaIndex }) => {
      const url = archive.downloadLinks.reflectionMedia[media.path];
      const title = post.title?.trim() || safeText(post.content, "Reflection").slice(0, 60);
      return {
        margin: [0, 0, 0, 8],
        text: [
          { text: `${title} · ${media.type} ${mediaIndex + 1}: `, bold: true },
          url
            ? { text: "Download media", link: url, color: "#315c4b", decoration: "underline" }
            : { text: "Download link unavailable", color: "#647067" }
        ]
      } as Content;
    })
  ];
}

function activitySection(archive: PersonalDataExport): Content[] {
  const activity: Array<{ at: string; label: string; detail: string }> = [];

  if (archive.user.createdAt) {
    activity.push({ at: archive.user.createdAt, label: "Account created", detail: "Saintagram account record created." });
  }
  if (archive.profile?.createdAt) {
    activity.push({ at: archive.profile.createdAt, label: "Profile created", detail: "Spiritual profile created." });
  }
  for (const event of archive.profileJourneyEvents) {
    activity.push({
      at: event.createdAt,
      label: "Profile updated",
      detail: event.changes.join("; ")
    });
  }
  for (const post of archive.reflections) {
    activity.push({
      at: post.createdAt,
      label: post.isPrivate ? "Private reflection created" : "Reflection posted",
      detail: post.title?.trim() || safeText(post.content, "Reflection").slice(0, 120)
    });
  }
  for (const like of archive.likes) {
    activity.push({
      at: like.createdAt,
      label: "Reflection liked",
      detail: `Reflection ID: ${like.reflectionId}`
    });
  }
  for (const comment of archive.comments) {
    activity.push({
      at: comment.createdAt,
      label: comment.parentCommentId ? "Reply posted" : "Comment posted",
      detail: `${safeText(comment.content)} · Reflection ID: ${comment.reflectionId}`
    });
  }

  activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return [
    {
      text: "Recorded user data activity",
      style: "sectionHeading",
      pageBreak: "before"
    },
    {
      text: "This page summarizes the account activity records used by Saintagram's Journey experience.",
      color: "#647067",
      margin: [0, 0, 0, 14]
    },
    ...(activity.length
      ? activity.map((item) => ({
          margin: [0, 0, 0, 10],
          stack: [
            { text: item.label, bold: true, color: "#315c4b" },
            { text: item.detail, margin: [0, 2, 0, 2] },
            { text: friendlyDate(item.at), fontSize: 9, color: "#647067" }
          ]
        } as ContentStack))
      : [{ text: "No recorded activity is currently available.", italics: true, color: "#647067" } as Content])
  ];
}

export function personalDataPdfDefinition(
  archive: PersonalDataExport
): TDocumentDefinitions {
  const profile = archive.profile;
  const publicPosts = archive.reflections.filter((post) => !post.isPrivate);
  const privatePosts = archive.reflections.filter((post) => post.isPrivate);
  const generatedAt = new Date(archive.exportedAt);
  const coverNote = archive.downloadLinks.coverImage
    ? undefined
    : profile?.coverColor
      ? `Header uses profile color ${profile.coverColor}; there is no image file to download.`
      : "No downloadable header image is currently selected.";

  return {
    info: {
      title: "Saintagram Personal Data",
      subject: "Private account-owner data export",
      author: "Saintagram"
    },
    pageMargins: [48, 58, 48, 54],
    header: {
      text: "Saintagram - Personal Data",
      alignment: "right",
      margin: [0, 24, 48, 0],
      color: "#647067",
      fontSize: 9
    },
    footer: (currentPage, pageCount) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: "center",
      margin: [0, 16, 0, 0],
      color: "#647067",
      fontSize: 9
    }),
    defaultStyle: {
      font: "Roboto",
      fontSize: 10.5,
      color: "#24332d"
    },
    styles: {
      title: {
        fontSize: 22,
        bold: true,
        color: "#244c3d",
        margin: [0, 0, 0, 8]
      },
      sectionHeading: {
        fontSize: 16,
        bold: true,
        color: "#244c3d",
        margin: [0, 18, 0, 12]
      }
    },
    content: [
      { text: "Saintagram Personal Data", style: "title" },
      {
        text: `Generated ${generatedAt.toLocaleString()}`,
        color: "#647067",
        margin: [0, 0, 0, 6]
      },
      {
        text: archive.notice,
        italics: true,
        color: "#7a5637",
        margin: [0, 0, 0, 16]
      },

      field("Name", safeText(archive.user.fullName)),
      field("Display Name", safeText(profile?.profileName)),
      field("Username", safeText(archive.user.username)),
      field("Bio", safeText(profile?.spiritualBio)),
      field("Who helps me lead closer to God?", joined(profile?.spiritualGuides)),
      field("Who or what am I following in life right now?", joined(profile?.lifeDirections)),

      { text: "Posts God Sees / Reflection", style: "sectionHeading" },
      ...(publicPosts.length
        ? publicPosts.map(reflectionBlock)
        : [{ text: "No public reflections are currently stored.", italics: true, color: "#647067" } as Content]),

      field("Likes", joined(profile?.heartSeeks)),
      field("God's Comment", safeText(profile?.godsComment)),
      field("Heavenly Hashtag", safeText(profile?.heavenlyHashtag)),

      ...mediaLinks(archive),

      { text: "Profile image and header", style: "sectionHeading" },
      linkLine("Profile icon", archive.downloadLinks.profileImage),
      linkLine("Header image", archive.downloadLinks.coverImage),
      ...(coverNote ? [{ text: coverNote, fontSize: 9, color: "#647067", margin: [0, 0, 0, 8] } as Content] : []),

      ...reflectionSection("Private reflections", privatePosts, "before"),
      ...(profile?.hiddenStory
        ? [
            { text: "Hidden Story", style: "sectionHeading" } as Content,
            { text: profile.hiddenStory, lineHeight: 1.3, margin: [0, 0, 0, 12] } as Content
          ]
        : []),

      ...activitySection(archive),
      ...(archive.unfinishedDraft
        ? [
            { text: "Unfinished profile draft", style: "sectionHeading" } as Content,
            {
              text: `Draft step ${archive.unfinishedDraft.currentStep}; last updated ${friendlyDate(archive.unfinishedDraft.updatedAt)}.`,
              color: "#647067"
            } as Content
          ]
        : [])
    ]
  };
}

export async function createPersonalDataPdf(
  archive: PersonalDataExport
): Promise<Blob> {
  const [pdfMakeModule, fontsModule] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts")
  ]);
  const pdfMake = pdfMakeModule.default;
  const fontSource = fontsModule.default as unknown as {
    pdfMake?: { vfs?: Record<string, string> };
    vfs?: Record<string, string>;
  };
  pdfMake.vfs = (fontSource.pdfMake?.vfs ??
    fontSource.vfs ??
    fontSource) as Record<string, string>;

  return new Promise<Blob>((resolve, reject) => {
    try {
      pdfMake
        .createPdf(personalDataPdfDefinition(archive))
        .getBlob((blob) => resolve(blob));
    } catch {
      reject(new Error("Your PDF could not be generated. Please try again."));
    }
  });
}
