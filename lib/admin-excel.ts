import "server-only";

import ExcelJS from "exceljs";
import {
  jsonValue,
  loadAdminUsers,
  loadUserData
} from "@/lib/admin-data";
import { getFirebaseAdminStorage } from "@/lib/firebase-admin";
import type {
  AdminUserData,
  AdminUserSummary
} from "@/types";

/* ============================================================
   CONSTANTS
   ============================================================ */

const excluded = (key: string) =>
  /token|password|secret|privateKey|rawIp|accessCode/i.test(
    key
  );

const isoDate =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const title = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (letter) =>
      letter.toUpperCase()
    );

/* ============================================================
   EXCEL COLORS
   ============================================================ */

const COLORS = {
  darkText: "FF24352A",

  /*
   * Normal labels shown on a white background.
   */
  labelText: "FF36523F",

  /*
   * Main green section headers.
   */
  sectionGreen: "FF52705A",

  /*
   * White text for green section headers.
   */
  white: "FFFFFFFF",

  /*
   * Hyperlink green.
   */
  linkGreen: "FF2F6B4F"
};

/* ============================================================
   DATE / PLACE FORMAT
   ============================================================ */

function dateTimePlace(
  value: string,
  record: Record<string, unknown>
): string {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }
    ).formatToParts(
      new Date(value)
    );

  const part = (
    type: Intl.DateTimeFormatPartTypes
  ) =>
    parts.find(
      (item) =>
        item.type === type
    )?.value ?? "";

  const place = String(
    record.locationLabel ||
      [
        record.city,
        record.region,
        record.country
      ]
        .filter(Boolean)
        .join(", ") ||
      ""
  ).trim();

  return `${part("year")}-${part(
    "month"
  )}-${part("day")}; ${part(
    "hour"
  )}:${part("minute")}:${part(
    "second"
  )}${place ? `; ${place}` : ""}`;
}

/* ============================================================
   SAFE EXCEL VALUE
   ============================================================ */

function safe(
  value: unknown,
  record: Record<string, unknown>
): string | number | boolean {
  const normalized =
    jsonValue(value);

  let serialized: string;

  if (
    typeof normalized ===
      "string" &&
    isoDate.test(normalized)
  ) {
    serialized = dateTimePlace(
      normalized,
      record
    );
  } else if (
    Array.isArray(normalized)
  ) {
    serialized = normalized
      .map((item) => {
        if (
          typeof item ===
            "object" &&
          item !== null
        ) {
          return Object.entries(
            item as Record<
              string,
              unknown
            >
          )
            .map(
              ([key, child]) =>
                `${title(
                  key
                )}: ${String(
                  child
                )}`
            )
            .join("; ");
        }

        return String(item);
      })
      .join(", ");
  } else if (
    typeof normalized ===
      "object" &&
    normalized !== null
  ) {
    serialized =
      Object.entries(
        normalized as Record<
          string,
          unknown
        >
      )
        .map(
          ([key, child]) =>
            `${title(
              key
            )}: ${String(
              child
            )}`
        )
        .join("; ");
  } else {
    serialized = String(
      normalized ?? ""
    );
  }

  /*
   * Prevent Excel formula
   * injection from user text.
   */
  return /^[=+\-@]/.test(
    serialized
  )
    ? `'${serialized}`
    : serialized;
}

/* ============================================================
   SHEET NAME
   ============================================================ */

function uniqueSheetName(
  name: string,
  used: Set<string>
): string {
  const clean =
    name
      .replace(
        /[\\/?*[\]:]/g,
        " "
      )
      .trim()
      .slice(0, 31) ||
    "User";

  let candidate = clean;
  let suffix = 2;

  while (
    used.has(
      candidate.toLocaleLowerCase()
    )
  ) {
    const marker = ` ${suffix++}`;

    candidate = `${clean.slice(
      0,
      31 - marker.length
    )}${marker}`;
  }

  used.add(
    candidate.toLocaleLowerCase()
  );

  return candidate;
}

/* ============================================================
   MEDIA LINK
   ============================================================ */

async function mediaLink(
  path: string
): Promise<
  | ExcelJS.CellHyperlinkValue
  | string
