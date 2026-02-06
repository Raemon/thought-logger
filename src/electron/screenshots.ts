import fs from "node:fs/promises";
import path from "node:path";
import { currentScreenshotFile } from "./paths";
import { Preferences } from "../types/preferences.d";
import { desktopCapturer } from "electron";

import fetch from "node-fetch";
import { loadPreferences } from "../preferences";
import { z } from "zod";
import { getCurrentApplication, isProtectedApp } from "../keylogger";

import logger from "../logging";
import { getSecret } from "./credentials";
import { OPEN_ROUTER } from "../constants/credentials";

const ScreenshotText = z.object({
  windows: z.array(z.object({
    title: z.string().describe("title of the window"),
    applicationName: z.string().describe("name of the application the window is from"),
    url: z.string().describe("url of the window"),
    exactText: z.string().describe("exact text of the window"),
    frames: z.array(z.object({
      title: z.string().describe("title of the frame"),
      exactText: z.string().describe("exact text of the frame"),
    })).describe("frames in the window"),
    images: z.array(z.object({
      description: z.string().describe("description of the image"),
    })).describe("images in the window"),
  })).describe("windows in the screenshot"),
  timestamp: z.string().optional().describe("local timestamp when the summary was captured"),
});

type ScreenshotText = z.infer<typeof ScreenshotText>;

async function extractTextFromImage(
  imageBuffer: Buffer,
  model: string,
  prompt: string,
): Promise<ScreenshotText> {
  logger.debug("Extracting image text");
  const base64Image = imageBuffer.toString("base64");
  const imageUrl = `data:image/jpeg;base64,${base64Image}`;
  try {
    const apiKey = await getSecret(OPEN_ROUTER);
    if (!apiKey) {
      logger.error("API key not found in keychain");
      throw "ERROR: OpenRouter API key is not set. Use setApiKey() to set your API key.";
    }

    const buildRequest = (useSchema: boolean) => ({
      model: model,
      require_parameters: true,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: useSchema
                ? prompt
                : `${prompt}\n\nReturn a JSON object with keys: windows (array of {title, applicationName, url, exactText, frames: [{title, exactText}], images: [{description}]}).`,
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
      ...(useSchema
        ? {
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "screenshot_summary",
                strict: true,
                schema: z.toJSONSchema(ScreenshotText),
              },
            },
          }
        : {}),
    });

    const sendRequest = (useSchema: boolean) =>
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildRequest(useSchema)),
      });

    let response = await sendRequest(true);

    if (!response.ok) {
      let errorData: unknown = null;
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }

      const errorMessage =
        (typeof errorData === "object" &&
        errorData !== null &&
        "error" in errorData &&
        typeof errorData.error === "object" &&
        errorData.error !== null &&
        "message" in errorData.error
          ? errorData.error.message
          : null) || `${errorData}`;

      const structuredOutputUnsupported =
        typeof errorMessage === "string" &&
        errorMessage.toLowerCase().includes("json mode is not enabled");

      if (structuredOutputUnsupported) {
        logger.warn(
          "Structured outputs not supported for this model; retrying without JSON schema",
        );
        response = await sendRequest(false);
        if (!response.ok) {
          let retryErrorData: unknown = null;
          try {
            retryErrorData = await response.json();
          } catch {
            retryErrorData = await response.text();
          }
          throw new Error(
            `API request failed: ${response.status} ${JSON.stringify(retryErrorData)}`,
          );
        }
      } else {
        throw new Error(
          `API request failed: ${response.status} ${JSON.stringify(errorData)}`,
        );
      }
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    const result = JSON.parse(data.choices[0].message.content);
    return ScreenshotText.parse(result);
  } catch (error) {
    logger.error("Failed to extract text from image:", error);

    if (error instanceof Error) {
      throw `ERROR: Failed to extract text: ${error.message}`;
    } else {
      throw error;
    }
  }
}

export async function parseScreenshot(
  img: Buffer,
  imgPath: string,
  currentApplication: string,
): Promise<void> {
  logger.debug(`Parsing screenshot at ${imgPath}`);
  // Extract and save text
  const { screenshotModel, screenshotPrompt, blockedApps } = loadPreferences();
  const prompt =
    screenshotPrompt[currentApplication] || screenshotPrompt.default;

  try {
    const extractedText = await extractTextFromImage(
      img,
      screenshotModel,
      prompt,
    );
    for (const window of extractedText.windows) {
      if (isProtectedApp(window.applicationName, blockedApps)) {
        window.exactText = "skipped";
        window.frames = [];
        window.images = [];
      }
    }
    extractedText.timestamp = new Date().toLocaleString();
    const firstWindow = extractedText.windows[0];
    const encodedApp = encodeURIComponent(currentApplication);
    const encodedTitle = firstWindow
      ? encodeURIComponent(firstWindow.title.slice(0, 50))
      : "unknown";
    const jsonFilePath = imgPath.replace(
      ".jpg",
      `.${encodedApp}.${encodedTitle}.json`,
    );
    await fs.writeFile(jsonFilePath, JSON.stringify(extractedText, null, 2));
  } catch (error) {
    logger.error(`Failed to extract text from ${imgPath}:`, error);
  }
}

async function takeScreenshot(quality: number) {
  logger.debug("Taking screenshot");
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1920, height: 1080 },
    });
    const img = sources[0].thumbnail.toJPEG(quality);
    const currentApplication = getCurrentApplication();
    const filePath = currentScreenshotFile();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, img);

    await parseScreenshot(img, filePath, currentApplication);

    const { screenshotTemporary } = loadPreferences();

    if (screenshotTemporary) {
      // Delete screenshot when we're done extracting.
      await fs.unlink(filePath);
    }
  } catch (e) {
    logger.error(`Failed to process screenshot: ${e}`);
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
