import React, { useEffect, useState } from "react";
import { DEFAULT_PREFERENCES, ScreenshotPreferences } from "../preferences";

export function ScreenshotController() {
  const [prefs, setPrefs] =
    useState<ScreenshotPreferences>(DEFAULT_PREFERENCES);

  const updatePreferences = async (
    newPrefs: Partial<ScreenshotPreferences>,
  ) => {
    const updatedPrefs = { ...prefs, ...newPrefs };
    setPrefs(updatedPrefs);
    await window.preferences.setPreferences(newPrefs);
  };

  return (
    <div className="p-5">
      <h3 className="text-xl mb-2.5">Screenshots</h3>
      <div className="inline-flex flex-col w-fit gap-y-2.5">
        <div className="inline-flex justify-between">
          <label>Automatic screenshots:</label>
          <input
            type="checkbox"
            checked={prefs.screenshotActive}
            onChange={(event) =>
              updatePreferences({
                screenshotActive: event.currentTarget.checked,
              })
            }
          />
        </div>
        <div className="inline-flex justify-between">
          <label>Delete screenshots after summarizing:</label>
          <input
            type="checkbox"
            checked={prefs.screenshotTemporary}
            onChange={(event) =>
              updatePreferences({
                screenshotTemporary: event.currentTarget.checked,
              })
            }
          />
        </div>
        <div className="inline-flex justify-between space-x-4">
          <label>Screenshot quality (0–100):</label>
          <input
            className="w-12 text-right border-2 rounded p-1"
            type="text"
            value={prefs.screenshotQuality}
            onChange={(event) =>
              updatePreferences({
                screenshotQuality: Number(event.currentTarget.value),
              })
            }
          />
        </div>
        <div className="inline-flex justify-between space-x-4">
          <label>Interval between screenshots (seconds):</label>
          <input
            className="w-12 text-right border-2"
            type="text"
            value={prefs.screenshotPeriod}
            onChange={(event) =>
              updatePreferences({
                screenshotPeriod: Number(event.currentTarget.value),
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
