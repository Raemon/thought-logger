import path from "path";
import fs from "node:fs/promises";
import { isSameDay, parse } from "date-fns";
import { app } from "electron";
import { Screenshot } from "../types/files";
import { Dirent } from "node:fs";
import { Mutex } from "async-mutex";

import { isErrnoException } from "./utils";
import {
  decryptUserData,
  ENCRYPTED_FILE_EXT,
  encryptUserData,
} from "./encryption";

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
        date,
      });
    }

    const screenshot = screenshotsByDate.get(dateKey)!;
    if (ext === ".jpg") {
      screenshot.imagePath = path.join(file.parentPath, fileName);
    }
  }

  return Array.from(screenshotsByDate.values());
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
    .filter((path): path is string => path !== null);

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
  let plaintext: string | Uint8Array<ArrayBufferLike>;
  try {
    plaintext = await readFileNoLock(filePath, binary);
  } finally {
    release();
  }

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
  const screenshots = await getScreenshots();

  const files: string[] = screenshots.map((screenshot) => screenshot.imagePath).filter((file): file is string => file !== null);

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
