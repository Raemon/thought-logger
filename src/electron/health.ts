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

export async function buildHealthPastWeekHtml({
  getLogEventsSince,
  nowTimestampMs = Date.now(),
}: {
  getLogEventsSince: (sinceMs: number) => Promise<Array<{ timestamp: number }>>;
  nowTimestampMs?: number;
}): Promise<string> {
  const sinceTimestampMs = nowTimestampMs - 7 * 24 * 60 * 60 * 1000;
  const minuteSlots = buildMinuteSlotsPastWeek(nowTimestampMs);
  const logeventsMinutes = new Set<number>();
  const events = await getLogEventsSince(sinceTimestampMs);
  for (const event of events) {
    logeventsMinutes.add(minuteBucketFromTimestampMs(event.timestamp));
  }
  return renderHealthHtml({
    minuteSlots,
    logeventsMinutes,
  });
}

export function renderHealthHtml({
  minuteSlots,
  logeventsMinutes = new Set(),
}: {
  minuteSlots: number[];
  logeventsMinutes?: Set<number>;
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
        `<div style="height:16px;width:80vw"></div>` +
        `</div>`;
      lastDateTitle = dateTitle;
    }
    const timestamp = formatMinutePt(minuteBucket);
    const logeventsColor = logeventsMinutes.has(minuteBucket) ? "green" : "black";
    rows +=
      `<div class="healthRow">` +
      `<div class="healthRowTooltip">${timestamp}</div>` +
      `<div style="height:1px;width:88px"></div>` +
      `<div style="height:1px;width:80vw;background:${logeventsColor}"></div>` +
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
    `<div style="font-size:10px;width:80vw">logevents</div>` +
    `</div>` +
    rows +
    `</body>` +
    `</html>`
  );
}
