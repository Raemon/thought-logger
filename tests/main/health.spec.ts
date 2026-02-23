import { beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import http from "node:http";

import {
  buildMinuteSlotsPastWeek,
  formatMinutePt,
  minuteBucketFromTimestampMs,
  renderHealthHtml,
} from "../../src/electron/health";
import { startLocalServer } from "../../src/electron/server";

vi.mock("../../src/electron/logeventsDb", () => {
  return {
    getLogEventsSince: () => Promise.resolve([]),
  };
});

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

  it("renderHealthHtml renders one row per minute slot", () => {
    const nowTimestampMs = new Date(2025, 7, 21, 12, 0, 0).getTime();
    const minuteSlots = buildMinuteSlotsPastWeek(nowTimestampMs);
    const html = renderHealthHtml({
      minuteSlots,
      keylogMinutes: new Set(),
      screenshotMinutes: new Set(),
    });
    const rowCount = html.split('class="healthRow"').length - 1;
    expect(rowCount).toBe(7 * 24 * 60);
    expect(html).not.toContain(">sql<");
  });

  it("formatMinutePt uses AM/PM time for hover tooltip", () => {
    const timestampMs = Date.UTC(2025, 7, 21, 20, 5, 0); // 2025-08-21 1:05 PM in PT (DST)
    const minuteBucket = minuteBucketFromTimestampMs(timestampMs);
    expect(formatMinutePt(minuteBucket)).toBe("2025-08-21 1:05 PM");
  });

  it("/health returns HTML and / index lists /health (but not /sql)", async () => {
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
    expect(indexResp.body).not.toContain('href="/sql"');
    expect(healthResp.statusCode).toBe(200);
    expect(healthResp.body).toContain("<title>/health</title>");
    expect(healthResp.body).not.toContain(">sql<");
  });
});
