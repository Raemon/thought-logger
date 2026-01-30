import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import {
  initializeMasterKey,
  readFile,
  writeFile,
  verifyPassword,
  changePassword,
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
    const result = await changePassword("password", "newpassword123");
    expect(result.success).toBe(true);

    // Verify old password no longer works
    const oldPasswordValid = await verifyPassword("password");
    expect(oldPasswordValid).toBe(false);

    // Verify new password works
    const newPasswordValid = await verifyPassword("newpassword123");
    expect(newPasswordValid).toBe(true);
  });

  it("rejects password change with wrong current password", async () => {
    const result = await changePassword("wrongpassword", "newpassword123");
    expect(result.success).toBe(false);
    expect(result.message).toContain("incorrect");
  });

  it("rejects empty new password", async () => {
    const result = await changePassword("password", "");
    expect(result.success).toBe(false);
    expect(result.message).toContain("empty");
  });
});
