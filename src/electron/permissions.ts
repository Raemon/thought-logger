import { app, systemPreferences } from "electron";
import path from "node:path";
import { spawnSync } from "node:child_process";

export type PermissionScope = "screen" | "accessibility" | "inputMonitoring";

export type PermissionStatus =
  | "not-determined"
  | "granted"
  | "denied"
  | "restricted"
  | "unknown";

export function checkPermissions(): Record<PermissionScope, PermissionStatus> {
  if (process.platform === "darwin") {
    const binaryPath = app.isPackaged
      ? path.join(process.resourcesPath, "MacKeyServer")
      : path.join(app.getAppPath(), "bin", "MacKeyServer");
    const inputMonitoringCheck = spawnSync(
      binaryPath,
      ["--check-input-monitoring"],
      { timeout: 1500 },
    );
    return {
      // camera: systemPreferences.getMediaAccessStatus("camera"),
      // microphone: systemPreferences.getMediaAccessStatus("microphone"),
      screen: systemPreferences.getMediaAccessStatus("screen"),
      accessibility: systemPreferences.isTrustedAccessibilityClient(false)
      ? "granted"
      : "denied",
      inputMonitoring: inputMonitoringCheck.error
      ? "unknown"
      : inputMonitoringCheck.status === 0
      ? "granted"
      : "denied",
    };
  }

  return {
    // camera: "unknown",
    // microphone: "unknown",
    screen: "unknown",
    accessibility: "unknown",
    inputMonitoring: "unknown",
  };
}
