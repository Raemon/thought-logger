import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { vol, fs } from "memfs";

import { OpenRouterResponse, summarize } from "../../src/electron/summarizer";
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

vi.mock(import("../../src/preferences"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadPreferences: () =>
      Promise.resolve({
        dailySummaryPrompt: testDailyPrompt,
        summaryModel: testModel,
        weeklySummaryPrompt: testWeeklyPrompt,
      } as Preferences),
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
});
