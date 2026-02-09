import path from "path";
import fs from "node:fs/promises";
import sumBy from "lodash/sumBy";
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
import { isErrnoException } from "./utils";
import {
  decryptUserData,
  ENCRYPTED_FILE_EXT,
  encryptUserData,
} from "./encryption";

setDefaultOptions({ weekStartsOn: 1 });

const userDataPath = app.getPath("userData");

function groupByWeek<T>(record: Record<string, T>): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const dateString of Object.keys(record)) {
    const date = parse(dateString, "yyyy-MM-dd", new Date());
    const week = format(startOfWeek(date), "YYYY-'W'ww", {
      useAdditionalWeekYearTokens: true,
    });

    if (groups.has(week)) {
      const groupData = groups.get(week);
      groupData?.push(record[dateString]);
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

export async function getKeylogs(): Promise<Record<string, Keylog>> {
  const keylogsPath = path.join(userDataPath, "files", "keylogs");
  const keylogs: Record<string, Keylog> = {};
  const keylogFiles = await readFilesFromDirectory(keylogsPath);

  for (const file of keylogFiles) {
    const fileName = file.name.endsWith(ENCRYPTED_FILE_EXT)
      ? file.name.slice(0, -ENCRYPTED_FILE_EXT.length)
      : file.name;
    const result = fileName.match(/[^.]+/);
    if (result === null) continue;
    const dateString = result[0];
    const date = parse(dateString, "yyyy-MM-dd", new Date());
    if (isNaN(date.getTime())) continue;

    keylogs[dateString] ||= {
      date,
      appPath: null,
      chronoPath: null,
      rawPath: null,
    };

    if (/\.processed\.by-app\./.test(fileName)) {
      keylogs[dateString].appPath = path.join(file.parentPath, fileName);
    } else if (/\.processed\.chronological\./.test(fileName)) {
      keylogs[dateString].chronoPath = path.join(file.parentPath, fileName);
    } else {
      keylogs[dateString].rawPath = path.join(file.parentPath, fileName);
    }
  }
  return keylogs;
}

export async function getScreenshots(): Promise<
  Record<string, Record<string, Screenshot>>
> {
  const screenshotsPath = path.join(userDataPath, "files", "screenshots");
  const screenshots: Record<string, Record<string, Screenshot>> = {};

  const files = await readFilesFromDirectory(screenshotsPath);

  for (const file of files) {
    const fileName = file.name.endsWith(ENCRYPTED_FILE_EXT)
      ? file.name.slice(0, -ENCRYPTED_FILE_EXT.length)
      : file.name;
    const ext = path.extname(fileName);
    const result = fileName.match(/[^.]+/);
    if (result === null) continue;
    const dateString = result[0];
    const date = parse(dateString, "yyyy-MM-dd HH_mm_ss", new Date());
    if (isNaN(date.getTime())) continue;
    const dayString = format(date, "yyyy-MM-dd");

    screenshots[dayString] = screenshots[dayString] || {};
    const screenshot = screenshots[dayString][dateString] || {
      imagePath: null,
      summaryPath: null,
      date,
    };
    if (ext === ".jpg") {
      screenshot.imagePath = path.join(file.parentPath, fileName);
    } else if (ext === ".json") {
      screenshot.summaryPath = path.join(file.parentPath, fileName);
    }

    screenshots[dayString][dateString] = screenshot;
  }

  return screenshots;
}

export async function getScreenshotSummariesForDate(
  dateString: string,
): Promise<{ path: string; contents: string }[]> {
  const screenshots = await getScreenshots();
  const screenshotsForDay = screenshots[dateString]
    ? Object.values(screenshots[dateString])
    : ([] as Screenshot[]);
  const summaryPaths = screenshotsForDay.map(
    (screenshot) => screenshot.summaryPath,
  );
  const summaries: { path: string; contents: string }[] = [];

  for (const summaryPath of summaryPaths) {
    if (summaryPath === null) {
      continue;
    }
    const contents = await readFile(summaryPath);
    summaries.push({ path: summaryPath, contents });
  }

  return summaries;
}

export async function getScreenshotImagePathsForDate(
  dateString: string,
): Promise<string[]> {
  const screenshots = await getScreenshots();
  const screenshotsForDay = screenshots[dateString]
    ? Object.values(screenshots[dateString])
    : ([] as Screenshot[]);
  const imagePaths = screenshotsForDay.map(
    (screenshot) => screenshot.imagePath,
  );
  const availableImagePaths: string[] = [];

  for (const imagePath of imagePaths) {
    if (imagePath) {
      availableImagePaths.push(imagePath);
    }
  }

  return availableImagePaths;
}

export async function getScreenshotImagePaths(): Promise<string[]> {
  const screenshots = await getScreenshots();
  const dayStrings = Object.keys(screenshots);
  const imagePaths: string[] = [];

  for (const dayString of dayStrings) {
    const screenshotsForDay = Object.values(screenshots[dayString]);
    const dayImagePaths = screenshotsForDay
      .map((screenshot) => screenshot.imagePath)
      .filter((path) => path !== null);
    imagePaths.push(...dayImagePaths);
  }

  const availableImagePaths: string[] = [];
  for (const imagePath of imagePaths) {
    try {
      await fs.access(imagePath);
      availableImagePaths.push(imagePath);
    } catch (error) {
      if (!(isErrnoException(error) && error.code !== "ENOENT")) {
        throw error;
      }
    }
  }

  return availableImagePaths;
}

const MONTH_IN_SECONDS = 60 * 60 * 24 * 30;

async function getCharCount<T>(
  items: T[],
  getPath: (item: T) => string | null,
): Promise<number> {
  const contents = await Promise.all(
    items.map((item) => {
      const path = getPath(item);
      return path ? readFile(path) : Promise.resolve("");
    }),
  );
  return sumBy(contents, (c) => c?.length ?? 0);
}

export async function getRecentSummaries(
  ageInSeconds: number = MONTH_IN_SECONDS,
): Promise<Summary[]> {
  const now = new Date();
  const dailySummaries: Record<string, Summary> = {};
  const files = await readFilesFromDirectory(userDataPath);
  const summaryFiles = files.filter((f) => /\.aisummary\./.test(f.name));
  const keylogs: Record<string, Keylog> = await getKeylogs();
  const screenshots: Record<
    string,
    Record<string, Screenshot>
  > = await getScreenshots();

  const dateStrings = Array.from(
    new Set(Object.keys(keylogs).concat(Object.keys(screenshots))),
  );

  for (const dateString of dateStrings) {
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

    let summaryPath: string | null = path.join(
      userDataPath,
      "files",
      "keylogs",
      monthString,
      `${dateString}.aisummary.log`,
    );

    let contents: string | null = null;
    try {
      contents = await readFile(summaryPath);
    } catch (error) {
      if (!(isErrnoException(error) && error.code === "ENOENT")) {
        throw error;
      } else {
        summaryPath = null;
      }
    }

    const keylogCharCount = await getCharCount(
      availableKeylogs,
      (k) => k.chronoPath,
    );
    const screenshotSummaryCharCount = await getCharCount(
      availableScreenshots,
      (s) => s.summaryPath,
    );

    dailySummaries[dateString] = dailySummaries[dateString] || {
      path: summaryPath,
      contents,
      date,
      keylogs: availableKeylogs,
      screenshots: availableScreenshots,
      loading: false,
      scope: SummaryScopeTypes.Day,
      keylogCharCount,
      screenshotSummaryCharCount,
    };
  }

  const weeklyKeylogs = groupByWeek(keylogs);
  const weeklyScreenshots = groupByWeek(screenshots);

  const weeks: string[] = weeklyKeylogs
    .keys()
    .toArray()
    .concat(weeklyScreenshots.keys().toArray());

  const weeklySummaries: Summary[] = [];

  for (const week of weeks) {
    const date = parse(week, "YYYY-'W'ww", new Date(), {
      useAdditionalWeekYearTokens: true,
    });
    if (differenceInSeconds(now, date) >= ageInSeconds) {
      continue;
    }

    let summaryPath: string | null = path.join(
      userDataPath,
      "files",
      `${week}.aisummary.log`,
    );

    let contents: string | null = null;
    try {
      contents = await readFile(summaryPath);
    } catch (error) {
      if (!(isErrnoException(error) && error.code === "ENOENT")) {
        throw error;
      } else {
        summaryPath = null;
      }
    }
    weeklySummaries.push({
      path: summaryPath,
      contents,
      date,
      keylogs: weeklyKeylogs.get(week) ?? [],
      loading: false,
      scope: SummaryScopeTypes.Week,
      screenshots: weeklyScreenshots.get(week)
        ? (weeklyScreenshots
            .get(week)
            ?.reduce(
              (acc, screenshot) => acc.concat(Object.values(screenshot)),
              [] as Screenshot[],
            ) ?? [])
        : ([] as Screenshot[]),
    });
  }

  for (const summaryFile of summaryFiles) {
    const result = summaryFile.name.match(/[^.]+/);
    if (!result) continue;
    const dateString = result[0];

    if (/keylogs/.test(summaryFile.name)) {
      const date = parse(dateString, "yyyy-MM-dd", new Date());
      dailySummaries[dateString] = dailySummaries[dateString] || {
        path: path.join(summaryFile.parentPath, summaryFile.name),
        contents: null,
        date,
        keylogs: [],
        screenshots: [],
        loading: false,
        scope: SummaryScopeTypes.Day,
        keylogCharCount: 0,
        screenshotSummaryCharCount: 0,
      };
    } else {
      const date = parse(dateString, "YYYY-'W'ww", new Date(), {
        useAdditionalWeekYearTokens: true,
      });

      weeklySummaries.some(
        (s) => s.path && path.basename(s.path) === summaryFile.name,
      ) ||
        weeklySummaries.push({
          path: path.join(summaryFile.parentPath, summaryFile.name),
          contents: null,
          date,
          keylogs: [],
          loading: false,
          scope: SummaryScopeTypes.Week,
          screenshots: [],
        });
    }
  }

  return weeklySummaries.concat(Object.values(dailySummaries));
}

export async function getRecentApps(): Promise<string[]> {
  const apps = new Set<string>();
  const now = new Date();

  const keylogs = await getKeylogs()
    .then((keylogs) => Object.values(keylogs))
    .then((keylogs) =>
      keylogs.filter((keylog) => differenceInHours(now, keylog.date) <= 24),
    );

  for (const keylog of keylogs) {
    if (keylog.appPath === null) continue;
    const content = await readFile(keylog.appPath);
    const appRegex = /=== (.*) ===/g;
    const matches = content.toLocaleString().matchAll(appRegex);
    matches.forEach((m) => apps.add(m[1]));
  }

  return Array.from(apps);
}

export async function readFile<T extends boolean = false>(
  filePath: string,
  binary?: T,
): Promise<T extends true ? Uint8Array : string>;
export async function readFile(
  filePath: string,
  binary = false,
): Promise<string | Uint8Array> {
  try {
    const rawData = await fs.readFile(filePath);

    return binary ? rawData : Buffer.from(rawData).toString("utf8");
  } catch (error: unknown) {
    if (!(isErrnoException(error) && error.code === "ENOENT")) {
      throw error;
    }
  }

  const fileData = await fs.readFile(`${filePath}.crypt`);

  const plaintext = await decryptUserData(fileData);

  return binary ? plaintext : Buffer.from(plaintext).toString("utf8");
}

export async function writeFile(
  filePath: string,
  contents: string | Uint8Array,
  append = false,
): Promise<void> {
  let oldFileData: Uint8Array = new Uint8Array();
  let newFileData: Uint8Array = new Uint8Array();
  const contentData: Uint8Array =
    contents instanceof Uint8Array
      ? contents
      : new TextEncoder().encode(contents);

  if (append) {
    try {
      oldFileData = (await readFile(filePath, true)) as Uint8Array;
    } catch (error) {
      if (!(isErrnoException(error) && error.code === "ENOENT")) {
        throw error;
      }
    }
  }

  newFileData = new Uint8Array(oldFileData.length + contentData.length);
  newFileData.set(oldFileData);
  newFileData.set(contentData, oldFileData.length);
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  newFileData = await encryptUserData(newFileData);
  await fs.writeFile(`${filePath}${ENCRYPTED_FILE_EXT}`, newFileData);

  try {
    await fs.unlink(filePath);
  } catch (error: unknown) {
    if (!(isErrnoException(error) && error.code === "ENOENT")) {
      throw error;
    }
  }
}

async function unencryptedFiles(): Promise<string[]> {
  const keylogs = await getKeylogs();
  const screenshots = await getScreenshots();

  let files: string[] = Object.values(keylogs)
    .flatMap((keylog) => [keylog.rawPath, keylog.appPath, keylog.chronoPath])
    .filter((file) => file !== null);

  files = files.concat(
    Object.values(screenshots)
      .flatMap((dayScreenshots) => Object.values(dayScreenshots))
      .flatMap((screenshot) => [screenshot.imagePath, screenshot.summaryPath])
      .filter((file) => file !== null),
  );

  const unencryptedFiles = [];
  for (const file of files) {
    try {
      await fs.access(file);
      unencryptedFiles.push(file);
    } catch (error: unknown) {
      if (!(isErrnoException(error) && error.code === "ENOENT")) {
        throw error;
      }
    }
  }

  return unencryptedFiles;
}

export async function countUnencryptedFiles(): Promise<number> {
  const files = await unencryptedFiles();
  return files.length;
}

export async function encryptAllUnencryptedFiles(
  onProgress?: (current: number, total: number, fileName: string) => void,
): Promise<void> {
  const files = await unencryptedFiles();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const content = await fs.readFile(file);
    await writeFile(file, content);
    onProgress?.(i + 1, files.length, `file: ${file}`);
  }
}
