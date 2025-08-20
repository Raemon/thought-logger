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
      whenReady: () => Promise.reject(),
    },
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

    mockFetch.mockResolvedValue(JSON.stringify(mockResponse));

    const summary: Summary = {
      date: new Date(),
      keylogs: [],
      loading: false,
      path: "/",
      scope: SummaryScopeTypes.Day,
      screenshots: [],
      contents: null,
    };

    await summarize(summary);
    expect(summary.contents).toBe("This is a daily summary.");
  });
});
