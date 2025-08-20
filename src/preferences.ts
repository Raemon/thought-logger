import fs from "node:fs/promises";
import path from "path";

import { app } from "electron";

export interface ScreenshotPreferences {
  screenshotActive: boolean;
  screenshotPeriod: number;
  screenshotQuality: number;
  screenshotTemporary: boolean;
  screenshotModel: string;
  screenshotPrompt: {
    default: string;
    [model: string]: string;
  };
}

export interface SummaryPreferences {
  dailySummaryPrompt: string;
  weeklySummaryPrompt: string;
  summaryModel: string;
}

export interface Preferences extends ScreenshotPreferences, SummaryPreferences {
  blockedApps: string[];
}

export const DEFAULT_PREFERENCES: Preferences = {
  screenshotActive: true,
  screenshotPeriod: 60 * 4,
  screenshotQuality: 35,
  screenshotTemporary: false,
  screenshotModel: "google/gemini-2.5-flash",
  screenshotPrompt: {
    default:
      "Summarize the contents of this screenshot. Include the application is in use, project names, filename or document title. If a chat app is in use, give the channel name. Include each section of the screen with text in it, with an exact copy of all text. Include a summary of images on the screen. Organize the summary into titled sections.",
  },
  blockedApps: [
    "Signal",
    "Signal Desktop",
    "Messenger",
    "Messages",
    "WhatsApp",
    "Slack",
  ],
  dailySummaryPrompt:
    "Please analyze this computer activity log and summarize the major projects and tasks worked on:",
  weeklySummaryPrompt:
    "Please analyze this computer activity log and summarize the major projects and tasks worked on:",
  summaryModel: "anthropic/claude-3.5-sonnet", // TODO select this from the available models
};

const userDataPath = app.getPath("userData");
const preferencesPath = path.join(userDataPath, "preferences.json");

export async function savePreferences(
  prefs: Partial<Preferences>,
): Promise<Preferences> {
  const currentPrefs = await loadPreferences();
  const newPrefs = { ...currentPrefs, ...prefs };
  await fs.writeFile(preferencesPath, JSON.stringify(newPrefs, null, 2));
  return newPrefs;
}

export async function loadPreferences(): Promise<Preferences> {
  try {
    const data = await fs.readFile(preferencesPath, "utf-8");
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(data) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}
