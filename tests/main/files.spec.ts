import { beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import { readFile, writeFile } from "src/electron/files";
import { initializeMasterKey } from "src/electron/encryption";

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

describe("Race Conditions in readFile and writeFile", () => {
  describe("concurrent writes with append", () => {
    it("loses data when multiple writes with append happen simultaneously", async () => {
      const testFile = "/test-append-race.log";

      const writePromises = [];
      for (let i = 0; i < 100; i++) {
        const content = `Line ${i}\n`;
        writePromises.push(writeFile(testFile, content, true));
      }

      await Promise.all(writePromises);

      const finalContent = await readFile(testFile);
      const lineCount = finalContent.trim().split("\n").length;

      expect(lineCount).toBe(100);
    });
  });
});
