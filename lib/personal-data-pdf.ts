import type {
  Content,
  ContentStack,
  TDocumentDefinitions
} from "pdfmake/interfaces";
import type { PersonalDataExport, ReflectionPost } from "@/types";

function safeText(value: unknown, fallback = "Not provided"): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.split("\u0000").join("").trim();
  return cleaned || fallback;
}

function reflectionBlock(
  post: ReflectionPost,
  index: number
): ContentStack {
  return {
    unbreakable: true,
    margin: [0, 0, 0, 14],
    stack: [
      {
        text: `Reflection ${index + 1}`,
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
          new Date(post.createdAt).toLocaleString(),
          { text: "   Updated: ", bold: true },
          new Date(post.updatedAt).toLocaleString(),
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
  posts: ReflectionPost[]
): Content[] {
  return [
    {
      text: title,
      style: "sectionHeading",
      pageBreak: title.startsWith("Private") ? "before" : undefined
    },
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

export function personalDataPdfDefinition(
  archive: PersonalDataExport
): TDocumentDefinitions {
  const publicPosts = archive.reflections.filter((post) => !post.isPrivate);
  const privatePosts = archive.reflections.filter((post) => post.isPrivate);
  const generatedAt = new Date(archive.exportedAt);

  return {
    info: {
      title: "Saintagram Personal Data",
      subject: "Private account-owner reflection export",
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
        text: `Account: ${safeText(archive.user.email)}`,
        margin: [0, 0, 0, 8]
      },
      {
        text:
          "This private export contains every reflection currently available to the signed-in account owner. Store it securely.",
        italics: true,
        color: "#7a5637",
        margin: [0, 0, 0, 14]
      },
      ...reflectionSection("Public reflections", publicPosts),
      ...reflectionSection("Private reflections", privatePosts)
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
