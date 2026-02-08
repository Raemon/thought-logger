import { beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";

import { getRecentSummaries } from "../../src/electron/files";
import { Summary, SummaryScopeTypes } from "../../src/types/files.d";

// TODO: move common mocks into global config

vi.mock("electron", () => {
  return {
    ipcMain: {
      handle: (): undefined => undefined,
      on: (): undefined => undefined,
    },
    app: {
      isPackaged: false,
      getPath: () => "/",
      getAppPath: () => "/",
      on: (): undefined => undefined,
      whenReady: () => Promise.reject(),
    },
  };
});

vi.mock("node:fs");
vi.mock("node:fs/promises");

beforeEach(() => {
  vol.reset();
});

describe("#getRecentSummaries", () => {
  it("infers daily summaries from keylogs and screenshots", async () => {
    const filesystem = {
      files: {
        keylogs: {
          "2025-08": {
            "2025-08-20.log": "",
            "2025-08-19.processed.chronological.log": "",
          },
        },
        screenshots: {
          "2025-08": {
            "2025-08-20": {
              "2025-08-20 10_30_00.jpg": "",
              "2025-08-20 10_30_00.json": "",
              "2025-08-20 11_00_00.jpg": "",
              "2025-08-20 12_45_00.json": "",
            },
            "2025-08-17": {
              "2025-08-17 10_30_00.jpg": "",
              "2025-08-17 10_30_00.project.document.json": "",
              "2025-08-17 11_00_00.jpg": "",
              "2025-08-17 12_45_00.json": "",
            },
          },
        },
      },
    };

    const expectedSummaries: Summary[] = [
      {
        path: "/files/keylogs/2025-08/2025-08-19.aisummary.log",
        contents: null,
        date: new Date(2025, 7, 19),
        keylogs: [
          {
            appPath: "/files/keylogs/2025-08/2025-08-19.processed.by-app.log",
            chronoPath:
              "/files/keylogs/2025-08/2025-08-19.processed.chronological.log",
            rawPath: "/files/keylogs/2025-08/2025-08-19.log",
            date: new Date(2025, 7, 19),
          },
        ],
        screenshots: [],
        loading: false,
        scope: SummaryScopeTypes.Day,
        keylogCharCount: 0,
        screenshotSummaryCharCount: 0,
      },
      {
        path: "/files/keylogs/2025-08/2025-08-20.aisummary.log",
        contents: null,
        date: new Date(2025, 7, 20),
        keylogs: [
          {
            appPath: "/files/keylogs/2025-08/2025-08-20.processed.by-app.log",
            chronoPath:
              "/files/keylogs/2025-08/2025-08-20.processed.chronological.log",
            rawPath: "/files/keylogs/2025-08/2025-08-20.log",
            date: new Date(2025, 7, 20),
          },
        ],
        screenshots: [
          {
            date: new Date(2025, 7, 20, 10, 30),
            imagePath:
              "/files/screenshots/2025-08/2025-08-20/2025-08-20 10_30_00.jpg",
            summaryPath:
              "/files/screenshots/2025-08/2025-08-20/2025-08-20 10_30_00.json",
          },
          {
            date: new Date(2025, 7, 20, 11),
            imagePath:
              "/files/screenshots/2025-08/2025-08-20/2025-08-20 11_00_00.jpg",
            summaryPath:
              "/files/screenshots/2025-08/2025-08-20/2025-08-20 11_00_00.json",
          },
          {
            date: new Date(2025, 7, 20, 12, 45),
            imagePath:
              "/files/screenshots/2025-08/2025-08-20/2025-08-20 12_45_00.jpg",
            summaryPath:
              "/files/screenshots/2025-08/2025-08-20/2025-08-20 12_45_00.json",
          },
        ],
        loading: false,
        scope: SummaryScopeTypes.Day,
        keylogCharCount: 0,
        screenshotSummaryCharCount: 0,
      },
      {
        path: "/files/keylogs/2025-08/2025-08-17.aisummary.log",
        contents: null,
        date: new Date(2025, 7, 17),
        keylogs: [],
        screenshots: [
          {
            date: new Date(2025, 7, 17, 10, 30),
            imagePath:
              "/files/screenshots/2025-08/2025-08-17/2025-08-17 10_30_00.jpg",
            summaryPath:
              "/files/screenshots/2025-08/2025-08-17/2025-08-17 10_30_00.project.document.json",
          },
          {
            date: new Date(2025, 7, 17, 11),
            imagePath:
              "/files/screenshots/2025-08/2025-08-17/2025-08-17 11_00_00.jpg",
            summaryPath:
              "/files/screenshots/2025-08/2025-08-17/2025-08-17 11_00_00.json",
          },
          {
            date: new Date(2025, 7, 17, 12, 45),
            imagePath:
              "/files/screenshots/2025-08/2025-08-17/2025-08-17 12_45_00.jpg",
            summaryPath:
              "/files/screenshots/2025-08/2025-08-17/2025-08-17 12_45_00.json",
          },
        ],
        loading: false,
        scope: SummaryScopeTypes.Day,
        keylogCharCount: 0,
        screenshotSummaryCharCount: 0,
      },
    ];
    vol.fromNestedJSON(filesystem, "/");
    const summaries = await getRecentSummaries();
    expect(
      summaries.filter((summary) => summary.scope === SummaryScopeTypes.Day),
    ).toStrictEqual(expectedSummaries);
  });

  it("infers weekly summaries", async () => {
    const filesystem = {
      files: {
        keylogs: {
          "2025-08": {
            "2025-08-14.log": "",
          },
        },
        screenshots: {
          "2025-08": {
            "2025-08-13": {
              "2025-08-13 10_30_00.jpg": "",
              "2025-08-13 10_30_00.json": "",
              "2025-08-13 11_00_00.jpg": "",
              "2025-08-13 12_45_00.json": "",
            },
          },
        },
      },
    };

    const weeklySummary: Summary = {
      date: new Date(2025, 7, 11),
      path: "/files/2025-W33.aisummary.log",
      contents: null,
      keylogs: [
        {
          appPath: "/files/keylogs/2025-08/2025-08-14.processed.by-app.log",
          chronoPath:
            "/files/keylogs/2025-08/2025-08-14.processed.chronological.log",
          rawPath: "/files/keylogs/2025-08/2025-08-14.log",
          date: new Date(2025, 7, 14),
        },
      ],
      loading: false,
      scope: SummaryScopeTypes.Week,
      screenshots: [
        {
          date: new Date(2025, 7, 13, 10, 30),
          imagePath:
            "/files/screenshots/2025-08/2025-08-13/2025-08-13 10_30_00.jpg",
          summaryPath:
            "/files/screenshots/2025-08/2025-08-13/2025-08-13 10_30_00.json",
        },
        {
          date: new Date(2025, 7, 13, 11),
          imagePath:
            "/files/screenshots/2025-08/2025-08-13/2025-08-13 11_00_00.jpg",
          summaryPath:
            "/files/screenshots/2025-08/2025-08-13/2025-08-13 11_00_00.json",
        },
        {
          date: new Date(2025, 7, 13, 12, 45),
          imagePath:
            "/files/screenshots/2025-08/2025-08-13/2025-08-13 12_45_00.jpg",
          summaryPath:
            "/files/screenshots/2025-08/2025-08-13/2025-08-13 12_45_00.json",
        },
      ],
    };
    vol.fromNestedJSON(filesystem, "/");
    const summaries = await getRecentSummaries();
    expect(
      summaries.find((summary) => summary.scope === SummaryScopeTypes.Week),
    ).toStrictEqual(weeklySummary);
  });

  it("doesn't fail when directories are missing", async () => {
    const filesystem = {
      files: {},
    };

    vol.fromNestedJSON(filesystem, "/");
    await expect(getRecentSummaries()).resolves.toStrictEqual([]);
  });

  it("loads daily summary contents", async () => {
    const filesystem = {
      files: {
        keylogs: {
          "2025-08": {
            "2025-08-20.aisummary.log": "This is a daily summary.",
          },
        },
      },
    };

    vol.fromNestedJSON(filesystem, "/");
    const summaries = await getRecentSummaries();
    const dailySummary = summaries.find(
      (summary) => summary.scope === SummaryScopeTypes.Day,
    );
    expect(dailySummary?.contents).toBe("This is a daily summary.");
  });

  it("doesn't fail on invalid files", async () => {
    const filesystem = {
      files: {
        keylogs: {
          "2025-08": {
            ".DS_STORE": "",
          },
        },
        screenshots: {
          "2025-08-20": {},
        },
      },
    };
    vol.fromNestedJSON(filesystem, "/");
    await expect(getRecentSummaries()).resolves.toStrictEqual([]);
  });

  it("works on encrypted keylogs", async () => {
    const filesystem = {
      files: {
        keylogs: {
          "2025-08": {
            "2025-08-20.aisummary.log.crypt": "",
          },
        },
      },
    };

    const encryptedWeeklySummary: Summary = {
      date: new Date(2025, 7, 18),
      path: "/files/2025-W34.aisummary.log",
      contents: null,
      keylogs: [
        {
          appPath: "/files/keylogs/2025-08/2025-08-20.processed.by-app.log",
          chronoPath:
            "/files/keylogs/2025-08/2025-08-20.processed.chronological.log",
          rawPath: "/files/keylogs/2025-08/2025-08-20.log",
          date: new Date(2025, 7, 20),
        },
      ],
      loading: false,
      scope: SummaryScopeTypes.Week,
      screenshots: [],
    };

    const encryptedDailySummary: Summary = {
      date: new Date(2025, 7, 20),
      path: "/files/keylogs/2025-08/2025-08-20.aisummary.log",
      contents: null,
      keylogs: [
        {
          appPath: "/files/keylogs/2025-08/2025-08-20.processed.by-app.log",
          chronoPath:
            "/files/keylogs/2025-08/2025-08-20.processed.chronological.log",
          rawPath: "/files/keylogs/2025-08/2025-08-20.log",
          date: new Date(2025, 7, 20),
        },
      ],
      loading: false,
      scope: SummaryScopeTypes.Day,
      screenshots: [],
      keylogCharCount: 0,
      screenshotSummaryCharCount: 0,
    };

    vol.fromNestedJSON(filesystem, "/");
    const summaries = await getRecentSummaries();
    expect(summaries).toStrictEqual([
      encryptedWeeklySummary,
      encryptedDailySummary,
    ]);
  });
});
