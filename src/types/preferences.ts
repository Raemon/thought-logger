import {
  DEFAULT_SCREENSHOT_PROMPT,
  DEFAULT_DAILY_SUMMARY_PROMPT,
  DEFAULT_WEEKLY_SUMMARY_PROMPT,
} from "../constants/prompts";

export interface ScreenshotPreferences {
  screenshotActive: boolean;
  screenshotPeriod: number;
  screenshotQuality: number;
  screenshotTemporary: boolean;
  screenshotModel: string;
  screenshotPrompt: string;
  screenshotSummaryWindow: number;
}

export interface SummaryPreferences {
  dailySummaryPrompt: string;
  weeklySummaryPrompt: string;
  summaryModel: string;
}

export interface DebugPreferences {
  loggingEnabled: boolean;
}

export interface Preferences
  extends ScreenshotPreferences, SummaryPreferences, DebugPreferences {
  blockedApps: string[];
  encryptionEnabled: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  screenshotActive: true,
  screenshotPeriod: 60 * 4,
  screenshotQuality: 35,
  screenshotTemporary: false,
  screenshotModel: "openai/gpt-4o-mini",
  screenshotPrompt: DEFAULT_SCREENSHOT_PROMPT,
  screenshotSummaryWindow: 300,
  encryptionEnabled: true,
  blockedApps: [
    "Signal",
    "Signal Desktop",
    "Messenger",
    "Messages",
    "WhatsApp",
    "Slack",
  ],
  dailySummaryPrompt: DEFAULT_DAILY_SUMMARY_PROMPT,
  weeklySummaryPrompt: DEFAULT_WEEKLY_SUMMARY_PROMPT,
  summaryModel: "anthropic/claude-3.5-sonnet", // TODO: select this from the available models
  loggingEnabled: true,
};
