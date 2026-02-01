import React, { useEffect, useState } from "react";

const BlockedAppsEditor = () => {
  const [blockedApps, setBlockedApps] = useState<string[]>([]);
  const [newApp, setNewApp] = useState<string>("");

  useEffect(() => {
    window.preferences.getPreferences().then((prefs) => {
      setBlockedApps(prefs.blockedApps);
    });
  }, []);

  const addApp = async () => {
    if (newApp.trim() !== "") {
      const updatedApps = [...blockedApps, newApp.trim()];
      setBlockedApps(updatedApps);
      await window.preferences.setPreferences({ blockedApps: updatedApps });

      setNewApp("");
    }
  };

  const removeApp = async (appToRemove: string) => {
    const updatedApps = blockedApps.filter((app) => app !== appToRemove);
    setBlockedApps(updatedApps);
    await window.preferences.setPreferences({ blockedApps: updatedApps });
  };

  return (
    <div className="p-5">
      <h3 className="text-xl mb-2.5">Blocked Apps</h3>
      <table style={{ borderCollapse: "collapse", marginBottom: 16 }}>
        <tbody>
          {blockedApps
            .sort()
            .reverse()
            .map((app) => (
              <tr key={app}>
                <td>{app}</td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="border-2 border-red-400 hover:bg-red-400 hover:text-white text-red-400 font-bold rounded ml-2 px-2 py-0.5 text-sm"
                    onClick={() => removeApp(app)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      <input
        type="text"
        value={newApp}
        onChange={(e) => setNewApp(e.target.value)}
        className="mb-2.5 p-2 border-2 rounded"
        placeholder="Add new app"
      />
      <button
        onClick={addApp}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold rounded ml-2 px-2 py-0.5"
      >
        Add
      </button>
    </div>
  );
};

export default BlockedAppsEditor;
