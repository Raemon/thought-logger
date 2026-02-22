import { beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";

import { initializeMasterKey } from "../../src/electron/encryption";
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
});

