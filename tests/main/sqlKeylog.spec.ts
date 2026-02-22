import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import http from "node:http";

import { SqlKeylogRepository } from "../../src/electron/sqlKeylogRepository";
import { __setSqlKeylogRepositoryForTesting, renderSqlLogitemsProcessed } from "../../src/electron/sqlKeylogPipeline";
import { startLocalServer } from "../../src/electron/server";

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

async function httpGet(url: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ statusCode: res.statusCode || 0, body: data }));
    }).on("error", reject);
  });
}

describe("SQL keylog pipeline", () => {
  let repo: SqlKeylogRepository;

  beforeEach(async () => {
    repo = await SqlKeylogRepository.initialize(null);
    __setSqlKeylogRepositoryForTesting(repo);
  });

  afterEach(() => {
    __setSqlKeylogRepositoryForTesting(null);
    repo.close();
    vi.resetAllMocks();
  });

  it("rotates logitems by minute and window/app changes", () => {
    repo.appendKeystrokeToCurrentLogitem({
      nowTimestampMs: 1000,
      applicationName: "Chrome",
      windowTitle: "A",
      keystroke: "a",
    });

    repo.appendKeystrokeToCurrentLogitem({
      nowTimestampMs: 2000,
      applicationName: "Chrome",
      windowTitle: "A",
      keystroke: "b",
    });

    repo.appendKeystrokeToCurrentLogitem({
      nowTimestampMs: 2001,
      applicationName: "Chrome",
      windowTitle: "B",
      keystroke: "c",
    });

    repo.appendKeystrokeToCurrentLogitem({
      nowTimestampMs: 62002,
      applicationName: "Chrome",
      windowTitle: "B",
      keystroke: "d",
    });

    const logitems = repo.getAllLogitems();
    expect(logitems.length).toBe(3);
    expect(logitems[2].keylogs).toBe("ab");
    expect(logitems[1].keylogs).toBe("c");
    expect(logitems[0].keylogs).toBe("d");
  });

  it("renders processed view with window title in header", () => {
    repo.appendKeystrokeToCurrentLogitem({
      nowTimestampMs: 1000,
      applicationName: "Chrome",
      windowTitle: "Doc",
      keystroke: "a",
    });
    repo.appendKeystrokeToCurrentLogitem({
      nowTimestampMs: 1001,
      applicationName: "Chrome",
      windowTitle: "Doc",
      keystroke: "b⌫c⏎",
    });

    const logitems = repo.getAllLogitems();
    const text = renderSqlLogitemsProcessed(logitems);
    expect(text).toContain(": Chrome: Doc");
    expect(text).toContain("ac\n");
  });

  it("/sql/raw returns last-24h logitems as JSON", async () => {
    const now = Date.now();
    const twentyFiveHoursMs = 25 * 60 * 60 * 1000;
    const oldTimestamp = now - twentyFiveHoursMs;

    repo.appendKeystrokeToCurrentLogitem({
      nowTimestampMs: oldTimestamp,
      applicationName: "Chrome",
      windowTitle: "Old",
      keystroke: "old",
    });

    repo.appendKeystrokeToCurrentLogitem({
      nowTimestampMs: now,
      applicationName: "Chrome",
      windowTitle: "New",
      keystroke: "new",
    });

    const server = startLocalServer(0);
    await new Promise((resolve) => server.on("listening", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") {
      server.close();
      throw new Error("Invalid server address");
    }

    const url = `http://127.0.0.1:${address.port}/sql/raw`;
    const { statusCode, body } = await httpGet(url);
    server.close();

    expect(statusCode).toBe(200);
    const parsed = JSON.parse(body) as Array<{ windowTitle: string }>;
    const windowTitles = parsed.map((p) => p.windowTitle);
    expect(windowTitles).toEqual(["New"]);
  });
});

