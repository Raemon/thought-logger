import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import { Preferences } from "./types/preferences";

contextBridge.exposeInMainWorld("permissions", {
  requestPermissionsStatus: () =>
    ipcRenderer.invoke("REQUEST_PERMISSIONS_STATUS"),
});

contextBridge.exposeInMainWorld("errors", {
  getLatestError: () => ipcRenderer.invoke("GET_LATEST_ERROR"),
  getRecentErrors: () => ipcRenderer.invoke("GET_RECENT_ERRORS"),
  onLatestError: (callback: (message: string) => void) => {
    const handler = (_event: IpcRendererEvent, message: string) =>
      callback(message);
    ipcRenderer.on("LATEST_ERROR", handler);
    return () => ipcRenderer.removeListener("LATEST_ERROR", handler);
  },
  onRecentErrors: (callback: (messages: string[]) => void) => {
    const handler = (_event: IpcRendererEvent, messages: string[]) =>
      callback(messages);
    ipcRenderer.on("RECENT_ERRORS", handler);
    return () => ipcRenderer.removeListener("RECENT_ERRORS", handler);
  },
});

const userData: UserData = {
  openUserDataFolder: () => ipcRenderer.send("OPEN_USER_DATA_FOLDER"),
  getUserDataFolder: () => ipcRenderer.invoke("GET_USER_DATA_FOLDER"),
  openDebugLogsFolder: () => ipcRenderer.send("OPEN_DEBUG_LOGS_FOLDER"),
  getDebugLogsFolder: () => ipcRenderer.invoke("GET_DEBUG_LOGS_FOLDER"),
  openFile: (path: string) => ipcRenderer.send("OPEN_FILE", path),
  openExternalUrl: (url: string) => ipcRenderer.send("OPEN_EXTERNAL_URL", url),
  readFile: (path: string) => ipcRenderer.invoke("READ_FILE", path),
};

contextBridge.exposeInMainWorld("userData", userData);

contextBridge.exposeInMainWorld("preferences", {
  getPreferences: () => ipcRenderer.invoke("GET_PREFERENCES"),
  setPreferences: (prefs: Partial<Preferences>) =>
    ipcRenderer.invoke("SET_PREFERENCES", prefs),
});

contextBridge.exposeInMainWorld("credentials", {
  checkSecret: (account: string) => ipcRenderer.invoke("CHECK_SECRET", account),
  saveSecret: (account: string, secret: string) =>
    ipcRenderer.invoke("SAVE_SECRET", account, secret),
  changePassword: (newPassword: string) =>
    ipcRenderer.invoke("CHANGE_PASSWORD", newPassword),
});

contextBridge.exposeInMainWorld("openRouter", {
  getAvailableModels: (imageSupport = false) =>
    ipcRenderer.invoke("GET_AVAILABLE_MODELS", imageSupport),
});

contextBridge.exposeInMainWorld("encryption", {
  countUnencryptedFiles: () => ipcRenderer.invoke("COUNT_UNENCRYPTED_FILES"),
  encryptAllFiles: () => ipcRenderer.invoke("ENCRYPT_ALL_FILES"),
  onEncryptionProgress: (callback: (progress: {current: number, total: number, fileName: string, percentage: number}) => void) => {
    const handler = (_event: IpcRendererEvent, progress: {current: number, total: number, fileName: string, percentage: number}) =>
      callback(progress);
    ipcRenderer.on("ENCRYPTION_PROGRESS", handler);
    return () => ipcRenderer.removeListener("ENCRYPTION_PROGRESS", handler);
  },
});

interface UserData {
  openUserDataFolder: () => void;
  getUserDataFolder: () => Promise<string>;
  openDebugLogsFolder: () => void;
  getDebugLogsFolder: () => Promise<string>;
  openFile: (path: string) => void;
  openExternalUrl: (url: string) => void;
  readFile: (path: string) => Promise<string>;
}
