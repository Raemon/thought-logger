import {
  type PermissionScope,
  PermissionStatus,
} from "../electron/permissions";
import { Preferences } from "./preferences";
import { Summary } from "./files";

declare global {
  interface UserData {
    openUserDataFolder: () => void;
    getUserDataFolder: () => Promise<string>;
    openDebugLogsFolder: () => void;
    getDebugLogsFolder: () => Promise<string>;
    getRecentLogs: () => Promise<Summary[]>;
    getAllLogs: () => Promise<Summary[]>;
    getRecentApps: () => Promise<string[]>;
    openFile: (filePath: string) => void;
    openExternalUrl: (url: string) => void;
    readFile: (filePath: string) => Promise<string>;
    generateAISummary: (log: Summary, loadAll?: boolean) => Promise<string>;
    onUpdateRecentLogs: (callback: (summaries: Summary[]) => void) => () => void;
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
      onLatestError: (callback: (message: string) => void) => () => void;
      onRecentErrors: (callback: (messages: string[]) => void) => () => void;
    };
    credentials: {
      checkSecret: (account: string) => Promise<boolean>;
      saveSecret: (
        account: string,
        secret: string,
      ) => Promise<{ success: boolean; message: string }>;
      changePassword: (
        newPassword: string,
      ) => Promise<{ success: boolean; message: string }>;
    };
    openRouter: {
      getAvailableModels: (imageSupport?: boolean) => Promise<string[]>;
    };
    encryption: {
      countUnencryptedFiles: () => Promise<number>;
      encryptAllFiles: () => Promise<{success: boolean}>;
      onEncryptionProgress: (callback: (progress: {current: number, total: number, fileName: string, percentage: number}) => void) => () => void;
    };
  }
}

export {};