> {
  try {
    const bucketName =
      process.env
        .NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        ?.trim();

    if (!bucketName) {
      return "Media unavailable";
    }

    const [url] =
      await getFirebaseAdminStorage()
        .bucket(bucketName)
        .file(path)
        .getSignedUrl({
          action: "read",
          expires:
            Date.now() +
            7 *
              24 *
              60 *
              60 *
              1000
        });

    return {
      text: "Download media",
      hyperlink: url,
      tooltip:
        "Download this media file (link valid for 7 days)"
    };
  } catch {
    return "Media unavailable";
  }
}

/* ============================================================
   REFERENCES
   ============================================================ */

function buildReferences(
  allUsers: AdminUserSummary[],
  owner: AdminUserSummary,
  data: AdminUserData
): Map<string, string> {
  const references =
    new Map(
      allUsers.map(
        (user) => [
          user.id,
          `${
            user.name
          } (${
            user.email ||
            "Guest account"
          })`
        ]
      )
    );

  references.set(
    owner.id,
    `${
      owner.name
    } (${
      owner.email ||
      "Guest account"
    })`
  );

  Object.values(
    data.collections
  ).forEach((rows) =>
    rows.forEach(
      (record, index) => {
        if (
          typeof record.id !==
          "string"
        ) {
          return;
        }

        const assigned =
          record.title ||
          record.name ||
          record.profileName ||
          record.content;

        references.set(
          record.id,
          typeof assigned ===
            "string"
            ? assigned.slice(
                0,
                80
              )
            : `Record ${
                index + 1
              }`
        );
      }
    )
  );

  return references;
}

/* ============================================================
   NORMAL LABEL STYLE
   ============================================================ */

/*
 * Apply this only to normal label cells.
 *
 * Do NOT apply this to the entire first
 * column because doing so would override
 * the white text used by section headers.
 */
function styleLabelCell(
  cell: ExcelJS.Cell
) {
  cell.font = {
    bold: true,
    color: {
      argb:
        COLORS.labelText
    }
  };

  cell.alignment = {
    vertical: "top",
    wrapText: true
  };
}

/* ============================================================
   ADD SECTION
   ============================================================ */

