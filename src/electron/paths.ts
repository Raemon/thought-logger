import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import sodium, { ready as sodiumReady } from "libsodium-wrappers-sumo";
import { getSecret, LOG_FILE_ENCRYPTION, setSecret } from "./credentials";
import logger from "../logging";

const ENCRYPTED_FILE_EXT = ".crypt";
const ENCRYPTION_CPULIMIT = 3;
const ENCRYPTION_MEMLIMIT = 268435456;
const userDataPath = app.getPath("userData");
const masterKeyPath = path.join(userDataPath, "files", "masterkey");

let cachedMasterKey: Uint8Array | null = null;
let cachedPassword: string | null = null;

/**
 * Get path to current key log file.
 * E.g. [userDataPath]/files/keys/2025 January/2025-01-12.log
 */
export function currentKeyLogFile(): string {
  const now = new Date();
  const year = now.getFullYear();

  // Format folder as YYYY-MM
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const folderName = `${year}-${month}`;

  // Format date as YYYY-MM-DD
  const dateStr = now.toLocaleDateString("en-CA");

  // Construct path
  const folderPath = path.join(userDataPath, "files", "keylogs", folderName);

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
  const month = String(now.getMonth() + 1).padStart(2, "0");
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

function deriveKey(password: string, salt: Uint8Array): Uint8Array {
  const key = sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    password,
    salt,
    ENCRYPTION_CPULIMIT,
    ENCRYPTION_MEMLIMIT,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
    "uint8array",
  ) as Uint8Array;
  return key;
}

function encryptWithKey(
  key: Uint8Array<ArrayBufferLike>,
  plaintext: string | Uint8Array<ArrayBufferLike>,
): Uint8Array {
  let plainData: Uint8Array<ArrayBufferLike>;

  if (typeof plaintext === "string") {
    plainData = new TextEncoder().encode(plaintext);
  } else {
    plainData = plaintext;
  }

  const nonce = sodium.randombytes_buf(
    sodium.crypto_secretbox_NONCEBYTES,
    "uint8array",
  ) as Uint8Array;

  const cipherData = sodium.crypto_secretbox_easy(
    plainData,
    nonce,
    key,
    "uint8array",
  ) as Uint8Array;
  const fileData = new Uint8Array(nonce.length + cipherData.length);

  fileData.set(nonce);
  fileData.set(cipherData, nonce.length);
  return fileData;
}

function decryptWithKey(
  key: Uint8Array<ArrayBufferLike>,
  data: Uint8Array<ArrayBufferLike>,
): Uint8Array {
  const nonce = data.slice(0, sodium.crypto_secretbox_NONCEBYTES);
  const cipherText = data.slice(sodium.crypto_secretbox_NONCEBYTES);

  return sodium.crypto_secretbox_open_easy(
    cipherText,
    nonce,
    key,
    "uint8array",
  ) as Uint8Array;
}

export async function initializeMasterKey(password: string): Promise<void> {
  let masterKey: Uint8Array<ArrayBufferLike>;
  let salt: Uint8Array<ArrayBufferLike>;
  let key: Uint8Array<ArrayBufferLike>;

  await sodiumReady;

  try {
    const data = await fs.readFile(masterKeyPath);
    salt = data.subarray(0, sodium.crypto_pwhash_SALTBYTES);
    key = deriveKey(password, salt);
    const encMasterKey = data.subarray(sodium.crypto_pwhash_SALTBYTES);
    masterKey = decryptWithKey(key, encMasterKey);
  } catch (error) {
    if (error.code === "ENOENT") {
      salt = sodium.randombytes_buf(
        sodium.crypto_pwhash_SALTBYTES,
        "uint8array",
      ) as Uint8Array;
      key = deriveKey(password, salt);
      masterKey = sodium.crypto_secretbox_keygen("uint8array") as Uint8Array;
    } else {
      throw error;
    }
  }

  const encryptedMasterKey = encryptWithKey(key, masterKey);
  const fileData = new Uint8Array(salt.length + encryptedMasterKey.length);
  fileData.set(salt);
  fileData.set(encryptedMasterKey, salt.length);
  await fs.mkdir(path.dirname(masterKeyPath), { recursive: true });
  await fs.writeFile(masterKeyPath, fileData);
}

