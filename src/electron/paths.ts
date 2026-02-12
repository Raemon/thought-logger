import { app } from "electron";
import path from "node:path";
import { Summary, SummaryScopeTypes } from "../types/files.d";
import { format } from "date-fns";

const userDataPath = app.getPath("userData");

/**
 * Get path to current key log file.
 * E.g. [userDataPath]/files/keys/2025 January/2025-01-12.log
 */
export function currentKeyLogFile(): string {
  const now = new Date();
  const year = now.getFullYear();

  // Format folder as YYYY-MM
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const folderName = `${year}-${month}`;

  // Format date as YYYY-MM-DD
  const dateStr = now.toLocaleDateString("en-CA");

  // Construct path
  const folderPath = path.join(userDataPath, "files", "keylogs", folderName);

  return path.join(folderPath, `${dateStr}.log`);
}

/**
 * Get path to current screenshot file.
 * E.g. [userDataPath]/files/screenshots/2025-01/2025-01-12 16.23.43.jpg
 */
export function currentScreenshotFile(display?: string): string {
  const now = new Date();
  const year = now.getFullYear();

  // Format folder as YYYY-MM
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const folderName = `${year}-${month}`;

  // Format date as YYYY-MM-DD 🇨🇦
  const dateStr = now.toLocaleDateString("en-CA");
  const timeStr = now
    .toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    .replace(/:/g, "_");

  // Construct path
  const folderPath = path.join(
    userDataPath,
    "files",
    "screenshots",
    folderName,
    dateStr,
  );

  return path.join(
    folderPath,
    display
      ? `${dateStr} ${timeStr}.${display}.jpg`
      : `${dateStr} ${timeStr}.jpg`,
  );
}

/**
 * Get path to current processed key log file.
 * E.g. [userDataPath]/files/keys/2025-01/2025-01-12.processed.log
 */
export function currentProcessedKeyLogFile(suffix: string): string {
  const rawPath = currentKeyLogFile();
  const dir = path.dirname(rawPath);
  const basename = path.basename(rawPath, "log");
  return path.join(dir, `${basename}${suffix}log`);
}

export function getSummaryPath(summary: Summary): string {
  const dateString = format(summary.date, "yyyy-MM-dd");
  const weekString = format(summary.date, "YYYY-'W'ww", {
    useAdditionalWeekYearTokens: true,
  });
  const monthString = format(summary.date, "yyyy-MM");
  const fileName =
    summary.scope === SummaryScopeTypes.Week
      ? `${weekString}.aisummary.log`
      : `${dateString}.aisummary.log`;
  return summary.scope === SummaryScopeTypes.Week
    ? path.join(userDataPath, "files", fileName)
    : path.join(userDataPath, "files", "keylogs", monthString, fileName);
}
