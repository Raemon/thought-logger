import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import {
  initializeMasterKey,
  readEncryptedFile,
  writeEncryptedFile,
} from "src/electron/paths";

vi.mock("electron", () => {
  return {
    ipcMain: {
      handle: () => {},
      on: () => {},
    },
    app: {
      isPackaged: false,
      getPath: () => "/",
      getAppPath: () => "/",
      on: () => {},
      whenReady: () => Promise.reject(),
    },
  };
});

vi.mock("../../src/electron/credentials", async () => {
  const origModule = await vi.importActual("../../src/electron/credentials");
  return {
    ...origModule,
    getSecret: (_account: string) => Promise.resolve("password"),
  };
});

vi.mock("node:fs");
vi.mock("node:fs/promises");

beforeEach(async () => {
  vol.reset();
  await initializeMasterKey("password");
});

describe("encryption", () => {
  it("generates files readable by the program", async () => {
    const origText = "Hello, world!";

    await writeEncryptedFile("/foo.log", origText);
    const newText = await readEncryptedFile("/foo.log");
    expect(newText).toBe(origText);
  });
});
