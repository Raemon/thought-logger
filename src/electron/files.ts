import path from "path";
import fs from "node:fs/promises";
import sumBy from "lodash/sumBy";
import {
  differenceInHours,
  eachDayOfInterval,
  eachWeekOfInterval,
  isSameDay,
  isSameWeek,
  parse,
  setDefaultOptions,
  subSeconds,
} from "date-fns";
import { app } from "electron";
import { Keylog, Screenshot, Summary, SummaryScopeTypes } from "../types/files";
import { Dirent } from "node:fs";
import { Mutex } from "async-mutex";

import { isErrnoException } from "./utils";
import {
  decryptUserData,
  ENCRYPTED_FILE_EXT,
  encryptUserData,
} from "./encryption";

setDefaultOptions({ weekStartsOn: 1 });

const userDataPath = app.getPath("userData");

async function readFilesFromDirectory(path: string): Promise<Dirent[]> {
  let files: Dirent[];

  try {
    files = await fs.readdir(path, {
      recursive: true,
      withFileTypes: true,
    });
  } catch (error: unknown) {
    if (!(isErrnoException(error) && error.code == "ENOENT")) {
      throw error;
    }
    files = [];
  }
  return files.filter((file) => file.isFile());
}

export async function getKeylogs(): Promise<Keylog[]> {
  const keylogsPath = path.join(userDataPath, "files", "keylogs");
  const keylogsByDate = new Map<number, Keylog>();
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

    const dateKey = date.getTime();

    if (!keylogsByDate.has(dateKey)) {
      keylogsByDate.set(dateKey, {
        date,
        appPath: null,
        chronoPath: null,
        rawPath: null,
      });
    }

    const keylog = keylogsByDate.get(dateKey)!;
    if (/\.processed\.by-app\./.test(fileName)) {
      keylog.appPath = path.join(file.parentPath, fileName);
    } else if (/\.processed\.chronological\./.test(fileName)) {
      keylog.chronoPath = path.join(file.parentPath, fileName);
    } else {
      keylog.rawPath = path.join(file.parentPath, fileName);
    }
  }

  return Array.from(keylogsByDate.values());
}

export async function getScreenshots(): Promise<Screenshot[]> {
  const screenshotsPath = path.join(userDataPath, "files", "screenshots");
  const screenshotsByDate = new Map<number, Screenshot>();

  const files = await readFilesFromDirectory(screenshotsPath);

  for (const file of files) {
    const fileName = file.name.replace(
      new RegExp(`${ENCRYPTED_FILE_EXT}$`),
      "",
    );
    const ext = path.extname(fileName);
    const result = fileName.match(/[^.]+/);
    if (result === null) continue;
    const dateString = result[0];
    const date = parse(dateString, "yyyy-MM-dd HH_mm_ss", new Date());
    if (isNaN(date.getTime())) continue;

    const dateKey = date.getTime();

    if (!screenshotsByDate.has(dateKey)) {
      screenshotsByDate.set(dateKey, {
        imagePath: null,
        summaryPath: null,
        date,
      });
    }

    const screenshot = screenshotsByDate.get(dateKey)!;
    if (ext === ".jpg") {
      screenshot.imagePath = path.join(file.parentPath, fileName);
    } else if (ext === ".json") {
      screenshot.summaryPath = path.join(file.parentPath, fileName);
    }
  }

  return Array.from(screenshotsByDate.values());
}