async function getMasterKey(password: string): Promise<Uint8Array> {
  if (password === cachedPassword) {
    return cachedMasterKey;
  }

  const fileData = await fs.readFile(masterKeyPath);
  const salt = fileData.subarray(0, sodium.crypto_pwhash_SALTBYTES);
  const masterKey = fileData.subarray(sodium.crypto_pwhash_SALTBYTES);
  const key = deriveKey(password, salt);

  cachedMasterKey = decryptWithKey(key, masterKey);
  cachedPassword = password;
  return cachedMasterKey;
}

export async function verifyPassword(password: string): Promise<boolean> {
  try {
    await getMasterKey(password);
    return true;
  } catch (error) {
    return false;
  }
}

export async function changePassword(
  newPassword: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const oldPassword = await getSecret(LOG_FILE_ENCRYPTION);
    // Verify old password
    if (oldPassword && !(await verifyPassword(oldPassword))) {
      return {
        success: false,
        message: "Current password is incorrect",
      };
    }

    // Validate new password
    const result = await setSecret(LOG_FILE_ENCRYPTION, newPassword);
    if (!result.success) {
      return result;
    }

    await sodiumReady;

    // Read current master key file
    let oldMasterKey: Uint8Array<ArrayBufferLike> | null;

    try {
      const fileData = await fs.readFile(masterKeyPath);
      const oldSalt = fileData.subarray(0, sodium.crypto_pwhash_SALTBYTES);
      const oldEncMasterKey = fileData.subarray(sodium.crypto_pwhash_SALTBYTES);
      const oldKey = deriveKey(oldPassword, oldSalt);
      oldMasterKey = decryptWithKey(oldKey, oldEncMasterKey);
    } catch (error) {
      if (error.code === "ENOENT") {
        oldMasterKey = null;
      } else {
        throw error;
      }
    }

    // Generate new salt and derive new key
    const newSalt = sodium.randombytes_buf(
      sodium.crypto_pwhash_SALTBYTES,
      "uint8array",
    ) as Uint8Array;
    const newKey = deriveKey(newPassword, newSalt);

    // Re-encrypt master key with new key
    let newEncryptedMasterKey: Uint8Array<ArrayBufferLike>;
    if (oldMasterKey === null) {
      initializeMasterKey(newPassword);
    } else {
      newEncryptedMasterKey = encryptWithKey(newKey, oldMasterKey);

      const newFileData = new Uint8Array(
        newSalt.length + newEncryptedMasterKey.length,
      );
      newFileData.set(newSalt);
      newFileData.set(newEncryptedMasterKey, newSalt.length);

      await fs.writeFile(masterKeyPath, newFileData);
    }

    cachedMasterKey = null;
    cachedPassword = null;

    return {
      success: true,
      message: "Password changed successfully",
    };
  } catch (error) {
    logger.error("Failed to change password:", error);
    return {
      success: false,
      message: `Failed to change password: ${error.message}`,
    };
  }
}

export async function readFile(filePath: string): Promise<string> {
  try {
    const rawData = await fs.readFile(filePath);
    return Buffer.from(rawData).toString("utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const fileData = await fs.readFile(`${filePath}.crypt`);

  await sodiumReady;

  const password = await getSecret(LOG_FILE_ENCRYPTION);
  if (!password) {
    throw new Error("No encryption password configured");
  }
  const masterKey = await getMasterKey(password);

  const plaintext = decryptWithKey(masterKey, fileData);

  return Buffer.from(plaintext).toString("utf8");
}

export async function writeFile(
  filePath: string,
  contents: string,
  append = false,
): Promise<void> {
  await sodiumReady;
  const password = await getSecret(LOG_FILE_ENCRYPTION);
  let fileData: string | Uint8Array<ArrayBufferLike> = "";
  let fileName: string;

  if (append) {
    try {
      fileData = await readFile(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  if (password === null) {
    fileData += contents;
  } else {
    const masterKey = await getMasterKey(password);
    fileData = encryptWithKey(masterKey, fileData + contents);
  }

  if (fileData instanceof Uint8Array) {
    fileName = `${filePath}${ENCRYPTED_FILE_EXT}`;
  } else {
    fileName = filePath;
  }
  return fs.writeFile(fileName, fileData);
}

/**
 * Get path to current processed key log file.
 * E.g. [userDataPath]/files/keys/2025-01/2025-01-12.processed.log
 */
export function currentProcessedKeyLogFile(suffix: string): string {
  const rawPath = currentKeyLogFile();
  const dir = path.dirname(rawPath);
  const basename = path.basename(rawPath, "log");
  return path.join(dir, `${basename}${suffix}log`);
}
