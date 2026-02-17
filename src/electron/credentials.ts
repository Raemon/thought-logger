import path from "path";
import { app } from "electron";
import logger from "../logging";

// Import keytar safely
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let keytar: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  keytar = require("keytar");
} catch {
  // If we can't load keytar directly, try to load it from the resources directory
  try {
    const keytarPath = app.isPackaged
      ? path.join(process.resourcesPath, "keytar.node")
      : path.join(
          app.getAppPath(),
          "node_modules",
          "keytar",
          "build",
          "Release",
          "keytar.node",
        );
    logger.debug(`Attempting to load keytar from: ${keytarPath}`);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    keytar = require(keytarPath);
  } catch (secondError) {
    logger.error("Failed to load keytar:", secondError);
    // Provide a fallback implementation that logs error but doesn't crash
    keytar = {
      getPassword: async (): Promise<string | null> => null,
      setPassword: async (): Promise<void> => {
        logger.error("Unable to save password: keytar not available");
      },
    };
  }
}

// Constants for keychain access are imported from ../constants/credentials.ts
const SERVICE_NAME = "ThoughtLogger";

const cache: { [key: string]: string | null } = {};
let queue: Promise<string | null> = Promise.resolve(null);

export async function getSecret(account: string): Promise<string | null> {
  queue = queue.then(async () => {
    cache[account] ||= await keytar.getPassword(SERVICE_NAME, account);
    return cache[account];
  });

  return queue;
}

export async function setSecret(
  account: string,
  secret: string,
): Promise<{ success: boolean; message: string }> {
  try {
    if (!secret || secret.trim() === "") {
      return {
        success: false,
        message: `${account} secret cannot be empty`,
      };
    }

    await keytar.setPassword(SERVICE_NAME, account, secret);
    cache[account] = null;
    return {
      success: true,
      message: `${account} secret saved successfully`,
    };
  } catch (error: unknown) {
    logger.error(`Failed to save ${account} secret:`, error);

    let errorMsg = "Unknown error";
    if (error instanceof Error) {
      errorMsg = error.message;
    }

    return {
      success: false,
      message: `Failed to save ${account} secret: ${errorMsg}`,
    };
  }
}
