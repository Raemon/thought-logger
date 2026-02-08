import { beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import {
  ENCRYPTED_FILE_EXT,
  initializeMasterKey,
} from "src/electron/encryption";
import { encryptAllUnencryptedFiles } from "src/electron/files";

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
  let secret = "password";
  return {
    ...origModule,
    getSecret: async (_account: string) => Promise.resolve(secret),
    setSecret: async (_account: string, newSecret: string) => {
      secret = newSecret;
      return { success: true, message: "Password set successfully" };
    },
  };
});

vi.mock("node:fs");
vi.mock("node:fs/promises");

beforeEach(async () => {
  vol.reset();
  await initializeMasterKey("password");
});

describe("encryptAllUnencryptedFiles", () => {
  it("encrypts all unencrypted log and screenshot files", async () => {
    const imageData = Buffer.from([1, 2, 3, 4]);
    const filesystem = {
      "/files/keylogs/2025-08/2025-08-20.log": "test data",
      "/files/keylogs/2025-08/2025-08-19.processed.chronological.log":
        "test data",
      "/files/screenshots/2025-08/2025-08-20/2025-08-20 10_30_00.jpg":
        imageData,
      "/files/screenshots/2025-08/2025-08-20/2025-08-20 10_30_00.json":
        '["test data"]',
      "/files/screenshots/2025-08/2025-08-20/2025-08-20 11_00_00.jpg":
        imageData,
      "/files/screenshots/2025-08/2025-08-20/2025-08-20 12_45_00.json":
        '["test data"]',
    };

    vol.fromJSON(filesystem, "/");

    // This will fail because encryptAllUnencryptedFiles doesn't exist yet
    await encryptAllUnencryptedFiles();

    const expectedFilePaths = Object.keys(filesystem)
      .map((path) => `${path}${ENCRYPTED_FILE_EXT}`)
      .sort();

    // Verify unencrypted files are gone
    expect(Object.keys(vol.toJSON())).toStrictEqual([
      "/files/masterkey",
      ...expectedFilePaths,
    ]);
  });
});
