import { app } from "electron";
import path from "node:path";

const userDataPath = app.getPath("userData");

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
