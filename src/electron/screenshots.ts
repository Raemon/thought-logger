import fs from "node:fs/promises";
import path from "node:path";
import { currentScreenshotFile } from "./paths";
import { Preferences } from "../preferences";
import { desktopCapturer, app, systemPreferences } from "electron";

import fetch from "node-fetch";
import { loadPreferences } from "../main";
import { z } from "zod";
import { getCurrentApplication } from "../keylogger";

const ScreenshotText = z.object({
  project: z
    .string()
    .describe("name of the project the user is currently working on"),
  document: z.string().describe("name of the document the user has open"),
  summary: z.string().describe("summary of the screenshot"),
});

type ScreenshotText = z.infer<typeof ScreenshotText>;

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
    console.error("Failed to load keytar:", secondError);
    // Provide a fallback implementation that logs error but doesn't crash
    keytar = {
      getPassword: async (): Promise<string | null> => null,
      setPassword: async (): Promise<void> =>
        console.error("Unable to save password: keytar not available"),
    };
  }
}

// Constants for keychain access
const SERVICE_NAME = "ThoughtLogger";
const ACCOUNT_NAME = "OpenRouter";

// Function to get API key from keychain
async function getApiKey(): Promise<string | null> {
  try {
    return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  } catch (error) {
    console.error("Error accessing keychain:", error);
    return null;
  }
}

// Function to save API key to keychain
async function saveApiKey(apiKey: string): Promise<void> {
  try {
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, apiKey);
  } catch (error) {
    console.error("Error saving to keychain:", error);
  }
}

async function extractTextFromImage(
  imageBuffer: Buffer,
  model: string,
  prompt: string,
): Promise<ScreenshotText> {
  const base64Image = imageBuffer.toString("base64");
  const imageUrl = `data:image/jpeg;base64,${base64Image}`;
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      console.error("API key not found in keychain");
      throw "ERROR: OpenRouter API key is not set. Use saveOpenRouterApiKey() to set your API key.";
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          require_parameters: true,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: prompt,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageUrl,
                  },
                },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "screenshot_summary",
              strict: true,
              schema: z.toJSONSchema(ScreenshotText),
            },
          },
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `API request failed: ${response.status} ${JSON.stringify(errorData)}`,
      );
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    const result = JSON.parse(data.choices[0].message.content);
    return ScreenshotText.parse(result);
  } catch (error) {
    console.error("Failed to extract text from image:", error);
    throw `ERROR: Failed to extract text: ${error.message}`;
  }
}

export async function saveScreenshot(
  img: Buffer,
  currentApplication: string,
): Promise<void> {
  // Extract and save text
  const { screenshotModel, screenshotPrompt } = await loadPreferences();
  const prompt =
    screenshotPrompt[currentApplication] || screenshotPrompt.default;
  const extractedText = await extractTextFromImage(
    img,
    screenshotModel,
    prompt,
  );
  const { project, document } = extractedText;
  const filePath = currentScreenshotFile();
  const textFilePath = filePath.replace(".jpg", `.${project}.${document}.txt`);

  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, img);

    await fs.writeFile(textFilePath, extractedText.summary);

    const { screenshotTemporary } = await loadPreferences();

    if (screenshotTemporary) {
      // Delete screenshot when we're done extracting.
      await fs.unlink(filePath);
    }
  } catch (error) {
    console.error("Failed to take screenshot or extract text:", error);
  }
}

async function takeScreenshot(quality: number) {
  try {
    if (systemPreferences.getMediaAccessStatus("screen")) {
      throw "Thought Logger does not have permission to capture the screen.";
    }
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1920, height: 1080 },
    });
    const img = sources[0].thumbnail.toJPEG(quality);
    const currentApplication = getCurrentApplication();
    await saveScreenshot(img, currentApplication);
  } catch (e) {
    console.error(`Failed to capture screenshot: ${e}`);
  }
}

let screenshotIntervalID: ReturnType<typeof setInterval> | null = null;

export function toggleScheduledScreenshots(prefs: Preferences) {
  if (screenshotIntervalID != null) {
    clearInterval(screenshotIntervalID);
  }

  if (prefs.screenshotActive) {
    screenshotIntervalID = setInterval(
      () => takeScreenshot(prefs.screenshotQuality),
      prefs.screenshotPeriod * 1000,
    );
  }
}

// Add this new function to expose API key management to the main process
export async function checkAndGetApiKey(): Promise<{
  hasKey: boolean;
  message: string;
}> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return {
      hasKey: false,
      message:
        "No OpenRouter API key found. Please set your API key to enable text extraction.",
    };
  }
  return {
    hasKey: true,
    message: "OpenRouter API key is configured.",
  };
}

// Add this new function to expose API key saving to the main process
export async function saveOpenRouterApiKey(
  apiKey: string,
): Promise<{ success: boolean; message: string }> {
  try {
    if (!apiKey || apiKey.trim() === "") {
      return {
        success: false,
        message: "API key cannot be empty",
      };
    }

    await saveApiKey(apiKey);
    return {
      success: true,
      message: "API key saved successfully",
    };
  } catch (error) {
    console.error("Failed to save API key:", error);
    return {
      success: false,
      message: `Failed to save API key: ${error.message}`,
    };
  }
}
