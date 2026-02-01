import React, { useEffect, useState } from "react";
import { DebugPreferences } from "../types/preferences.d";

const DebugSettings = () => {
  const [debugPrefs, setDebugPrefs] = useState<DebugPreferences>({
    loggingEnabled: false,
  });
  const [debugLogDir, setDebugLogDir] = useState<string>();

  useEffect(() => {
    window.preferences.getPreferences().then((prefs) => {
      setDebugPrefs({
        loggingEnabled: prefs.loggingEnabled,
      });
    });
    window.userData.getDebugLogsFolder().then((folder) => {
      setDebugLogDir(folder);
    });
  }, []);

  const handleLoggingEnabledChange = (checked: boolean) => {
    setDebugPrefs({ ...debugPrefs, loggingEnabled: checked });
    window.preferences.setPreferences({ loggingEnabled: checked });
  };

  const openDebugLogDir = () => {
    window.userData.openDebugLogsFolder();
  };

  return (
    <div className="p-5">
      <h3 className="text-xl mb-2.5">Debug Settings</h3>
      <div className="flex items-center mb-2.5">
        <input
          type="checkbox"
          id="log-to-file"
          className="mr-2 h-5 w-5"
          checked={debugPrefs.loggingEnabled}
          onChange={(e) => handleLoggingEnabledChange(e.target.checked)}
        />
        <label htmlFor="log-to-file" className="text-lg">
          Log to file
        </label>
      </div>

      <button onClick={openDebugLogDir} className="ml-0">
        Open Files Folder
      </button>
      <span className="ml-2 text-xs text-gray-500">{debugLogDir}</span>
    </div>
  );
};

export default DebugSettings;