async function addSection(
  sheet: ExcelJS.Worksheet,
  section: string,
  records: Record<
    string,
    unknown
  >[],
  references: Map<
    string,
    string
  >
) {
  /* ----------------------------------------------------------
     SECTION HEADER
     ---------------------------------------------------------- */

  const heading =
    sheet.addRow([
      section
    ]);

  /*
   * WHITE text.
   */
  heading.font = {
    bold: true,
    color: {
      argb: COLORS.white
    },
    size: 12
  };

  /*
   * GREEN background.
   */
  heading.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb:
        COLORS.sectionGreen
    }
  };

  heading.alignment = {
    vertical: "middle"
  };

  heading.height = 23;

  sheet.mergeCells(
    heading.number,
    1,
    heading.number,
    3
  );

  /* ----------------------------------------------------------
     EMPTY SECTION
     ---------------------------------------------------------- */

  if (!records.length) {
    const emptyRow =
      sheet.addRow([
        "No recorded data"
      ]);

    emptyRow.getCell(
      1
    ).font = {
      italic: true,
      color: {
        argb:
          COLORS.labelText
      }
    };

    sheet.addRow([]);

    return;
  }

  /* ----------------------------------------------------------
     RECORDS
     ---------------------------------------------------------- */

  for (
    let recordIndex = 0;
    recordIndex <
    records.length;
    recordIndex++
  ) {
    const record =
      records[recordIndex];

    /*
     * If a collection contains multiple
     * records, show a smaller record header.
     */
    if (
      records.length > 1
    ) {
      const recordHeader =
        sheet.addRow([
          `${section} ${
            recordIndex + 1
          }`
        ]);

      recordHeader.getCell(
        1
      ).font = {
        bold: true,
        color: {
          argb:
            COLORS.labelText
        },
        size: 11
      };
    }

    let entries =
      Object.entries(
        record
      ).filter(
        ([key]) =>
          !excluded(key) &&
          ![
            "city",
            "region",
            "country",
            "locationLabel"
          ].includes(key)
      );

    /*
     * Hide technical IDs from
     * Profile sections.
     */
    if (
      section ===
      "Profile"
    ) {
      entries =
        entries.filter(
          ([key]) =>
            key !== "id" &&
            key !== "userId"
        );
    }

    /*
     * Account privacy settings
     * are converted to readable
     * values.
     */
    if (
      section ===
      "Account"
    ) {
      entries =
        entries.filter(
          ([key]) =>
            key !==
            "privacyPreferences"
        );

      const privacy =
        record.privacyPreferences as
          | Record<
              string,
              unknown
            >
          | undefined;

      if (privacy) {
        entries.push(
          [
            "privacyCheck",
            privacy.requirePrivateCheck ===
            true
              ? "Allowed"
              : "Not allowed"
          ],
          [
            "reflectionDates",
            privacy.showReflectionDates ===
            true
              ? "Shown"
              : "Hidden"
          ]
        );
      }
    }

    /* --------------------------------------------------------
       FIELD ROWS
       -------------------------------------------------------- */

    for (
      const [
        key,
        value
      ] of entries
    ) {
      let resolved: ExcelJS.CellValue;

      /*
       * Single stored media path.
       */
      if (
        (
          key ===
            "imagePath" ||
          key === "path"
        ) &&
        typeof value ===
          "string" &&
        value.startsWith(
          "users/"
        )
      ) {
        resolved =
          await mediaLink(
            value
          );
      }

      /*
       * Resolve IDs into readable
       * user or record names.
       */
      else if (
        (
          key === "id" ||
          key.endsWith("Id")
        ) &&
        typeof value ===
          "string"
      ) {
        resolved =
          references.get(
            value
          ) ||
          `Record ${
            recordIndex + 1
          }`;
      }

      /*
       * Multiple media items.
       */
      else if (
        key === "media" &&
        Array.isArray(value)
      ) {
        const links =
          await Promise.all(
            value.map(
              (item) =>
                mediaLink(
                  String(
                    (
                      item as {
                        path?: unknown;
                      }
                    ).path ||
                      ""
                  )
                )
            )
          );

        resolved = links
          .map((link) =>
            typeof link ===
            "string"
              ? link
              : link.hyperlink
          )
          .join("\n");
      }

      /*
       * Normal value.
       */
      else {
        resolved = safe(
          value,
          record
        );
      }

      const row =
        sheet.addRow([
          key ===
          "privacyCheck"
            ? "Privacy Check"
            : title(key),

          resolved
        ]);

      /*
       * IMPORTANT:
       *
       * Style only this normal
       * field-label cell.
       *
       * This no longer affects the
       * green section headers.
       */
      styleLabelCell(
        row.getCell(1)
      );

      row.getCell(
        2
      ).alignment = {
        vertical: "top",
        wrapText: true
      };

      /*
       * Real hyperlink.
       */
      if (
        typeof resolved ===
          "object" &&
        resolved &&
        "hyperlink" in
          resolved
      ) {
        row.getCell(
          2
        ).font = {
          color: {
            argb:
              COLORS.linkGreen
          },
          underline: true
        };
      }
    }

    if (
      recordIndex <
      records.length - 1
    ) {
      sheet.addRow([]);
    }
  }

  sheet.addRow([]);
}

/* ============================================================
   CREATE ADMIN WORKBOOK
   ============================================================ */

