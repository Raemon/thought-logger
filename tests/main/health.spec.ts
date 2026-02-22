import { beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import http from "node:http";

import type { SqlLogitem } from "../../src/electron/sqlKeylogTypes";
import {
  buildMinuteSlotsPastWeek,
  extractKeylogAppSwitchMinuteSet,
  minuteBucketFromTimestampMs,
  renderHealthHtml,
  scanScreenshotSummaryMinuteSet,
  sqlLogitemsToMinuteSet,
} from "../../src/electron/health";
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

vi.mock("node:fs");
vi.mock("node:fs/promises");

beforeEach(() => {
  vol.reset();
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

describe("/health helpers", () => {
  it("buildMinuteSlotsPastWeek returns 10080 minute buckets (newest-first)", () => {
    const nowTimestampMs = new Date(2025, 7, 21, 12, 0, 0).getTime();
    const slots = buildMinuteSlotsPastWeek(nowTimestampMs);
    expect(slots.length).toBe(7 * 24 * 60);
    expect(slots[0]).toBe(minuteBucketFromTimestampMs(nowTimestampMs));
    expect(slots[1]).toBe(minuteBucketFromTimestampMs(nowTimestampMs) - 1);
  });

  it("extractKeylogAppSwitchMinuteSet buckets app-switch timestamps by minute", () => {
    const nowTimestampMs = new Date(2025, 7, 21, 12, 0, 0).getTime();
    const sinceTimestampMs = nowTimestampMs - 7 * 24 * 60 * 60 * 1000;
    const rawText =
      "\n2025-08-21 10.31.15: Chrome\nabc\n\n2025-08-21 10.32.05: Terminal\n";
    const minutes = extractKeylogAppSwitchMinuteSet(rawText, sinceTimestampMs, nowTimestampMs);
    const bucketA = minuteBucketFromTimestampMs(new Date(2025, 7, 21, 10, 31, 15).getTime());
    const bucketB = minuteBucketFromTimestampMs(new Date(2025, 7, 21, 10, 32, 5).getTime());
    expect(minutes.has(bucketA)).toBe(true);
    expect(minutes.has(bucketB)).toBe(true);
  });

  it("scanScreenshotSummaryMinuteSet finds .json and .json.crypt summary files", async () => {
    const nowTimestampMs = new Date(2025, 7, 21, 12, 0, 0).getTime();
    const sinceTimestampMs = nowTimestampMs - 7 * 24 * 60 * 60 * 1000;

    const filesystem = {
      files: {
        screenshots: {
          "2025-08": {
            "2025-08-21": {
              "2025-08-21 10_30_00.project.document.json": "",
              "2025-08-21 10_31_00.json.crypt": "",
              "2025-08-21 10_32_00.jpg": "",
            },
          },
        },
      },
    };
    vol.fromNestedJSON(filesystem, "/");

    const minutes = await scanScreenshotSummaryMinuteSet({
      userDataPath: "/",
      sinceTimestampMs,
      nowTimestampMs,
    });
    const bucketA = minuteBucketFromTimestampMs(new Date(2025, 7, 21, 10, 30, 0).getTime());
    const bucketB = minuteBucketFromTimestampMs(new Date(2025, 7, 21, 10, 31, 0).getTime());
    expect(minutes.has(bucketA)).toBe(true);
    expect(minutes.has(bucketB)).toBe(true);
  });

  it("sqlLogitemsToMinuteSet buckets SQL logitems by minute", () => {
    const nowTimestampMs = new Date(2025, 7, 21, 12, 0, 0).getTime();
    const sinceTimestampMs = nowTimestampMs - 7 * 24 * 60 * 60 * 1000;

    const logitems: SqlLogitem[] = [
      { timestamp: nowTimestampMs - 1000, applicationName: "A", windowTitle: "W", keylogs: "x" },
      { timestamp: nowTimestampMs - 90 * 1000, applicationName: "B", windowTitle: "W", keylogs: "y" },
    ];
    const minutes = sqlLogitemsToMinuteSet(logitems, sinceTimestampMs, nowTimestampMs);
    expect(minutes.size).toBe(2);
  });

  it("renderHealthHtml renders one row per minute slot", () => {
    const nowTimestampMs = new Date(2025, 7, 21, 12, 0, 0).getTime();
    const minuteSlots = buildMinuteSlotsPastWeek(nowTimestampMs);
    const html = renderHealthHtml({
      minuteSlots,
      keylogRawMinutes: new Set(),
      keylogProcessedMinutes: new Set(),
      screenshotSummaryMinutes: new Set(),
      sqlMinutes: new Set(),
    });
    const rowCount = html.split('class="healthRow"').length - 1;
    expect(rowCount).toBe(7 * 24 * 60);
  });

  it("/health returns HTML and / index lists /health", async () => {
    const server = startLocalServer(0);
    await new Promise((resolve) => server.on("listening", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") {
      server.close();
      throw new Error("Invalid server address");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const indexResp = await httpGet(`${baseUrl}/`);
    const healthResp = await httpGet(`${baseUrl}/health`);
    server.close();

    expect(indexResp.statusCode).toBe(200);
    expect(indexResp.body).toContain('href="/health"');
    expect(healthResp.statusCode).toBe(200);
    expect(healthResp.body).toContain("<title>/health</title>");
  });
});
