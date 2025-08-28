import fs from "node:fs/promises";
import path from "node:path";
import { currentScreenshotFile } from "./paths";
import { Preferences } from "../types/preferences.d";
import { desktopCapturer, app, systemPreferences } from "electron";

import fetch from "node-fetch";
import { loadPreferences } from "../preferences";
import { z } from "zod";
import { getCurrentApplication } from "../keylogger";

import log from "../logging";
import { getApiKey } from "./credentials";

const ScreenshotText = z.object({
  project: z
    .string()
    .describe("name of the project the user is currently working on"),
  document: z.string().describe("name of the document the user has open"),
  summary: z.string().describe("summary of the screenshot"),
});

type ScreenshotText = z.infer<typeof ScreenshotText>;

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
      log.error("API key not found in keychain");
      throw "ERROR: OpenRouter API key is not set. Use setApiKey() to set your API key.";
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
    log.error("Failed to extract text from image:", error);
    throw `ERROR: Failed to extract text: ${error.message}`;
  }
}

export async function parseScreenshot(
  img: Buffer,
  imgPath: string,
  currentApplication: string,
): Promise<void> {
  // Extract and save text
  const { screenshotModel, screenshotPrompt } = await loadPreferences();
  const prompt =
    screenshotPrompt[currentApplication] || screenshotPrompt.default;

  try {
    const extractedText = await extractTextFromImage(
      img,
      screenshotModel,
      prompt,
    );
    const { project, document } = extractedText;
    const encodedProject = encodeURIComponent(project);
    const encodedDocument = encodeURIComponent(document);
    const textFilePath = imgPath.replace(".jpg", `.${encodedProject}.${encodedDocument}.txt`);

    await fs.writeFile(textFilePath, extractedText.summary);
  } catch (error) {
    log.error(`Failed to extract text from ${imgPath}:`, error);
  }
}

async function takeScreenshot(quality: number) {
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

    const { screenshotTemporary } = await loadPreferences();

    if (screenshotTemporary) {
      // Delete screenshot when we're done extracting.
      await fs.unlink(filePath);
    }
  } catch (e) {
    log.error(`Failed to process screenshot: ${e}`);
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
