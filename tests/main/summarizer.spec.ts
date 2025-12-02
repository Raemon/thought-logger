import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { vol, fs } from "memfs";

import {
  needsSummary,
  OpenRouterResponse,
  summarize,
} from "../../src/electron/summarizer";
import { Summary, SummaryScopeTypes } from "../../src/types/files.d";
import { Preferences } from "src/types/preferences";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

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
      whenReady: () => Promise.resolve(),
    },
  };
});

vi.mock(import("../../src/electron/credentials"), () => {
  return {
    getApiKey: () => Promise.resolve("password"),
  };
});

vi.mock("node:fs");
vi.mock("node:fs/promises");

beforeEach(() => {
  vol.reset();
});

afterEach(() => {
  vi.resetAllMocks();
});

const testModel = "test/test-model";
const testWeeklyPrompt = "Test weekly summary prompt";
const testDailyPrompt = "Test daily summary prompt";

vi.mock(import("../../src/preferences"), (importOriginal) => {
  const actual = importOriginal();
  return {
    ...actual,
    loadPreferences: () => ({
      dailySummaryPrompt: testDailyPrompt,
      summaryModel: testModel,
      weeklySummaryPrompt: testWeeklyPrompt,
      screenshotSummaryWindow: 5,
    }),
  };
});

describe("#summarize", () => {
  it("updates the summary in memory", async () => {
    const mockResponse: OpenRouterResponse = {
      choices: [
        {
          message: {
            content: "This is a daily summary.",
          },
        },
      ],
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const summary: Summary = {
      date: new Date(),
      keylogs: [],
      loading: false,
      path: "/2028-08-20.aisummary.log",
      scope: SummaryScopeTypes.Day,
      screenshots: [],
      contents: null,
    };

    await summarize(summary);
    expect(summary.contents).toBe("This is a daily summary.");
  });

  it("updates the summary on disk", async () => {
    const mockResponse: OpenRouterResponse = {
      choices: [
        {
          message: {
            content: "This is a daily summary.",
          },
        },
      ],
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const summary: Summary = {
      date: new Date(),
      keylogs: [],
      loading: false,
      path: "/2028-08-20.aisummary.log",
      scope: SummaryScopeTypes.Day,
      screenshots: [],
      contents: null,
    };

    await summarize(summary);
    const text = fs.readFileSync(summary.path, { encoding: "utf-8" });
    expect(text).toBe("This is a daily summary.");
  });

  it("calls the API with the right prompt for summary daily scope", async () => {
    const mockResponse: OpenRouterResponse = {
      choices: [
        {
          message: {
            content: "This is a daily summary.",
          },
        },
      ],
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const filesystem = {
      "/2025-08-20.log": "This is keylog data.",
    };
    vol.fromJSON(filesystem);

    const summary: Summary = {
      date: new Date(),
      keylogs: [
        {
          appPath: "/2025-08-20.by-app.log",
          chronoPath: "/2025-08-20.chronological.log",
          date: new Date(),
          rawPath: "/2025-08-20.log",
        },
      ],
      loading: false,
      path: "/2028-08-20.aisummary.log",
      scope: SummaryScopeTypes.Day,
      screenshots: [],
      contents: null,
    };

    await summarize(summary);
    expect(mockFetch).toHaveBeenCalledExactlyOnceWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        body: expect.stringContaining(testDailyPrompt),
      }),
    );
  });

  it("calls the API with the right prompt for summary weekly scope", async () => {
    const mockResponse: OpenRouterResponse = {
      choices: [
        {
          message: {
            content: "This is a weekly summary.",
          },
        },
      ],
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const filesystem = {
      "/2025-08-13.log": "This is keylog data.",
    };
    vol.fromJSON(filesystem);

    const summary: Summary = {
      date: new Date(),
      keylogs: [
        {
          appPath: "/2025-08-13.by-app.log",
          chronoPath: "/2025-08-13.chronological.log",
          date: new Date(),
          rawPath: "/2025-08-13.log",
        },
      ],
      loading: false,
      path: "/2028-08-10.aisummary.log",
      scope: SummaryScopeTypes.Week,
      screenshots: [],
      contents: null,
    };

    await summarize(summary);
    expect(mockFetch).toHaveBeenCalledExactlyOnceWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        body: expect.stringContaining(testWeeklyPrompt),
      }),
    );
  });

  it("doesn't regenerate existing summaries", async () => {
    const filesystem = {
      "/2028-08-20.aisummary.log": "This is a daily summary",
    };
    vol.fromJSON(filesystem);

    const summary: Summary = {
      date: new Date(2025, 7, 20),
      keylogs: [],
      loading: false,
      path: "/2028-08-20.aisummary.log",
      scope: SummaryScopeTypes.Day,
      screenshots: [],
      contents: null,
    };

    await expect(needsSummary(summary)).resolves.toBe(false);
  });

  it("doesn't generate a summary for today", async () => {
    const summary: Summary = {
      date: new Date(2025, 7, 21),
      keylogs: [],
      loading: false,
      path: "/2028-08-20.aisummary.log",
      scope: SummaryScopeTypes.Day,
      screenshots: [],
      contents: null,
    };

    await expect(needsSummary(summary)).resolves.toBe(false);
  });

  it("includes the user-specified number of words from screenshots", async () => {
    const mockResponse: OpenRouterResponse = {
      choices: [
        {
          message: {
            content: "This is a daily summary.",
          },
        },
      ],
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const filesystem = {
      files: {
        screenshots: {
          "2025-08": {
            "2025-08-20": {
              "2025-08-20 10_30_00.jpg": "",
              "2025-08-20 10_30_00.txt":
                "This is some included text. This is excluded text.",
              "2025-08-20 11_00_00.jpg": "",
              "2025-08-20 12_45_00.txt":
                "This is more text, included. You shouldn't include this text",
            },
          },
        },
      },
    };
    vol.fromNestedJSON(filesystem, "/");

    const summary: Summary = {
      date: new Date(),
      keylogs: [],
      loading: false,
      path: "/2028-08-20.aisummary.log",
      scope: SummaryScopeTypes.Day,
      screenshots: [
        {
          date: new Date(2025, 7, 20, 10, 30),
          imagePath:
            "/files/screenshots/2025-08/2025-08-20/2025-08-20 10_30_00.jpg",
          summaryPath:
            "/files/screenshots/2025-08/2025-08-20/2025-08-20 10_30_00.txt",
        },
        {
          date: new Date(2025, 7, 20, 12, 45),
          imagePath:
            "/files/screenshots/2025-08/2025-08-20/2025-08-20 12_45_00.jpg",
          summaryPath:
            "/files/screenshots/2025-08/2025-08-20/2025-08-20 12_45_00.txt",
        },
      ],
      contents: null,
    };

    await summarize(summary);
    expect(mockFetch).toHaveBeenCalledExactlyOnceWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        body: expect.stringContaining(
          "Screenshot Summaries:\\n" +
            "Taken on 2025-08-20 10_30_00:\\n" +
            "This is some included text.\\n\\n" +
            "Taken on 2025-08-20 12_45_00:\\n" +
            "This is more text, included.\\n\\n",
        ),
      }),
    );
  });
});
