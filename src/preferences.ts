import fs from "node:fs";
import path from "path";

import { app } from "electron";
import { DEFAULT_PREFERENCES, Preferences } from "./types/preferences";

const userDataPath = app.getPath("userData");
const preferencesPath = path.join(userDataPath, "preferences.json");

export async function savePreferences(
  prefs: Partial<Preferences>,
): Promise<Preferences> {
  const currentPrefs = loadPreferences();
  const newPrefs = { ...currentPrefs, ...prefs };
  await fs.promises.writeFile(
    preferencesPath,
    JSON.stringify(newPrefs, null, 2),
  );
  return newPrefs;
}

export function loadPreferences(): Preferences {
  try {
    const data = fs.readFileSync(preferencesPath, "utf-8");
    const parsed = JSON.parse(data);

    // Migrate screenshotPrompt from object to string if needed
    if (
      parsed.screenshotPrompt &&
      typeof parsed.screenshotPrompt === "object" &&
      parsed.screenshotPrompt.default
    ) {
      parsed.screenshotPrompt = parsed.screenshotPrompt.default;
    }

    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}
