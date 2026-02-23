import {
  DEFAULT_SCREENSHOT_PROMPT,
} from "../constants/prompts";

export interface ScreenshotPreferences {
  screenshotActive: boolean;
  screenshotPeriod: number;
  screenshotQuality: number;
  screenshotTemporary: boolean;
  screenshotModel: string;
  screenshotPrompt: string;
}

export interface DebugPreferences {
  loggingEnabled: boolean;
}

export interface Preferences
  extends ScreenshotPreferences, DebugPreferences {
  blockedApps: string[];
  encryptionEnabled: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  screenshotActive: true,
  screenshotPeriod: 60 * 4,
  screenshotQuality: 35,
  screenshotTemporary: false,
  screenshotModel: "google/gemini-2.5-flash",
  screenshotPrompt: DEFAULT_SCREENSHOT_PROMPT,
  encryptionEnabled: true,
  blockedApps: [
    "Signal",
    "Signal Desktop",
  ],
  loggingEnabled: true,
};
