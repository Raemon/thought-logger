import React, { useEffect, useState } from "react";
import {
  DEFAULT_PREFERENCES,
  ScreenshotPreferences,
} from "../../types/preferences.d";
import TypeaheadDropdown from "./TypeaheadDropdown";

export function ScreenshotController() {
  const [prefs, setPrefs] =
    useState<ScreenshotPreferences>(DEFAULT_PREFERENCES);
  const [newPrompt, setNewPrompt] = useState<{ app: string; prompt: string }>({
    app: "",
    prompt: "",
  });
  const [availableModels, setAvailableModels] = useState<string[]>([
    "loading...", // FIXME
  ]);
  const [recentApplications, setRecentApplications] = useState<string[]>([]);

  useEffect(() => {
    window.preferences.getPreferences().then((prefs) => setPrefs(prefs));
    window.openRouter
      .getAvailableModels(true)
      .then((models: string[]) => setAvailableModels(models));
    window.userData.getRecentApps().then((apps) => setRecentApplications(apps));
  }, []);

  const updatePreferences = async (
    newPrefs: Partial<ScreenshotPreferences>,
  ) => {
    const updatedPrefs = { ...prefs, ...newPrefs };
    setPrefs(updatedPrefs);
    await window.preferences.setPreferences(newPrefs);
  };

  const removePrompt = (app: string) => {
    if (app === "default") return;
    const { [app]: _, ...newPrompts } = prefs.screenshotPrompt;
    updatePreferences({
      screenshotPrompt: {
        // Typescript complains if the "default" key is not explicitly
        // included
        default: prefs.screenshotPrompt.default,
        ...newPrompts,
      },
    });
  };

  const addPrompt = () => {
    if (newPrompt.app && newPrompt.prompt) {
      updatePreferences({
        screenshotPrompt: {
          ...prefs.screenshotPrompt,
          [newPrompt.app]: newPrompt.prompt,
        },
      });
    }
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
        <div className="inline-flex justify-between space-x-4">
          <label>
            Number of words from screenshot description included in daily and
            weekly summaries:
          </label>
          <input
            className="w-12 text-right border-2"
            type="number"
            value={prefs.screenshotSummaryWindow}
            onChange={(event) =>
              updatePreferences({
                screenshotSummaryWindow: Number(event.currentTarget.value),
              })
            }
          />
        </div>
        <div className="inline-flex justify-between space-x-4">
          <label>Text Extraction Model:</label>
          <TypeaheadDropdown
            value={prefs.screenshotModel}
            onChange={(model) => {
              setPrefs({ ...prefs, screenshotModel: model });
              window.preferences.setPreferences({
                screenshotModel: model,
              });
            }}
            items={availableModels}
          />
        </div>
      </div>

      <h3>Screenshot Summary Prompts</h3>

      {Object.keys(prefs.screenshotPrompt).map((app) => (
        <div className="flex w-full gap-5 p-5">
          <div className="self-center">{app}</div>
          <textarea
            className="grow p-2 border-2"
            value={prefs.screenshotPrompt[app]}
            onChange={(event) => {
              updatePreferences({
                screenshotPrompt: {
                  ...prefs.screenshotPrompt,
                  [app]: event.currentTarget.value,
                },
              });
            }}
          />

          <button
            className="border-2 border-red-400 hover:bg-red-400 hover:text-white text-red-400 font-bold rounded ml-2 px-2 py-0.5 text-sm self-center"
            onClick={() => removePrompt(app)}
          >
            Remove
          </button>
        </div>
      ))}

      <div className="flex w-full gap-5">
        <div className="self-center">
          <TypeaheadDropdown
            items={recentApplications}
            value={newPrompt.app}
            onChange={(value) => setNewPrompt({ ...newPrompt, app: value })}
          />
        </div>
        <textarea
          value={newPrompt.prompt}
          onChange={(e) =>
            setNewPrompt({ ...newPrompt, prompt: e.target.value })
          }
          className="grow p-2 border-2 rounded"
          placeholder="Custom prompt"
        />
        <button
          onClick={() => addPrompt()}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold rounded px-2 py-0.5 self-center"
        >
          Add
        </button>
      </div>
    </div>
  );
}
