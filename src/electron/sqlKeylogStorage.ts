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

async function quarantineEncryptedSqlKeylogDbNoLock(
  filePath: string,
  reason: string,
): Promise<void> {
  const cryptPath = `${filePath}${ENCRYPTED_FILE_EXT}`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const quarantinePath = `${cryptPath}.unreadable.${reason}.${timestamp}`;
  try {
    await fs.rename(cryptPath, quarantinePath);
  } catch (error: unknown) {
    if (!(isErrnoException(error) && error.code === "ENOENT")) {
      throw error;
    }
  }
}

export async function quarantineEncryptedSqlKeylogDb(
  filePath: string,
  reason: string,
): Promise<void> {
  const release = await storageMutex.acquire();
  try {
    await quarantineEncryptedSqlKeylogDbNoLock(filePath, reason);
  } finally {
    release();
  }
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

    const cryptPath = `${filePath}${ENCRYPTED_FILE_EXT}`;
    const cryptPaths = [cryptPath, `${cryptPath}.bak1`, `${cryptPath}.bak2`];
    let sawAnyEncryptedFile = false;
    for (const candidatePath of cryptPaths) {
      try {
        const cipherData = await fs.readFile(candidatePath);
        sawAnyEncryptedFile = true;
        try {
          const plaintext = await decryptUserData(new Uint8Array(cipherData));
          return plaintext;
        } catch (error: unknown) {
          if (
            candidatePath === cryptPath &&
            error instanceof Error &&
            error.message.includes("ciphertext is too short")
          ) {
            await quarantineEncryptedSqlKeylogDbNoLock(filePath, "ciphertext-too-short");
            continue;
          }
          throw error;
        }
      } catch (error: unknown) {
        if (!(isErrnoException(error) && error.code === "ENOENT")) {
          throw error;
        }
      }
    }
    if (sawAnyEncryptedFile) {
      throw new Error("Encrypted SQL keylog DB exists but could not be decrypted");
    }
    return null;
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
    const bak1Path = `${cryptPath}.bak1`;
    const bak2Path = `${cryptPath}.bak2`;
    try {
      await fs.unlink(bak2Path);
    } catch (error: unknown) {
      if (!(isErrnoException(error) && error.code === "ENOENT")) {
        throw error;
      }
    }
    try {
      await fs.rename(bak1Path, bak2Path);
    } catch (error: unknown) {
      if (!(isErrnoException(error) && error.code === "ENOENT")) {
        throw error;
      }
    }
    try {
      await fs.copyFile(cryptPath, bak1Path);
    } catch (error: unknown) {
      if (!(isErrnoException(error) && error.code === "ENOENT")) {
        throw error;
      }
    }

    const tmpPath = `${cryptPath}.tmp`;
    await fs.writeFile(tmpPath, cipherData);
    try {
      await fs.rename(tmpPath, cryptPath);
    } catch (error: unknown) {
      if (isErrnoException(error) && (error.code === "EEXIST" || error.code === "EPERM")) {
        await fs.unlink(cryptPath);
        await fs.rename(tmpPath, cryptPath);
      } else {
        throw error;
      }
    }

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
