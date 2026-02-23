import { beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import {
  ENCRYPTED_FILE_EXT,
  initializeMasterKey,
} from "src/electron/encryption";
import {
  countUnencryptedFiles,
  encryptAllUnencryptedFiles,
} from "src/electron/files";

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
  it("encrypts all unencrypted screenshot image files", async () => {
    const imageData = Buffer.from([1, 2, 3, 4]);
    const filesystem = {
      "/files/screenshots/2025-08/2025-08-20/2025-08-20 10_30_00.jpg":
        imageData,
      "/files/screenshots/2025-08/2025-08-20/2025-08-20 11_00_00.jpg":
        imageData,
    };

    vol.fromJSON(filesystem, "/");

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

describe("#countUnencryptedFiles", () => {
  it("counts the unencrypted files", async () => {
    const binaryData = Buffer.from([1, 2, 3, 4]);
    const filesystem = {
      "/files/screenshots/2025-08/2025-08-20/2025-08-20 10_30_00.jpg":
        binaryData,
      "/files/screenshots/2025-08/2025-08-20/2025-08-20 11_00_00.jpg.crypt":
        binaryData,
    };
    vol.fromJSON(filesystem);
    const count = await countUnencryptedFiles();
    expect(count).toBe(1);
  });
});
