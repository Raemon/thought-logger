import { beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import {
  initializeMasterKey,
  readFile,
  writeFile,
  verifyPassword,
  changePassword,
} from "src/electron/paths";
import sodium from "libsodium-wrappers-sumo";

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

describe("encryption", () => {
  it("generates files readable by the program", async () => {
    const origText = "Hello, world!";

    await writeFile("/foo.log", origText);
    const newText = await readFile("/foo.log");
    expect(newText).toBe(origText);
  });

  it("appends files correctly", async () => {
    const textA = "Hello, ";
    const textB = "world!";

    await writeFile("/foo.log", textA);
    await writeFile("/foo.log", textB, true);
    const result = await readFile("/foo.log");
    expect(result).toBe(textA + textB);
  });
});

describe("password management", () => {
  it("verifies correct password", async () => {
    const isValid = await verifyPassword("password");
    expect(isValid).toBe(true);
  });

  it("rejects incorrect password", async () => {
    const isValid = await verifyPassword("wrongpassword");
    expect(isValid).toBe(false);
  });

  it("changes password successfully", async () => {
    const result = await changePassword("newpassword123");
    expect(result.success).toBe(true);

    // Verify old password no longer works
    const oldPasswordValid = await verifyPassword("password");
    expect(oldPasswordValid).toBe(false);

    // Verify new password works
    const newPasswordValid = await verifyPassword("newpassword123");
    expect(newPasswordValid).toBe(true);
  });
});
