import path from "path";

import { describe, expect, it, vi } from "vitest";

import { OpenRouterResponse, summarize } from "../../src/electron/summarizer";
import { Summary, SummaryScopeTypes } from "../../src/types/files.d";

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
});
