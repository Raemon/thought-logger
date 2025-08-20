import path from "path";
import fs from "node:fs/promises";
import { format, parse, setDefaultOptions } from "date-fns";
import { app } from "electron";
import {
  Keylog,
  Screenshot,
  Summary,
  SummaryScopeTypes,
} from "../types/files.d";

setDefaultOptions({ weekStartsOn: 1 });

export async function getRecentSummaries(): Promise<Summary[]> {
  const userDataPath = app.getPath("userData");
  const keylogsPath = path.join(userDataPath, "files", "keylogs");
  const screenshotsPath = path.join(userDataPath, "files", "screenshots");

  const summaries: Record<string, Summary> = {};
  const keylogs: Record<string, Keylog> = {};
  const screenshots: Record<string, Record<string, Screenshot>> = {};

  const keylogFiles = await fs
    .readdir(keylogsPath, {
      recursive: true,
      withFileTypes: true,
    })
    .then((files) => files.filter((file) => file.isFile()));

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

  const screenshotFiles = await fs
    .readdir(screenshotsPath, {
      recursive: true,
      withFileTypes: true,
    })
    .then((files) => files.filter((file) => file.isFile()));

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
    summaries[dateString] = summaries[dateString] || {
      contents: "",
      date: parse(dateString, "yyyy-MM-dd", new Date()),
      keylogs: availableKeylogs,
      screenshots: availableScreenshots,
      loading: false,
      scope: SummaryScopeTypes.Day,
    };
  }

  return Object.values(summaries);
}
