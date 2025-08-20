import { beforeEach, expect, it, vi } from "vitest";
import { vol } from "memfs";

import { getRecentSummaries } from "../../src/electron/files";
import { Summary, SummaryScopeTypes } from "../../src/types/files.d";

vi.mock("electron", () => {
  return {
    ipcMain: {
      handle: () => {},
      on: () => {},
    },
    app: {
      isPackaged: false,
      getPath: () => "/",
      getAppPath: () => "/",
      on: () => {},
      whenReady: () => Promise.reject(),
    },
  };
});

vi.mock("node:fs");
vi.mock("node:fs/promises");

beforeEach(() => {
  vol.reset();
});

it("runs correctly", async () => {
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
            "2025-08-20 10_30_00.txt": "",
            "2025-08-20 11_00_00.jpg": "",
            "2025-08-20 12_45_00.txt": "",
          },
          "2025-08-17": {
            "2025-08-17 10_30_00.jpg": "",
            "2025-08-17 10_30_00.txt": "",
            "2025-08-17 11_00_00.jpg": "",
            "2025-08-17 12_45_00.txt": "",
          },
        },
      },
    },
  };

  const expectedSummaries: Summary[] = [
    {
      contents: "",
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
    },
    {
      contents: "",
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
            "/files/screenshots/2025-08/2025-08-20/2025-08-20 10_30_00.txt",
        },
        {
          date: new Date(2025, 7, 20, 11),
          imagePath:
            "/files/screenshots/2025-08/2025-08-20/2025-08-20 11_00_00.jpg",
          summaryPath:
            "/files/screenshots/2025-08/2025-08-20/2025-08-20 11_00_00.txt",
        },
        {
          date: new Date(2025, 7, 20, 12, 45),
          imagePath:
            "/files/screenshots/2025-08/2025-08-20/2025-08-20 12_45_00.jpg",
          summaryPath:
            "/files/screenshots/2025-08/2025-08-20/2025-08-20 12_45_00.txt",
        },
      ],
      loading: false,
      scope: SummaryScopeTypes.Day,
    },
    {
      contents: "",
      date: new Date(2025, 7, 17),
      keylogs: [],
      screenshots: [
        {
          date: new Date(2025, 7, 17, 10, 30),
          imagePath:
            "/files/screenshots/2025-08/2025-08-17/2025-08-17 10_30_00.jpg",
          summaryPath:
            "/files/screenshots/2025-08/2025-08-17/2025-08-17 10_30_00.txt",
        },
        {
          date: new Date(2025, 7, 17, 11),
          imagePath:
            "/files/screenshots/2025-08/2025-08-17/2025-08-17 11_00_00.jpg",
          summaryPath:
            "/files/screenshots/2025-08/2025-08-17/2025-08-17 11_00_00.txt",
        },
        {
          date: new Date(2025, 7, 17, 12, 45),
          imagePath:
            "/files/screenshots/2025-08/2025-08-17/2025-08-17 12_45_00.jpg",
          summaryPath:
            "/files/screenshots/2025-08/2025-08-17/2025-08-17 12_45_00.txt",
        },
      ],
      loading: false,
      scope: SummaryScopeTypes.Day,
    },
  ];
  vol.fromNestedJSON(filesystem, "/");
  const summaries = await getRecentSummaries();
  expect(summaries).toStrictEqual(expectedSummaries);
});