export async function createAdminWorkbook(
  options: {
    userId?: string;
    from?: string;
    to?: string;
    include?: string[];
  }
) {
  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    "Saintagram Admin";

  workbook.created =
    new Date();

  const allUsers =
    await loadAdminUsers();

  const users =
    options.userId
      ? allUsers.filter(
          (user) =>
            user.id ===
            options.userId
        )
      : allUsers;

  const usedNames =
    new Set<string>();

  /* ==========================================================
     ONE WORKSHEET PER USER
     ========================================================== */

  for (
    const user of users
  ) {
    const data =
      await loadUserData(
        user.id
      );

    const references =
      buildReferences(
        allUsers,
        user,
        data
      );

    /*
     * Full/default name.
     *
     * This is now used as the first
     * large title at the top of every
     * user's Excel sheet.
     */
    const fullName =
      user.fullName?.trim() ||
      user.name?.trim() ||
      user.email ||
      user.id;

    /*
     * Display name is still useful for
     * the worksheet tab / assigned-user
     * information.
     */
    const displayName =
      user.displayName?.trim() ||
      user.name?.trim() ||
      fullName;

    const sheet =
      workbook.addWorksheet(
        uniqueSheetName(
          displayName ||
            fullName,
          usedNames
        ),
        {
          views: [
            {
              state:
                "frozen",
              ySplit: 5,
              showGridLines:
                false
            }
          ]
        }
      );

    /* --------------------------------------------------------
       COLUMN WIDTHS
       -------------------------------------------------------- */

    sheet.columns = [
      {
        width: 30
      },
      {
        width: 78
      },
      {
        width: 2
      }
    ];

    /* --------------------------------------------------------
       FULL NAME AT TOP
       -------------------------------------------------------- */

    const pageTitle =
      sheet.addRow([
        fullName
      ]);

    pageTitle.font = {
      bold: true,
      size: 18,
      color: {
        argb:
          COLORS.darkText
      }
    };

    pageTitle.height = 25;

    sheet.mergeCells(
      pageTitle.number,
      1,
      pageTitle.number,
      3
    );

    /* --------------------------------------------------------
       BASIC ACCOUNT INFORMATION
       -------------------------------------------------------- */

    const usernameRow =
      sheet.addRow([
        "Username",
        user.email ||
          "Guest account"
      ]);

    const assignedUserRow =
      sheet.addRow([
        "Assigned User",
        `${displayName} (${
          user.email ||
          "Guest account"
        })`
      ]);

    const exportedRow =
      sheet.addRow([
        "Exported",
        dateTimePlace(
          new Date().toISOString(),
          {}
        )
      ]);

    /*
     * Style only these label cells.
     *
     * We no longer color the entire
     * first Excel column.
     */
    for (
      const row of [
        usernameRow,
        assignedUserRow,
        exportedRow
      ]
    ) {
      styleLabelCell(
        row.getCell(1)
      );

      row.getCell(
        2
      ).alignment = {
        vertical: "top",
        wrapText: true
      };
    }

    sheet.addRow([]);

    /* --------------------------------------------------------
       ACCOUNT / PROFILE SECTIONS
       -------------------------------------------------------- */

    await addSection(
      sheet,
      "Account",
      [data.user],
      references
    );

    await addSection(
      sheet,
      "Profile",
      data.profile
        ? [data.profile]
        : [],
      references
    );

    await addSection(
      sheet,
      "Private Profile",
      data.privateProfile
        ? [
            data.privateProfile
          ]
        : [],
      references
    );

    await addSection(
      sheet,
      "Profile Draft",
      data.draft
        ? [data.draft]
        : [],
      references
    );

    /* --------------------------------------------------------
       ALL OTHER COLLECTIONS
       -------------------------------------------------------- */

    for (
      const [
        name,
        rows
      ] of Object.entries(
        data.collections
      )
    ) {
      await addSection(
        sheet,
        title(name),
        rows,
        references
      );
    }

    /* --------------------------------------------------------
       FINAL SHEET FORMATTING
       -------------------------------------------------------- */

    /*
     * IMPORTANT:
     *
     * Do NOT put:
     *
     * sheet.getColumn(1).font = ...
     *
     * here.
     *
     * Doing that overrides the WHITE
     * section-header text.
     */

    sheet.getColumn(
      2
    ).alignment = {
      vertical: "top",
      wrapText: true
    };

    sheet.eachRow(
      (row) => {
        if (!row.height) {
          row.height = 20;
        }
      }
    );
  }

  /* ==========================================================
     NO USERS
     ========================================================== */

  if (!users.length) {
    workbook
      .addWorksheet(
        "No Users"
      )
      .addRow([
        "No user records were available for export."
      ]);
  }

  return workbook.xlsx.writeBuffer();
}