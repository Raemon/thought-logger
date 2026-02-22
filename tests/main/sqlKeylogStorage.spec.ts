import { beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";

import { ENCRYPTED_FILE_EXT, initializeMasterKey } from "../../src/electron/encryption";
import {
  getSqlKeylogDbPath,
  readEncryptedSqlKeylogDbBytes,
  writeEncryptedSqlKeylogDbBytesAtomic,
} from "../../src/electron/sqlKeylogStorage";

vi.mock("electron", () => {
  return {
    ipcMain: {
      handle: (): undefined => undefined,
      on: (): undefined => undefined,
    },
    app: {
      isPackaged: false,
      getPath: () => "/",
      getAppPath: () => "/",
      on: (): undefined => undefined,
      whenReady: () => Promise.reject(),
    },
  };
});

vi.mock("../../src/electron/credentials", async () => {
  const origModule = await vi.importActual("../../src/electron/credentials");
  return {
    ...origModule,
    getSecret: async (_account: string) => Promise.resolve("password"),
  };
});

vi.mock("node:fs");
vi.mock("node:fs/promises");

beforeEach(async () => {
  vol.reset();
  await initializeMasterKey("password");
});

describe("sqlKeylogStorage", () => {
  it("roundtrips encrypted DB bytes without leaving plaintext files", async () => {
    const dbPath = getSqlKeylogDbPath();
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 255]);

    await writeEncryptedSqlKeylogDbBytesAtomic(dbPath, bytes);

    const plaintextFiles = Object.keys(vol.toJSON()).filter((p) => p === dbPath);
    expect(plaintextFiles).toEqual([]);

    const readBytes = await readEncryptedSqlKeylogDbBytes(dbPath);
    expect(readBytes).not.toBeNull();
    expect(Array.from(readBytes || [])).toEqual(Array.from(bytes));
  });

  it("keeps rolling backups of encrypted DB bytes", async () => {
    const dbPath = getSqlKeylogDbPath();
    const cryptPath = `${dbPath}${ENCRYPTED_FILE_EXT}`;
    const bak1Path = `${cryptPath}.bak1`;
    const bak2Path = `${cryptPath}.bak2`;

    await writeEncryptedSqlKeylogDbBytesAtomic(dbPath, new Uint8Array([1, 2, 3]));
    const firstCrypt = await vol.promises.readFile(cryptPath);
    await expect(vol.promises.readFile(bak1Path)).rejects.toThrow();
    await expect(vol.promises.readFile(bak2Path)).rejects.toThrow();

    await writeEncryptedSqlKeylogDbBytesAtomic(dbPath, new Uint8Array([4, 5, 6]));
    const secondCrypt = await vol.promises.readFile(cryptPath);
    const secondBak1 = await vol.promises.readFile(bak1Path);
    expect(Buffer.from(secondBak1).equals(Buffer.from(firstCrypt))).toBe(true);
    expect(Buffer.from(secondCrypt).equals(Buffer.from(firstCrypt))).toBe(false);

    await writeEncryptedSqlKeylogDbBytesAtomic(dbPath, new Uint8Array([7, 8, 9]));
    const thirdBak1 = await vol.promises.readFile(bak1Path);
    const thirdBak2 = await vol.promises.readFile(bak2Path);
    expect(Buffer.from(thirdBak2).equals(Buffer.from(firstCrypt))).toBe(true);
    expect(Buffer.from(thirdBak1).equals(Buffer.from(secondCrypt))).toBe(true);
  });

  it("quarantines truncated encrypted DB files", async () => {
    const dbPath = getSqlKeylogDbPath();
    const cryptPath = `${dbPath}${ENCRYPTED_FILE_EXT}`;
    await vol.promises.mkdir("/files/keylogs/sqlite", { recursive: true });
    await vol.promises.writeFile(cryptPath, Buffer.from([1, 2, 3]));

    await expect(readEncryptedSqlKeylogDbBytes(dbPath)).rejects.toThrow();

    const paths = Object.keys(vol.toJSON());
    expect(paths.includes(cryptPath)).toBe(false);
    expect(paths.some((p) => p.includes(`${cryptPath}.unreadable.ciphertext-too-short.`))).toBe(true);
  });
});
