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
    keylogs: {
      "2025-08": {
        "2025-08-20.log": "",
      },
    },
  };

  const expectedSummaries: Summary[] = [
    {
      contents: "",
      date: new Date(2025, 8, 20),
      keylogs: [
        {
          appPath: "/2025-08/2025-08-20.processed.by-app.log",
          chronoPath: "/2025-08/2025-08-20.processed.chronological.log",
          rawPath: "/2025-08/2025-08-20.log",
          date: new Date(2025, 8, 20),
        },
      ],
      screenshots: [],
      loading: false,
      scope: SummaryScopeTypes.Day,
    },
  ];
  vol.fromNestedJSON(filesystem);
  const summaries = await getRecentSummaries();
  expect(summaries).toStrictEqual(expectedSummaries);
});
