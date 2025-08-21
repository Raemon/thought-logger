import path from "path";
import fs from "node:fs/promises";
import { format, parse, setDefaultOptions, startOfWeek } from "date-fns";
import { app } from "electron";
import {
  Keylog,
  Screenshot,
  Summary,
  SummaryScopeTypes,
} from "../types/files.d";
import { Dirent } from "node:fs";
import log from "../logging";

setDefaultOptions({ weekStartsOn: 1 });

const userDataPath = app.getPath("userData");

function groupByWeek<T>(record: Record<string, T>): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (let dateString of Object.keys(record)) {
    const date = parse(dateString, "yyyy-MM-dd", new Date());
    const week = format(startOfWeek(date), "YYYY-'W'ww", {
      useAdditionalWeekYearTokens: true,
    });

    if (groups.has(week)) {
      const groupData = groups.get(week);
      groupData.push(record[dateString]);
    } else {
      groups.set(week, [record[dateString]]);
    }
  }

  return groups;
}

async function readFilesFromDirectory(path: string): Promise<Dirent[]> {
  try {
    await fs.access(path);
  } catch (error) {
    log.error(`Couldn't access ${path}: ${error}`);
    return [];
  }

  return fs
    .readdir(path, {
      recursive: true,
      withFileTypes: true,
    })
    .then((files) => files.filter((file) => file.isFile()));
}

async function maybeReadContents(path: string): Promise<string | null> {
  try {
    await fs.access(path);
  } catch (error) {
    log.info(`No file at ${path}.`);
    return null;
  }

  return fs.readFile(path, { encoding: "utf-8" });
}

export async function getRecentSummaries(): Promise<Summary[]> {
  const keylogsPath = path.join(userDataPath, "files", "keylogs");
  const screenshotsPath = path.join(userDataPath, "files", "screenshots");

  const dailySummaries: Record<string, Summary> = {};
  const keylogs: Record<string, Keylog> = {};
  const screenshots: Record<string, Record<string, Screenshot>> = {};

  const keylogFiles = await readFilesFromDirectory(keylogsPath);

  for (let file of keylogFiles) {
    const fileName = path.basename(file.name);
    const dir = file.parentPath;
    const result = fileName.match(/[^.]+/);
    const dateString = result[0];
    let date = parse(dateString, "yyyy-MM-dd", new Date());

    keylogs[dateString] = keylogs[dateString] || {
      appPath: path.join(dir, dateString + ".processed.by-app.log"),
      chronoPath: path.join(dir, dateString + ".processed.chronological.log"),
      rawPath: path.join(dir, dateString + ".log"),
      date,
    };
  }

  const screenshotFiles = await readFilesFromDirectory(screenshotsPath);

  for (let file of screenshotFiles) {
    const fileName = path.basename(file.name);
    const dir = file.parentPath;
    const result = fileName.match(/[^.]+/);
    const dateString = result[0];
    let date = parse(dateString, "yyyy-MM-dd HH_mm_ss", new Date());
    const dayString = format(date, "yyyy-MM-dd");

    screenshots[dayString] = screenshots[dayString] || {};
    screenshots[dayString][dateString] = {
      imagePath: path.join(dir, dateString + ".jpg"),
      summaryPath: path.join(dir, dateString + ".txt"),
      date,
    };
  }

  const dateStrings = Array.from(
    new Set(Object.keys(keylogs).concat(Object.keys(screenshots))),
  );

  for (let dateString of dateStrings) {
    const availableKeylogs = keylogs[dateString]
      ? [keylogs[dateString]]
      : ([] as Keylog[]);
    const availableScreenshots = screenshots[dateString]
      ? Object.values(screenshots[dateString])
      : ([] as Screenshot[]);

    const date = parse(dateString, "yyyy-MM-dd", new Date());
    const monthString = format(date, "yyyy-MM");

    const summaryPath = path.join(
      userDataPath,
      "files",
      "keylogs",
      monthString,
      `${dateString}.aisummary.log`,
    );

    const contents = await maybeReadContents(summaryPath);

    dailySummaries[dateString] = dailySummaries[dateString] || {
      path: summaryPath,
      contents,
      date,
      keylogs: availableKeylogs,
      screenshots: availableScreenshots,
      loading: false,
      scope: SummaryScopeTypes.Day,
    };
  }

  const weeklyKeylogs = groupByWeek(keylogs);
  const weeklyScreenshots = groupByWeek(screenshots);

  const weeks: string[] = Array.from(
    new Set(
      weeklyKeylogs.keys().toArray().concat(weeklyScreenshots.keys().toArray()),
    ),
  );

  const weeklySummaries: Summary[] = [];

  for (let week of weeks) {
    const date = parse(week, "YYYY-'W'ww", new Date(), {
      useAdditionalWeekYearTokens: true,
    });
    const summaryPath = path.join(
      userDataPath,
      "files",
      `${week}.aisummary.log`,
    );
    const contents = await maybeReadContents(summaryPath);

    weeklySummaries.push({
      path: summaryPath,
      contents,
      date,
      keylogs: weeklyKeylogs.get(week)
        ? weeklyKeylogs.get(week)
        : ([] as Keylog[]),
      loading: false,
      scope: SummaryScopeTypes.Week,
      screenshots: weeklyScreenshots.get(week)
        ? weeklyScreenshots
            .get(week)
            .reduce(
              (acc, screenshot) => acc.concat(Object.values(screenshot)),
              [],
            )
        : ([] as Screenshot[]),
    });
  }

  return weeklySummaries.concat(Object.values(dailySummaries));
}

const TWO_WEEKS_IN_SECONDS = 60 * 60 * 24 * 7;

async function walkDir(dir: string, allEntries: string[]) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(full, allEntries);
    } else {
      allEntries.push(full);
    }
  }
}

export async function recentFiles(
  ageInSeconds: number = TWO_WEEKS_IN_SECONDS,
): Promise<string[]> {
  const filesDir = path.join(userDataPath, "files");
  try {
    const allEntries: string[] = [];

    await walkDir(filesDir, allEntries);

    // Sort by modification time descending
    const datedPaths: { path: string; mtime: number }[] = [];
    for (const filePath of allEntries) {
      // Skip .DS_Store files
      if (path.basename(filePath) === ".DS_Store") continue;
      // Skip screenshots
      if (path.extname(filePath) === ".jpg") continue;

      const stat = await fs.stat(filePath);
      datedPaths.push({ path: filePath, mtime: stat.mtimeMs });
    }
    datedPaths.sort((a, b) => b.mtime - a.mtime);

    // Return a limited list, e.g. 20 items
    const nowMs = Date.now();
    return datedPaths
      .filter((x) => nowMs - x.mtime <= ageInSeconds * 1000)
      .map((x) => x.path);
  } catch (error) {
    log.error("Failed to list recent files:", error);
    return [];
  }
}
