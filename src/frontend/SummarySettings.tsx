import React, { useEffect, useState } from "react";

import {
  SummaryPreferences,
  DEFAULT_PREFERENCES,
} from "../types/preferences.d";
import TypeaheadDropdown from "./TypeaheadDropdown";

const SummarySettings = () => {
  const [summaryPrefs, setSummaryPrefs] = useState<SummaryPreferences>({
    summaryModel: DEFAULT_PREFERENCES.summaryModel,
    dailySummaryPrompt: DEFAULT_PREFERENCES.dailySummaryPrompt,
    weeklySummaryPrompt: DEFAULT_PREFERENCES.weeklySummaryPrompt,
  });
  const [availableModels, setAvailableModels] = useState<string[]>([
    "loading...", // FIXME
  ]);

  useEffect(() => {
    window.preferences.getPreferences().then((prefs) => {
      setSummaryPrefs({
        summaryModel: prefs.summaryModel,
        dailySummaryPrompt: prefs.dailySummaryPrompt,
        weeklySummaryPrompt: prefs.weeklySummaryPrompt,
      });
    });

    window.openRouter
      .getAvailableModels()
      .then((models) => setAvailableModels(models));
  }, []);

  return (
    <div className="p-5">
      <h3 className="text-xl mb-2.5">Summary Settings</h3>

      <label htmlFor="daily-prompt" className="block text-lg my-2.5">
        Daily Summary prompt
      </label>
      <textarea
        id="daily-prompt"
        className="block mb-2.5 p-2 border-2 rounded w-full"
        onChange={(e) => {
          setSummaryPrefs({
            ...summaryPrefs,
            dailySummaryPrompt: e.target.value,
          });
          window.preferences.setPreferences({
            dailySummaryPrompt: e.target.value,
          });
        }}
        value={summaryPrefs.dailySummaryPrompt}
      />

      <label htmlFor="weekly-prompt" className="block text-lg my-2.5">
        Weekly Summary prompt
      </label>

      <textarea
        id="weekly-prompt"
        className="block mb-2.5 p-2 border-2 rounded w-full"
        onChange={(e) => {
          setSummaryPrefs({
            ...summaryPrefs,
            weeklySummaryPrompt: e.target.value,
          });
          window.preferences.setPreferences({
            weeklySummaryPrompt: e.target.value,
          });
        }}
        value={summaryPrefs.weeklySummaryPrompt}
      />

      <label htmlFor="summary-model" className="block text-lg my-2.5">
        Summary model
      </label>
      <TypeaheadDropdown
        value={summaryPrefs.summaryModel}
        onChange={(model) => {
          setSummaryPrefs({ ...summaryPrefs, summaryModel: model });
          window.preferences.setPreferences({
            summaryModel: model,
          });
        }}
        items={availableModels}
      />
    </div>
  );
};

export default SummarySettings;
