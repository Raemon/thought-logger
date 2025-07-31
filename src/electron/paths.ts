import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

const userDataPath = app.getPath("userData");

/**
 * Get path to current key log file.
 * E.g. [userDataPath]/files/keys/2025 January/2025-01-12.log
 */
export function currentKeyLogFile(): string {
  const now = new Date();
  const year = now.getFullYear();
  
  // Format folder as YYYY-MM
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const folderName = `${year}-${month}`;

  // Format date as YYYY-MM-DD
  const dateStr = now.toLocaleDateString('en-CA');

  // Construct path
  const folderPath = path.join(
    userDataPath,
    "files",
    "keylogs",
    folderName,
  );

  return path.join(folderPath, `${dateStr}.log`);
}

/**
 * Get path to current screenshot file.
 * E.g. [userDataPath]/files/screenshots/2025-01/2025-01-12 16.23.43.jpg
 */
export function currentScreenshotFile(): string {
  const now = new Date();
  const year = now.getFullYear();

  // Format folder as YYYY-MM
  const month = String(now.getMonth() + 1).padStart(2, '0');
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

  return path.join(folderPath, `${dateStr} ${timeStr}.jpg`);
}

/**
 * Append `content` to the end of `filePath`, creating any parent
 * directories if necessary.
 */
export async function appendFile(
  filePath: string,
  content: string,
  overwrite = false
): Promise<void> {
  try {
    await fs[overwrite ? 'writeFile' : 'appendFile'](filePath, content);
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") {
      const fileDir = path.dirname(filePath);
      await fs.mkdir(fileDir, { recursive: true });
      await fs[overwrite ? 'writeFile' : 'appendFile'](filePath, content);
    } else {
      throw err;
    }
  }
}

/**
 * Get path to current processed key log file.
 * E.g. [userDataPath]/files/keys/2025-01/2025-01-12.processed.log
 */
export function currentProcessedKeyLogFile(suffix: string): string {
  const rawPath = currentKeyLogFile();
  const dir = path.dirname(rawPath);
  const basename = path.basename(rawPath, 'log');
  return path.join(dir, `${basename}${suffix}log`);
}
