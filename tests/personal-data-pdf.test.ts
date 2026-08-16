import { describe, expect, it } from "vitest";
import { personalDataPdfDefinition } from "@/lib/personal-data-pdf";
import type { PersonalDataExport } from "@/types";

const archive: PersonalDataExport = {
  exportedAt: "2026-07-30T08:00:00.000Z",
  notice: "Private export",
  user: {
    id: "owner-1",
    email: "owner@example.test",
    authProvider: "password",
    mustChangePassword: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-07-30T08:00:00.000Z",
    privacyConsentAt: "2026-01-01T00:00:00.000Z",
    profileCompleted: true
  },
  profile: null,
  unfinishedDraft: null,
  reflections: [
    {
      id: "public-1",
      userId: "owner-1",
      content: "A public moment of grace.",
      isPrivate: false,
      createdAt: "2026-07-28T08:00:00.000Z",
      updatedAt: "2026-07-28T08:00:00.000Z"
    },
    {
      id: "private-1",
      userId: "owner-1",
      content: "A private prayer: Salamat, Diyos. 🙏",
      isPrivate: true,
      createdAt: "2026-07-29T08:00:00.000Z",
      updatedAt: "2026-07-30T08:00:00.000Z"
    }
  ]
};

describe("personal data PDF", () => {
  it("groups every public and private owner reflection in a paginated document", () => {
    const definition = personalDataPdfDefinition(archive);
    const serialized = JSON.stringify(definition.content);

    expect(serialized).toContain("Public reflections");
    expect(serialized).toContain("A public moment of grace.");
    expect(serialized).toContain("Private reflections");
    expect(serialized).toContain("A private prayer: Salamat, Diyos. 🙏");
    expect(definition.footer).toBeTypeOf("function");
  });

  it("renders a clear empty state when there are no reflections", () => {
    const definition = personalDataPdfDefinition({
      ...archive,
      reflections: []
    });
    expect(JSON.stringify(definition.content)).toContain(
      "No reflections in this section."
    );
  });
});
