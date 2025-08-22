import fs from "node:fs/promises";
import path from "path";

import { app } from "electron";
import { DEFAULT_PREFERENCES, Preferences } from "./types/preferences.d";

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
