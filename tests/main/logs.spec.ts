import { beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";

import { getRecentSummaries, writeFile } from "../../src/electron/files";
import { Summary, SummaryScopeTypes } from "../../src/types/files";
import { initializeMasterKey } from "../../src/electron/encryption";
import { isSameDay } from "date-fns";

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

vi.mock("../../src/electron/credentials", async () => {
  const origModule = await vi.importActual("../../src/electron/credentials");
  let secret = "password";
  return {
    ...origModule,
    getSecret: async (_account: string) => Promise.resolve(secret),
    setSecret: async (_account: string, newSecret: string) => {
      secret = newSecret;
      return { success: true, message: "Password set successfully" };
    },
  };
});

vi.mock("node:fs");
vi.mock("node:fs/promises");

beforeEach(async () => {
  vol.reset();
  await initializeMasterKey("password");
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
        path: null,
        contents: null,
        date: new Date(2025, 7, 19),
        keylogs: [
          {
            appPath: null,
            chronoPath:
              "/files/keylogs/2025-08/2025-08-19.processed.chronological.log",
            rawPath: null,
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
        path: null,
        contents: null,
        date: new Date(2025, 7, 20),
        keylogs: [
          {
            appPath: null,
            chronoPath: null,
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
            summaryPath: null,
          },
          {
            date: new Date(2025, 7, 20, 12, 45),
            imagePath: null,
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
        path: null,
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
            summaryPath: null,
          },
          {
            date: new Date(2025, 7, 17, 12, 45),
            imagePath: null,
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
    expect(summaries).toEqual(expect.arrayContaining(expectedSummaries));
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
      path: null,
      contents: null,
      keylogCharCount: 0,
      screenshotSummaryCharCount: 0,
      keylogs: [
        {
          appPath: null,
          chronoPath: null,
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
          summaryPath: null,
        },
        {
          date: new Date(2025, 7, 13, 12, 45),
          imagePath: null,
          summaryPath:
            "/files/screenshots/2025-08/2025-08-13/2025-08-13 12_45_00.json",
        },
      ],
    };
    vol.fromNestedJSON(filesystem, "/");
    const summaries = await getRecentSummaries();
    expect(summaries).toContainEqual(weeklySummary);
  });

  it("doesn't fail when directories are missing", async () => {
    const filesystem = {
      files: {},
    };
    vol.fromNestedJSON(filesystem, "/");
    const getRecentSummariesSpy = vi.fn(getRecentSummaries);
    await getRecentSummariesSpy();
    expect(getRecentSummariesSpy).toHaveResolved();
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
      (summary) =>
        summary.scope === SummaryScopeTypes.Day &&
        isSameDay(summary.date, new Date(2025, 7, 20)),
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
    const getRecentSummariesSpy = vi.fn(getRecentSummaries);
    await getRecentSummariesSpy();
    expect(getRecentSummariesSpy).toHaveResolved();
  });

  it("works on encrypted keylogs", async () => {
    await writeFile("/files/keylogs/2025-08/2025-08-20.log", "test data");

    const encryptedWeeklySummary: Summary = {
      date: new Date(2025, 7, 18),
      path: null,
      contents: null,
      keylogs: [
        {
          appPath: null,
          chronoPath: null,
          rawPath: "/files/keylogs/2025-08/2025-08-20.log",
          date: new Date(2025, 7, 20),
        },
      ],
      loading: false,
      scope: SummaryScopeTypes.Week,
      screenshots: [],
      keylogCharCount: 0,
      screenshotSummaryCharCount: 0,
    };

    const encryptedDailySummary: Summary = {
      date: new Date(2025, 7, 20),
      path: null,
      contents: null,
      keylogs: [
        {
          appPath: null,
          chronoPath: null,
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

    const summaries = await getRecentSummaries();
    expect(summaries).toEqual(
      expect.arrayContaining([encryptedWeeklySummary, encryptedDailySummary]),
    );
  });

  it("fills gaps with blank summaries", async () => {
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

    vol.fromNestedJSON(filesystem, "/");
    const summaries = await getRecentSummaries();
    const gapSummary = summaries.find(
      (s) =>
        isSameDay(s.date, new Date(2025, 7, 18)) &&
        s.scope === SummaryScopeTypes.Day,
    );
    expect(gapSummary).toBeDefined();
  });
});
