import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import sodium from "libsodium-wrappers-sumo";
import { getSecret, LOG_FILE_ENCRYPTION } from "./credentials";

const ENCRYPTED_FILE_EXT = ".crypt";
const ENCRYPTION_CPULIMIT = 3;
const ENCRYPTION_MEMLIMIT = 268435456;
const userDataPath = app.getPath("userData");

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

export async function readEncryptedFile(filePath: string): Promise<string> {
  let rawData: Buffer<ArrayBufferLike>;

  try {
    rawData = await fs.readFile(filePath);
    return Buffer.from(rawData).toString("utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  rawData = await fs.readFile(`${filePath}.crypt`);

  await sodium.ready;

  const password = await getSecret(LOG_FILE_ENCRYPTION);

  if (password === null) {
    throw new Error(
      `Attempted to read encrypted file ${filePath} with no password set`,
    );
  }

  const fileData = new Uint8Array(rawData);
  const salt = fileData.slice(0, sodium.crypto_pwhash_SALTBYTES);

  const key = deriveKey(password, salt);

  if (key.byteLength !== sodium.crypto_secretbox_KEYBYTES) {
    throw new Error("Invalid key length; must be 32 bytes");
  }

  const nonce = fileData.slice(
    sodium.crypto_pwhash_SALTBYTES,
    sodium.crypto_pwhash_SALTBYTES + sodium.crypto_secretbox_NONCEBYTES,
  );

  const ciphertext = fileData.slice(
    sodium.crypto_pwhash_SALTBYTES + sodium.crypto_secretbox_NONCEBYTES,
  );

  const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);

  if (!plaintext) {
    throw new Error("Decryption failed (forged or corrupted data)");
  }

  return Buffer.from(plaintext).toString("utf8");
}

export async function writeEncryptedFile(
  filePath: string,
  content: string,
): Promise<void> {
  await sodium.ready;
  const password = await getSecret(LOG_FILE_ENCRYPTION);

  if (password === null) {
    return fs.writeFile(filePath, content);
  }
  const salt = sodium.randombytes_buf(
    sodium.crypto_pwhash_SALTBYTES,
    "uint8array",
  ) as Uint8Array;

  const nonce = sodium.randombytes_buf(
    sodium.crypto_secretbox_NONCEBYTES,
    "uint8array",
  ) as Uint8Array;

  const key = deriveKey(password, salt);

  const data = sodium.crypto_secretbox_easy(
    content,
    nonce,
    key,
    "uint8array",
  ) as Uint8Array;
  const fileData = new Uint8Array(salt.length + nonce.length + data.length);
  fileData.set(salt);
  fileData.set(nonce, salt.length);
  fileData.set(data, nonce.length + salt.length);
  return fs.writeFile(`${filePath}${ENCRYPTED_FILE_EXT}`, fileData);
}

/**
 * Append `content` to the end of `filePath`, creating any parent
 * directories if necessary.
 */
export async function appendFile(
  filePath: string,
  content: string,
  overwrite = false,
): Promise<void> {
  try {
    await fs.access(filePath);
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") {
      const fileDir = path.dirname(filePath);
      await fs.mkdir(fileDir, { recursive: true });
    } else {
      throw err;
    }
  }

  let plaintext = content;
  if (!overwrite) {
    const existingData = await readEncryptedFile(filePath);
    plaintext = existingData + content;
  }

  await writeEncryptedFile(filePath, plaintext);
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
