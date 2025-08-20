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
import log from "src/logging";

setDefaultOptions({ weekStartsOn: 1 });

function groupByWeek<T>(record: Record<string, T>): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (let dateString of Object.keys(record)) {
    const date = parse(dateString, "yyyy-MM-dd", new Date());
    const week = format(startOfWeek(date), "yyyy-MM-dd");

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

export async function getRecentSummaries(): Promise<Summary[]> {
  const userDataPath = app.getPath("userData");
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
    dailySummaries[dateString] = dailySummaries[dateString] || {
      contents: "",
      date: parse(dateString, "yyyy-MM-dd", new Date()),
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
    const date = parse(week, "yyyy-MM-dd", new Date());
    weeklySummaries.push({
      contents: "",
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
