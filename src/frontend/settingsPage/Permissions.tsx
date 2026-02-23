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
  const [perm, _refreshPermissions] = usePermissions();
  const permissionRows = [
    {
      key: "screen",
      label: "Screen Recording",
      settingsUrl:
        "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
    },
    {
      key: "accessibility",
      label: "Accessibility",
      settingsUrl:
        "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
    },
    {
      key: "inputMonitoring",
      label: "Input Monitoring",
      settingsUrl:
        "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent",
    },
  ];
  return (
    <div className="p-5 py-0">
      <h3 className="text-xl mb-2.5">Permissions</h3>
      <div className="flex gap-4">
        {perm &&
          permissionRows.map(({ key, label, settingsUrl }) => {
            const status = perm[key] || "unknown";
            const statusLabel =
              status === "granted" ? "Enabled" : status === "denied" ? "Enable" : status;
            return <div
              key={key}
              onClick={() => window.userData.openExternalUrl(settingsUrl)}
              className="cursor-pointer border border-gray-300 rounded-md px-3 py-1.5"
              style={{ color: status === "granted" ? "#0a0" : "#000" }}
            >
              {statusLabel} {label}
            </div>
          })}
        </div>
    </div>
  );
}