export async function getScreenshotSummariesForDate(
  dateString: string,
): Promise<{ path: string; contents: string }[]> {
  const screenshots = await getScreenshots();
  const date = parse(dateString, "yyyy-MM-dd", new Date());
  const screenshotsForDay = screenshots.filter((s) => isSameDay(date, s.date));
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
  const date = parse(dateString, "yyyy-MM-dd", new Date());
  const screenshotsForDay = screenshots.filter((s) => isSameDay(date, s.date));

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
  const imagePaths: string[] = screenshots
    .map((screenshot) => screenshot.imagePath)
    .filter((path) => path !== null);

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

async function getSummaries(): Promise<Summary[]> {
  const files = await readFilesFromDirectory(userDataPath);
  const summaryFiles = files.filter((f) => /\.aisummary\./.test(f.name));
  const summaries: Summary[] = [];

  for (const summaryFile of summaryFiles) {
    const fileName = summaryFile.name.replace(
      new RegExp(`${ENCRYPTED_FILE_EXT}$`),
      "",
    );
    const result = fileName.match(/[^.]+/);
    if (!result) continue;
    const dateString = result[0];

    const contents = await readFile(
      path.join(summaryFile.parentPath, fileName),
    );

    if (/[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(fileName)) {
      const date = parse(dateString, "yyyy-MM-dd", new Date());
      summaries.push({
        path: path.join(summaryFile.parentPath, fileName),
        contents,
        date,
        keylogs: [],
        screenshots: [],
        loading: false,
        scope: SummaryScopeTypes.Day,
        keylogCharCount: 0,
        screenshotSummaryCharCount: 0,
      });
    } else if (/[0-9]{4}-W[0-9]{2}/.test(fileName)) {
      const date = parse(dateString, "YYYY-'W'ww", new Date(), {
        useAdditionalWeekYearTokens: true,
      });

      summaries.push({
        path: path.join(summaryFile.parentPath, fileName),
        contents,
        date,
        keylogs: [],
        loading: false,
        scope: SummaryScopeTypes.Week,
        screenshots: [],
      });
    } else {
      throw new Error(`Invalid date format in filename ${fileName}`);
    }
  }

  return summaries;
}

export async function getRecentSummaries(
  ageInSeconds: number = MONTH_IN_SECONDS,
): Promise<Summary[]> {
  const summaries: Summary[] = [];
  const end = new Date();
  const start = subSeconds(end, ageInSeconds);
  const existingSummaries = await getSummaries();
  const keylogs: Keylog[] = await getKeylogs();
  const screenshots: Screenshot[] = await getScreenshots();

  for (const date of eachDayOfInterval({
    start,
    end,
  })) {
    const existingSummary = existingSummaries.find(
      (s) => s.scope === SummaryScopeTypes.Day && isSameDay(date, s.date),
    );
    const matchingKeylogs = keylogs.filter((k) => isSameDay(date, k.date));
    const matchingScreenshots = screenshots.filter((s) =>
      isSameDay(date, s.date),
    );
    const keylogCharCount = await getCharCount(
      matchingKeylogs,
      (k) => k.chronoPath,
    );
    const screenshotSummaryCharCount = await getCharCount(
      matchingScreenshots,
      (s) => s.summaryPath,
    );
    const summary: Summary = existingSummary
      ? {
          ...existingSummary,
          keylogs: matchingKeylogs,
          screenshots: matchingScreenshots,
          keylogCharCount,
          screenshotSummaryCharCount,
        }
      : {
          date,
          path: null,
          scope: SummaryScopeTypes.Day,
          keylogs: matchingKeylogs,
          screenshots: matchingScreenshots,
          loading: false,
          contents: null,
          keylogCharCount,
          screenshotSummaryCharCount,
        };

    summaries.push(summary);
  }

  for (const date of eachWeekOfInterval({
    start,
    end,
  })) {
    const existingSummary = existingSummaries.find(
      (s) => s.scope === SummaryScopeTypes.Week && isSameWeek(date, s.date),
    );
    const matchingKeylogs = keylogs.filter((k) => isSameWeek(date, k.date));
    const matchingScreenshots = screenshots.filter((s) =>
      isSameWeek(date, s.date),
    );
    const keylogCharCount = await getCharCount(
      matchingKeylogs,
      (k) => k.chronoPath,
    );
    const screenshotSummaryCharCount = await getCharCount(
      matchingScreenshots,
      (s) => s.summaryPath,
    );
    const summary: Summary = existingSummary
      ? {
          ...existingSummary,
          keylogs: matchingKeylogs,
          screenshots: matchingScreenshots,
          keylogCharCount,
          screenshotSummaryCharCount,
        }
      : {
          date,
          path: null,
          scope: SummaryScopeTypes.Week,
          keylogs: matchingKeylogs,
          screenshots: matchingScreenshots,
          loading: false,
          contents: null,
          keylogCharCount,
          screenshotSummaryCharCount,
        };

    summaries.push(summary);
  }

  return summaries;
}

export async function getRecentApps(): Promise<string[]> {
  const apps = new Set<string>();
  const now = new Date();

  const keylogs = await getKeylogs().then((keylogs) =>
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

const fileMutex = new Mutex();

async function readFileNoLock(
  filePath: string,
  binary: boolean,
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

export async function readFile<T extends boolean = false>(
  filePath: string,
  binary?: T,
): Promise<T extends true ? Uint8Array : string>;
export async function readFile(
  filePath: string,
  binary = false,
): Promise<string | Uint8Array> {
  const release = await fileMutex.acquire();
  const plaintext = await readFileNoLock(filePath, binary);
  release();
  return plaintext;
}

export async function writeFile(
  filePath: string,
  contents: string | Uint8Array,
  append = false,
): Promise<void> {
  const release = await fileMutex.acquire();
  let oldFileData: Uint8Array = new Uint8Array();
  let newFileData: Uint8Array;
  const contentData: Uint8Array =
    contents instanceof Uint8Array
      ? contents
      : new TextEncoder().encode(contents);

  if (append) {
    try {
      oldFileData = (await readFileNoLock(filePath, true)) as Uint8Array;
    } catch (error) {
      if (!(isErrnoException(error) && error.code === "ENOENT")) {
        release();
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
  } finally {
    release();
  }
}

async function unencryptedFiles(): Promise<string[]> {
  const keylogs = await getKeylogs();
  const screenshots = await getScreenshots();

  let files: string[] = keylogs
    .flatMap((keylog) => [keylog.rawPath, keylog.appPath, keylog.chronoPath])
    .filter((file) => file !== null);

  files = files.concat(
    screenshots
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
