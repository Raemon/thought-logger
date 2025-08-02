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
