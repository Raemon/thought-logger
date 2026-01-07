import path from "path";
import { app } from "electron";
import logger from "../logging";

// Import keytar safely
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let keytar: any;
try {
  keytar = require("keytar");
} catch (error) {
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

// Constants for keychain access
const SERVICE_NAME = "ThoughtLogger";
export const OPEN_ROUTER: string = "OpenRouter";

export async function getSecret(account: string): Promise<string | null> {
  try {
    return await keytar.getPassword(SERVICE_NAME, account);
  } catch (error) {
    logger.error("Error accessing keychain:", error);
    return null;
  }
}

export async function saveSecret(
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
    return {
      success: true,
      message: `${account} secret saved successfully`,
    };
  } catch (error) {
    logger.error(`Failed to save ${account} secret:`, error);
    return {
      success: false,
      message: `Failed to save ${account} secret: ${error.message}`,
    };
  }
}
