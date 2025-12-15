import {
  type PermissionScope,
  PermissionStatus,
} from "../electron/permissions";
import { Preferences } from "../preferences";
import { Summary } from "./files.d";

declare global {
  interface UserData {
    openUserDataFolder: () => void;
    getUserDataFolder: () => Promise<string>;
    openDebugLogsFolder: () => void;
    getDebugLogsFolder: () => Promise<string>;
    getRecentLogs: () => Promise<Summary[]>;
    getRecentApps: () => Promise<string[]>;
    openFile: (filePath: string) => void;
    openExternalUrl: (url: string) => void;
    readFile: (filePath: string) => Promise<string>;
    generateAISummary: (log: Summary) => Promise<string>;
    onUpdateRecentLogs: (callback: (summaries: Summary[]) => void) => void;
  }

  interface Window {
    preferences: {
      getPreferences: () => Promise<Preferences>;
      setPreferences: (prefs: Partial<Preferences>) => Promise<void>;
    };
    userData: UserData;
    permissions: {
      requestPermissionsStatus: () => Promise<
        Record<PermissionScope, PermissionStatus>
      >;
    };
    errors: {
      getLatestError: () => Promise<string | null>;
      getRecentErrors: () => Promise<string[]>;
      onLatestError: (callback: (message: string) => void) => void;
      onRecentErrors: (callback: (messages: string[]) => void) => void;
    };
    openRouter: {
      checkApiKey: () => Promise<{ hasKey: boolean; message: string }>;
      saveApiKey: (
        apiKey: string,
      ) => Promise<{ success: boolean; message: string }>;
      getAvailableModels: (imageSupport: boolean = false) => Promise<string[]>;
    };
  }
}

export {};
