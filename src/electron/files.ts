import path from "path";
import fs from "node:fs/promises";
import {
  differenceInHours,
  differenceInSeconds,
  format,
  parse,
  setDefaultOptions,
  startOfWeek,
} from "date-fns";
import { app } from "electron";
import {
  Keylog,
  Screenshot,
  Summary,
  SummaryScopeTypes,
} from "../types/files.d";
import { Dirent } from "node:fs";
import logger from "../logging";

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
    logger.error(`Couldn't access ${path}: ${error}`);
    return [];
  }

  return fs
    .readdir(path, {
      recursive: true,
      withFileTypes: true,
    })
    .then((files) => files.filter((file) => file.isFile()));
}

export async function maybeReadContents(path: string): Promise<string | null> {
  try {
    await fs.access(path);
  } catch (error) {
    logger.info(`No file at ${path}.`);
    return null;
  }

  return fs.readFile(path, { encoding: "utf-8" });
}

async function getKeylogs(): Promise<Record<string, Keylog>> {
  const keylogsPath = path.join(userDataPath, "files", "keylogs");
  const keylogs: Record<string, Keylog> = {};
  const keylogFiles = await readFilesFromDirectory(keylogsPath);

  for (let file of keylogFiles) {
    const fileName = path.basename(file.name);
    const dir = file.parentPath;
    const result = fileName.match(/[^.]+/);
    const dateString = result[0];
    let date = parse(dateString, "yyyy-MM-dd", new Date());
    if (isNaN(date.getTime())) continue;

    keylogs[dateString] = keylogs[dateString] || {
      appPath: path.join(dir, dateString + ".processed.by-app.log"),
      chronoPath: path.join(dir, dateString + ".processed.chronological.log"),
      rawPath: path.join(dir, dateString + ".log"),
      date,
    };
  }
  return keylogs;
}

async function getScreenshots(): Promise<
  Record<string, Record<string, Screenshot>>
> {
  const screenshotsPath = path.join(userDataPath, "files", "screenshots");
  const screenshots: Record<string, Record<string, Screenshot>> = {};

  const files = await readFilesFromDirectory(screenshotsPath);

  for (let file of files) {
    const fileName = path.basename(file.name);
    const dir = file.parentPath;
    const ext = path.extname(file.name);
    const result = fileName.match(/[^.]+/);
    const dateString = result[0];
    let date = parse(dateString, "yyyy-MM-dd HH_mm_ss", new Date());
    if (isNaN(date.getTime())) continue;
    const dayString = format(date, "yyyy-MM-dd");

    screenshots[dayString] = screenshots[dayString] || {};
    const screenshot = screenshots[dayString][dateString] || {
      imagePath: path.join(dir, dateString + ".jpg"),
      summaryPath: path.join(dir, dateString + ".txt"),
      date,
    };
    if (ext === ".jpg") {
      screenshot.imagePath = path.join(file.parentPath, file.name);
    } else if (ext === ".txt") {
      screenshot.summaryPath = path.join(file.parentPath, file.name);
    }

    screenshots[dayString][dateString] = screenshot;
  }

  return screenshots;
}

const TWO_WEEKS_IN_SECONDS = 60 * 60 * 24 * 7;

export async function getRecentSummaries(
  ageInSeconds: number = TWO_WEEKS_IN_SECONDS,
): Promise<Summary[]> {
  const now = new Date();
  const dailySummaries: Record<string, Summary> = {};
  const keylogs: Record<string, Keylog> = await getKeylogs();
  const screenshots: Record<
    string,
    Record<string, Screenshot>
  > = await getScreenshots();

  const dateStrings = Array.from(
    new Set(Object.keys(keylogs).concat(Object.keys(screenshots))),
  );

  for (let dateString of dateStrings) {
    const date = parse(dateString, "yyyy-MM-dd", new Date());

    if (differenceInSeconds(now, date) >= ageInSeconds) {
      continue;
    }

    const availableKeylogs = keylogs[dateString]
      ? [keylogs[dateString]]
      : ([] as Keylog[]);
    const availableScreenshots = screenshots[dateString]
      ? Object.values(screenshots[dateString])
      : ([] as Screenshot[]);
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

  const weeks: string[] = weeklyKeylogs
    .keys()
    .toArray()
    .concat(weeklyScreenshots.keys().toArray());

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

export async function getRecentApps(): Promise<string[]> {
  let apps = new Set<string>();
  const now = new Date();

  const keylogs = await getKeylogs()
    .then((keylogs) => Object.values(keylogs))
    .then((keylogs) =>
      keylogs.filter((keylog) => differenceInHours(now, keylog.date) <= 24),
    );

  for (let keylog of keylogs) {
    const content = await fs.readFile(keylog.appPath);
    const appRegex = /=== (.*) ===/g;
    const matches = content.toLocaleString().matchAll(appRegex);
    matches.forEach((m) => apps.add(m[1]));
  }

  return Array.from(apps);
}
