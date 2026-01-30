import "source-map-support/register";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import fs from "node:fs/promises";
import started from "electron-squirrel-startup";
import { initializeKeylogger, updateKeyloggerPreferences } from "./keylogger";
import { checkPermissions } from "./electron/permissions";
import { savePreferences, loadPreferences } from "./preferences";
import { Preferences } from "./types/preferences.d";
import { toggleScheduledScreenshots } from "./electron/screenshots";
import { startLocalServer } from "./electron/server";
import {
  startDailySummaryCheck,
  getAvailableModels,
  summarize,
} from "./electron/summarizer";
import { Summary } from "./types/files.d";
import { setDefaultOptions, isEqual } from "date-fns";
import logger, {
  getLatestError,
  getRecentErrors,
  logToFile,
  onLatestError,
  onRecentErrors,
  updateDebugPreferences,
} from "./logging";
import { getRecentApps, getRecentSummaries } from "./electron/files";
import {
  getSecret,
  OPEN_ROUTER,
  LOG_FILE_ENCRYPTION,
  saveSecret,
} from "./electron/credentials";
import { readEncryptedFile } from "./electron/paths";
setDefaultOptions({ weekStartsOn: 1 });

const userDataPath = app.getPath("userData");
const debugLogsPath = app.getPath("logs");

const filesPath = path.join(userDataPath, "files");
const screenshotFolder = path.join(userDataPath, "files", "screenshots");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", function () {
  logToFile(debugLogsPath);
  createWindow();
  const prefs = loadPreferences();
  updateDebugPreferences(prefs);
  toggleScheduledScreenshots(prefs);
  startLocalServer();
  startDailySummaryCheck();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

initializeKeylogger();

ipcMain.handle("REQUEST_PERMISSIONS_STATUS", () => {
  return checkPermissions();
});

ipcMain.handle("GET_LATEST_ERROR", () => getLatestError());
ipcMain.handle("GET_RECENT_ERRORS", () => getRecentErrors());
onLatestError((message) => {
  BrowserWindow.getAllWindows().forEach((win) =>
    win.webContents.send("LATEST_ERROR", message),
  );
});
onRecentErrors((messages) => {
  BrowserWindow.getAllWindows().forEach((win) =>
    win.webContents.send("RECENT_ERRORS", messages),
  );
});

ipcMain.handle("GET_USER_DATA_FOLDER", () => {
  return filesPath;
});

ipcMain.on("OPEN_USER_DATA_FOLDER", async () => {
  await fs.mkdir(screenshotFolder, { recursive: true });
  shell.openPath(filesPath);
});

ipcMain.handle("GET_DEBUG_LOGS_FOLDER", () => {
  return debugLogsPath;
});

ipcMain.on("OPEN_DEBUG_LOGS_FOLDER", () => {
  shell.openPath(debugLogsPath);
});

ipcMain.handle;

ipcMain.handle("GET_PREFERENCES", () => loadPreferences());

ipcMain.handle(
  "SET_PREFERENCES",
  async (_event, prefs: Partial<Preferences>) => {
    const newPrefs = await savePreferences(prefs);
    toggleScheduledScreenshots(newPrefs);
    updateKeyloggerPreferences(newPrefs);
    updateDebugPreferences(newPrefs);
  },
);

ipcMain.on("OPEN_FILE", (_event, filePath) => {
  shell.openPath(filePath);
});

ipcMain.on("OPEN_EXTERNAL_URL", (_event, url) => {
  shell.openExternal(url).catch((err) => {
    logger.error("Failed to open external URL:", err);
  });
});

ipcMain.handle("CHECK_SECRET", (_event, account: string) => {
  return getSecret(account);
});

ipcMain.handle("SAVE_SECRET", (_event, account: string, secret: string) => {
  return saveSecret(account, secret);
});

ipcMain.handle("GET_AVAILABLE_MODELS", (_event, imageSupport) =>
  getAvailableModels(imageSupport),
);

ipcMain.handle("READ_FILE", async (_event, filePath: string) => {
  try {
    const content = await readEncryptedFile(filePath);
    return content;
  } catch (error) {
    logger.error("Failed to read file:", error);
    throw error;
  }
});

ipcMain.handle("GENERATE_AI_SUMMARY", async (_event, summary: Summary) => {
  const oldLogs = await getRecentSummaries();
  for (const i in oldLogs) {
    const { date, scope } = oldLogs[i];
    if (isEqual(date, summary.date) && scope === summary.scope) {
      oldLogs[i].loading = true;
    }
  }
  updateSummaries(oldLogs);
  await summarize(summary);
  const newLogs = await getRecentSummaries();
  updateSummaries(newLogs);
});

function updateSummaries(summaries: Summary[]): void {
  BrowserWindow.getAllWindows().forEach((win) =>
    win.webContents.send("UPDATE_RECENT_LOGS", summaries),
  );
}

ipcMain.handle("GET_RECENT_LOGS", async () => {
  return getRecentSummaries().then((summaries) =>
    summaries.filter((summary) => summary.contents),
  );
});

ipcMain.handle("GET_RECENT_APPS", getRecentApps);
