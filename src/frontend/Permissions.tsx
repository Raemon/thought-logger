import React, { useCallback, useEffect, useState } from "react";

function usePermissions() {
  const [perm, setPerm] = useState<Record<string, string> | null>(null);

  const refreshPermissions = useCallback(() => {
    window.permissions
      .requestPermissionsStatus()
      .then((permissions) => setPerm(permissions));
  }, []);

  useEffect(() => {
    refreshPermissions();
  }, []);

  return [perm, refreshPermissions] as const;
}

export function Permissions() {
  const [perm, refreshPermissions] = usePermissions();
  return (
    <div className="p-5">
      <h3 className="text-xl mb-2.5">Permissions</h3>
      {perm &&
        Object.entries(perm).map(([k, v]) => (
          <div key={k} style={{ textTransform: "capitalize" }}>
            {k}:{" "}
            {v === "granted" ? (
              <span style={{ color: "#0a0" }}>granted</span>
            ) : (
              <span style={{ color: "#a00" }}>denied</span>
            )}
          </div>
        ))}
      <div style={{ fontSize: 12, marginTop: 12, marginBottom: 12 }}>
        <em>
          Keylogging requires both "accessibility" and "input monitoring"
          permissions in the <b>System Preferences: Privacy & Security</b>.
        </em>
      </div>
      <button
        onClick={refreshPermissions}
        style={{ marginTop: 12 }}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold rounded px-2 py-0.5"
      >
        Refresh
      </button>
    </div>
  );
}
