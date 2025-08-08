import { contextBridge, ipcRenderer } from "electron";
import { Preferences } from "./preferences";
import { SerializedLog } from "./types/files";

contextBridge.exposeInMainWorld("permissions", {
  requestPermissionsStatus: () =>
    ipcRenderer.invoke("REQUEST_PERMISSIONS_STATUS"),
});

const userData: UserData = {
  openUserDataFolder: () => ipcRenderer.send("OPEN_USER_DATA_FOLDER"),
  getUserDataFolder: () => ipcRenderer.invoke("GET_USER_DATA_FOLDER"),
  openFile: (path: string) => ipcRenderer.send("OPEN_FILE", path),
  openExternalUrl: (url: string) => ipcRenderer.send("OPEN_EXTERNAL_URL", url),
  readFile: (path: string) => ipcRenderer.invoke("READ_FILE", path),
  generateAISummary: (log: SerializedLog) =>
    ipcRenderer.invoke("GENERATE_AI_SUMMARY", log),
  getRecentLogs: () => ipcRenderer.invoke("GET_RECENT_LOGS"),
  getRecentApps: () => ipcRenderer.invoke("GET_RECENT_APPS"),
  onUpdateRecentLogs: (callback: (logs: SerializedLog[]) => void) =>
    ipcRenderer.on("UPDATE_RECENT_LOGS", (_event, logs) => callback(logs)),
};
contextBridge.exposeInMainWorld("userData", userData);

contextBridge.exposeInMainWorld("preferences", {
  getPreferences: () => ipcRenderer.invoke("GET_PREFERENCES"),
  setPreferences: (prefs: Partial<Preferences>) =>
    ipcRenderer.invoke("SET_PREFERENCES", prefs),
});

contextBridge.exposeInMainWorld("openRouter", {
  checkApiKey: () => ipcRenderer.invoke("CHECK_API_KEY"),
  saveApiKey: (apiKey: string) => ipcRenderer.invoke("SAVE_API_KEY", apiKey),
  getAvailableModels: (imageSupport: boolean = false) =>
    ipcRenderer.invoke("GET_AVAILABLE_MODELS", imageSupport),
});
