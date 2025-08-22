import path from "path";
import { app } from "electron";
import log from "../logging";

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
    console.log("Attempting to load keytar from:", keytarPath);
    keytar = require(keytarPath);
  } catch (secondError) {
    log.error("Failed to load keytar:", secondError);
    // Provide a fallback implementation that logs error but doesn't crash
    keytar = {
      getPassword: async (): Promise<string | null> => null,
      setPassword: async (): Promise<void> => {
        log.error("Unable to save password: keytar not available");
      },
    };
  }
}

// Constants for keychain access
const SERVICE_NAME = "ThoughtLogger";
const ACCOUNT_NAME = "OpenRouter";

export async function getApiKey(): Promise<string | null> {
  try {
    return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  } catch (error) {
    log.error("Error accessing keychain:", error);
    return null;
  }
}

export async function saveApiKey(
  apiKey: string,
): Promise<{ success: boolean; message: string }> {
  try {
    if (!apiKey || apiKey.trim() === "") {
      return {
        success: false,
        message: "API key cannot be empty",
      };
    }

    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, apiKey);
    return {
      success: true,
      message: "API key saved successfully",
    };
  } catch (error) {
    log.error("Failed to save API key:", error);
    return {
      success: false,
      message: `Failed to save API key: ${error.message}`,
    };
  }
}
