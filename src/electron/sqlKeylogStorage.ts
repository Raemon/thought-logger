import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { Mutex } from "async-mutex";
import { ENCRYPTED_FILE_EXT, encryptUserData, decryptUserData } from "./encryption";

import { isErrnoException } from "./utils";

const storageMutex = new Mutex();

export function getSqlKeylogDbPath(): string {
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, "files", "keylogs", "sqlite", "logitems.db");
}

export async function readEncryptedSqlKeylogDbBytes(
  filePath: string,
): Promise<Uint8Array | null> {
  const release = await storageMutex.acquire();
  try {
    try {
      const data = await fs.readFile(filePath);
      return new Uint8Array(data);
    } catch (error: unknown) {
      if (!(isErrnoException(error) && error.code === "ENOENT")) {
        throw error;
      }
    }

    try {
      const cipherData = await fs.readFile(`${filePath}${ENCRYPTED_FILE_EXT}`);
      const plaintext = await decryptUserData(new Uint8Array(cipherData));
      return plaintext;
    } catch (error: unknown) {
      if (isErrnoException(error) && error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  } finally {
    release();
  }
}

export async function writeEncryptedSqlKeylogDbBytesAtomic(
  filePath: string,
  dbBytes: Uint8Array,
): Promise<void> {
  const release = await storageMutex.acquire();
  try {
    const cipherData = await encryptUserData(dbBytes);
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    const cryptPath = `${filePath}${ENCRYPTED_FILE_EXT}`;
    const tmpPath = `${cryptPath}.tmp`;
    await fs.writeFile(tmpPath, cipherData);
    await fs.rename(tmpPath, cryptPath);

    try {
      await fs.unlink(filePath);
    } catch (error: unknown) {
      if (!(isErrnoException(error) && error.code === "ENOENT")) {
        throw error;
      }
    }
  } finally {
    release();
  }
}

