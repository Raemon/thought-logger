import { app } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import sodium, { ready as sodiumReady } from "libsodium-wrappers-sumo";
import { getSecret, setSecret } from "./credentials";
import { LOG_FILE_ENCRYPTION } from "../constants/credentials";
import { memoize } from "micro-memoize";
import logger from "../logging";
import { isErrnoException } from "./utils";

export const ENCRYPTED_FILE_EXT = ".crypt";
const ENCRYPTION_CPULIMIT = 3;
const ENCRYPTION_MEMLIMIT = 268435456;

const userDataPath = app.getPath("userData");
const masterKeyPath = path.join(userDataPath, "files", "masterkey");

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

export async function encryptUserData(
  plaintext: string | Uint8Array<ArrayBufferLike>,
): Promise<Uint8Array> {
  await sodiumReady;
  const password = await getSecret(LOG_FILE_ENCRYPTION);

  if (!password) {
    throw new Error("Tried to encrypt data with no password");
  }

  const masterKey = await getMasterKey(password);
  return encryptWithKey(masterKey, plaintext);
}

export async function decryptUserData(
  ciphertext: Uint8Array<ArrayBufferLike>,
): Promise<Uint8Array> {
  await sodiumReady;
  const password = await getSecret(LOG_FILE_ENCRYPTION);

  if (!password) {
    throw new Error("Tried to decrypt data with no password");
  }

  const masterKey = await getMasterKey(password);
  return decryptWithKey(masterKey, ciphertext);
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
  await sodiumReady;

  try {
    getMasterKey.cache.clear();
    await getMasterKey(password);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      const salt = sodium.randombytes_buf(
        sodium.crypto_pwhash_SALTBYTES,
        "uint8array",
      ) as Uint8Array;
      const key = deriveKey(password, salt);
      const masterKey = sodium.crypto_secretbox_keygen(
        "uint8array",
      ) as Uint8Array;
      const encryptedMasterKey = encryptWithKey(key, masterKey);
      const fileData = new Uint8Array(salt.length + encryptedMasterKey.length);
      fileData.set(salt);
      fileData.set(encryptedMasterKey, salt.length);
      await fs.mkdir(path.dirname(masterKeyPath), { recursive: true });
      await fs.writeFile(masterKeyPath, fileData);
    } else {
      throw error;
    }
  }
}

const getMasterKey = memoize(
  async (password: string): Promise<Uint8Array> => {
    const fileData = await fs.readFile(masterKeyPath);
    const salt = fileData.subarray(0, sodium.crypto_pwhash_SALTBYTES);
    const masterKey = fileData.subarray(sodium.crypto_pwhash_SALTBYTES);
    const key = deriveKey(password, salt);

    return decryptWithKey(key, masterKey);
  },
  { async: true },
);

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
    let oldMasterKey: Uint8Array<ArrayBufferLike> | null = null;

    try {
      oldMasterKey = oldPassword ? await getMasterKey(oldPassword) : null;
    } catch (error) {
      if (!(isErrnoException(error) && error.code === "ENOENT")) {
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

    getMasterKey.cache.clear();

    return {
      success: true,
      message: "Password changed successfully",
    };
  } catch (error) {
    logger.error("Failed to change password:", error);
    return {
      success: false,
      message: `Failed to change password: ${(error as Error).message}`,
    };
  }
}
