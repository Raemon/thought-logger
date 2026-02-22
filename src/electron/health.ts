import fs from "node:fs/promises";
import path from "node:path";

const MINUTE_MS = 60 * 1000;
const WEEK_MINUTES = 7 * 24 * 60;
const PT_TIME_ZONE = "America/Los_Angeles";

export function minuteBucketFromTimestampMs(timestampMs: number): number {
  return Math.floor(timestampMs / MINUTE_MS);
}

export function buildMinuteSlotsPastWeek(nowTimestampMs: number): number[] {
  const slots: number[] = [];
  const endBucket = minuteBucketFromTimestampMs(nowTimestampMs);
  for (let i = 0; i < WEEK_MINUTES; i++) {
    slots.push(endBucket - i);
  }
  return slots;
}

export function formatMinutePt(minuteBucket: number): string {
  const date = new Date(minuteBucket * MINUTE_MS);
  const dateStr = date.toLocaleDateString("en-CA", { timeZone: PT_TIME_ZONE });
  const timeStr = date.toLocaleTimeString("en-US", {
    timeZone: PT_TIME_ZONE,
    hour12: true,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateStr} ${timeStr}`;
}

function formatDatePt(minuteBucket: number): string {
  const date = new Date(minuteBucket * MINUTE_MS);
  return date.toLocaleDateString("en-CA", { timeZone: PT_TIME_ZONE });
}

function parseLocalTimestampMsFromKeylogLineParts({
  yyyyMmDd,
  hh,
  mm,
  ss,
}: {
  yyyyMmDd: string;
  hh: string;
  mm: string;
  ss: string;
}): number | null {
  const parts = yyyyMmDd.split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const hour = Number(hh);
  const minute = Number(mm);
  const second = Number(ss);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return null;
  }
  return new Date(year, month - 1, day, hour, minute, second).getTime();
}

export function extractKeylogAppSwitchMinuteSet(
  rawKeylogText: string,
  sinceTimestampMs: number,
  nowTimestampMs: number,
): Set<number> {
  const minutes = new Set<number>();
  const appSwitchRegex =
    /^(\d{4}-\d{2}-\d{2})\s+(\d{2})\.(\d{2})\.(\d{2}):\s+.*$/gm;
  let match: RegExpExecArray | null;
  while ((match = appSwitchRegex.exec(rawKeylogText))) {
    const timestampMs = parseLocalTimestampMsFromKeylogLineParts({
      yyyyMmDd: match[1],
      hh: match[2],
      mm: match[3],
      ss: match[4],
    });
    if (timestampMs === null) continue;
    if (timestampMs < sinceTimestampMs || timestampMs > nowTimestampMs) continue;
    minutes.add(minuteBucketFromTimestampMs(timestampMs));
  }
  return minutes;
}

function parseLocalTimestampMsFromScreenshotSummaryFilename(
  fileName: string,
): number | null {
  const match = fileName.match(
    /^(\d{4}-\d{2}-\d{2})\s+(\d{2})_(\d{2})_(\d{2})/,
  );
  if (!match) return null;
  return parseLocalTimestampMsFromKeylogLineParts({
    yyyyMmDd: match[1],
    hh: match[2],
    mm: match[3],
    ss: match[4],
  });
}

export async function scanScreenshotSummaryMinuteSet({
  userDataPath,
  sinceTimestampMs,
  nowTimestampMs,
}: {
  userDataPath: string;
  sinceTimestampMs: number;
  nowTimestampMs: number;
}): Promise<Set<number>> {
  const minutes = new Set<number>();
  const dayDates: Date[] = [];
  const startDate = new Date(sinceTimestampMs);
  const endDate = new Date(nowTimestampMs);
  for (let i = 0; i < 7; i++) {
    const date = new Date(endDate.getTime());
    date.setDate(endDate.getDate() - i);
    if (date.getTime() < startDate.getTime() - 24 * 60 * 60 * 1000) continue;
    dayDates.push(date);
  }

  for (const dayDate of dayDates) {
    const year = dayDate.getFullYear();
    const month = String(dayDate.getMonth() + 1).padStart(2, "0");
    const folderName = `${year}-${month}`;
    const dateStr = dayDate.toLocaleDateString("en-CA");
    const dayFolderPath = path.join(
      userDataPath,
      "files",
      "screenshots",
      folderName,
      dateStr,
    );

    let entries: string[];
    try {
      entries = await fs.readdir(dayFolderPath);
    } catch {
      continue;
    }

    for (const entryName of entries) {
      const isJson =
        entryName.endsWith(".json") || entryName.endsWith(".json.crypt");
      if (!isJson) continue;
      const timestampMs =
        parseLocalTimestampMsFromScreenshotSummaryFilename(entryName);
      if (timestampMs === null) continue;
      if (timestampMs < sinceTimestampMs || timestampMs > nowTimestampMs) continue;
      minutes.add(minuteBucketFromTimestampMs(timestampMs));
    }
  }

  return minutes;
}

export function renderHealthHtml({
  minuteSlots,
  keylogRawMinutes,
  keylogProcessedMinutes,
  screenshotSummaryMinutes,
}: {
  minuteSlots: number[];
  keylogRawMinutes: Set<number>;
  keylogProcessedMinutes: Set<number>;
  screenshotSummaryMinutes: Set<number>;
}): string {
  let rows = "";
  let lastDateTitle = "";
  for (const minuteBucket of minuteSlots) {
    const dateTitle = formatDatePt(minuteBucket);
    if (dateTitle !== lastDateTitle) {
      if (lastDateTitle) {
        rows += `<div style="height:8px"></div>`;
      }
      rows +=
        `<div style="display:flex;flex-direction:row;align-items:flex-end;gap:4px;height:16px">` +
        `<div style="font-size:14px;line-height:16px;width:88px;white-space:nowrap;overflow:hidden">` +
        `${dateTitle}` +
        `</div>` +
        `<div style="height:16px;width:25vw"></div>` +
        `<div style="height:16px;width:25vw"></div>` +
        `<div style="height:16px;width:25vw"></div>` +
        `</div>`;
      lastDateTitle = dateTitle;
    }
    const timestamp = formatMinutePt(minuteBucket);
    const keylogsRawColor = keylogRawMinutes.has(minuteBucket) ? "green" : "black";
    const keylogsProcessedColor = keylogProcessedMinutes.has(minuteBucket) ? "green" : "black";
    const screenshotsColor = screenshotSummaryMinutes.has(minuteBucket) ? "green" : "black";
    rows +=
      `<div class="healthRow">` +
      `<div class="healthRowTooltip">${timestamp}</div>` +
      `<div style="height:1px;width:88px"></div>` +
      `<div style="height:1px;width:25vw;background:${keylogsRawColor}"></div>` +
      `<div style="height:1px;width:25vw;background:${keylogsProcessedColor}"></div>` +
      `<div style="height:1px;width:25vw;background:${screenshotsColor}"></div>` +
      `</div>`;
  }

  return (
    `<!doctype html>` +
    `<html>` +
    `<head>` +
    `<meta charset="utf-8" />` +
    `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
    `<title>/health</title>` +
    `<style>` +
    `.healthRow{display:flex;flex-direction:row;align-items:center;gap:4px;height:1px;position:relative;overflow:visible}` +
    `.healthRow:hover{filter:brightness(1.6)}` +
    `.healthRowTooltip{display:none;position:absolute;left:0;top:-12px;font-size:12px;line-height:12px;background:white;color:black;padding:0 2px;white-space:nowrap}` +
    `.healthRow:hover .healthRowTooltip{display:block}` +
    `</style>` +
    `</head>` +
    `<body style="margin:0;font-family:monospace">` +
    `<div style="display:flex;flex-direction:row;gap:4px;position:sticky;top:0;background:white">` +
    `<div style="font-size:10px;width:88px">timestamp</div>` +
    `<div style="font-size:10px;width:25vw">keylogs_raw</div>` +
    `<div style="font-size:10px;width:25vw">keylogs_processed</div>` +
    `<div style="font-size:10px;width:25vw">screenshots</div>` +
    `</div>` +
    rows +
    `</body>` +
    `</html>`
  );
}
