import { app } from "electron";
import path from "node:path";
import {
  GlobalKeyboardListener,
  IGlobalKeyDownMap,
  IGlobalKeyEvent,
} from "node-global-key-listener";
import { loadPreferences } from "./preferences";
import { Preferences } from "./types/preferences";
import logger from "./logging";
import { insertLogEvent } from "./electron/logeventsDb";
import { parseApplicationActivatedRaw } from "./keyloggerAppSwitch";

const BINARY_NAME = "MacKeyServer";

const binaryPath = app.isPackaged
  ? path.join(process.resourcesPath, BINARY_NAME)
  : path.join(app.getAppPath(), "bin", BINARY_NAME);

const keylogger = new GlobalKeyboardListener({
  mac: { serverPath: binaryPath },
});

// Track current application and text buffers per application
let currentApplication = "";
let currentWindowTitle = "";
const applicationBuffers = new Map<string, string>();

// Track if we should skip the next typed character (immediately after a modifier)
let skipNext = false;

/** Map key name to [character without shift key, character with shift key] */
const KEY_MAP = new Map<string, [string, string]>([
  ["SPACE", [" ", " "]],
  ["BACKSPACE", ["⌫", "⌫"]],
  ["RETURN", ["\n", "\n"]],
  ["TAB", ["↹", "↹"]],
  ["LEFT ARROW", ["←", "←"]],
  ["RIGHT ARROW", ["→", "→"]],
  ["UP ARROW", ["↑", "↑"]],
  ["DOWN ARROW", ["↓", "↓"]],
  ["ESCAPE", ["⎋", "⎋"]],
  ["1", ["1", "!"]],
  ["2", ["2", "@"]],
  ["3", ["3", "#"]],
  ["4", ["4", "$"]],
  ["5", ["5", "%"]],
  ["6", ["6", "^"]],
  ["7", ["7", "&"]],
  ["8", ["8", "*"]],
  ["9", ["9", "("]],
  ["0", ["0", ")"]],
  ["MINUS", ["-", "_"]],
  ["EQUALS", ["=", "+"]],
  ["SQUARE BRACKET CLOSE", ["[", "{"]],
  ["SQUARE BRACKET OPEN", ["]", "}"]],
  ["BACKSLASH", ["\\", "|"]],
  ["SEMICOLON", [";", ":"]],
  ["QUOTE", ["'", '"']],
  ["COMMA", [",", "<"]],
  ["DOT", [".", ">"]],
  ["FORWARD SLASH", ["/", "?"]],
  ["BACKTICK", ["`", "~"]],
  ["SECTION", ["§", "±"]],
]);

interface ParsedKey {
  raw: string;
  processed: string;
  isAppSwitch: boolean;
}

let preferences: Preferences;

/** Checks if the current application is a protected messaging app */
export function isProtectedApp(
  appName: string,
  blockedApps: string[],
): boolean {
  return blockedApps.some((app) =>
    appName.trim().toLowerCase().includes(app.trim().toLowerCase()),
  );
}

/** Formats the current timestamp in the required format */
function getFormattedTimestamp(): { dateStr: string; timeStr: string } {
  const now = new Date();
  return {
    dateStr: now.toLocaleDateString("en-CA"),
    timeStr: now
      .toLocaleTimeString("en-CA", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
      .replace(/:/g, "."),
  };
}

/** Handles application switch events */
function handleAppSwitch(appName: string, windowTitle = ""): ParsedKey {
  const { dateStr, timeStr } = getFormattedTimestamp();

  currentApplication = appName;
  currentWindowTitle = windowTitle;
  if (!applicationBuffers.has(appName)) {
    applicationBuffers.set(appName, "");
  }

  return {
    raw: `\n${dateStr} ${timeStr}: ${appName}\n`,
    processed: "",
    isAppSwitch: true,
  };
}

/** Builds modifier key string based on current key state */
function getModifierString(down: IGlobalKeyDownMap): string {
  let modifiers = "";
  if (down["LEFT CTRL"] || down["RIGHT CTRL"]) modifiers += "⌃";
  if (down["LEFT META"] || down["RIGHT META"]) modifiers += "⌘";
  if (down["LEFT ALT"] || down["RIGHT ALT"]) modifiers += "⌥";
  return modifiers;
}

/** Process a regular keypress event */
function processKeyPress(
  event: IGlobalKeyEvent,
  down: IGlobalKeyDownMap,
): ParsedKey {
  const isShift = down["LEFT SHIFT"] || down["RIGHT SHIFT"];
  const key = getModifierString(down);

  // Handle modifier-only keypresses, but don't skip for Shift
  if (
    event.name?.includes("CTRL") ||
    event.name?.includes("META") ||
    event.name?.includes("ALT")
  ) {
    skipNext = true;
    return { raw: key, processed: "", isAppSwitch: false };
  }

  // Handle shift key presses without affecting the next character
  if (event.name?.includes("SHIFT")) {
    return { raw: key, processed: "", isAppSwitch: false };
  }

  if (skipNext) {
    skipNext = false;
    return { raw: key, processed: "", isAppSwitch: false };
  }

  const isSpecialKey = [
    "LEFT ARROW",
    "RIGHT ARROW",
    "UP ARROW",
    "DOWN ARROW",
    "TAB",
    "ESCAPE",
    "SECTION",
    "LEFT CTRL",
    "RIGHT CTRL",
    "LEFT META",
    "RIGHT META",
    "LEFT ALT",
    "RIGHT ALT",
    "LEFT SHIFT",
    "RIGHT SHIFT",
  ].includes(event.name || "");

  return processKeyCharacter(event, !!isShift, key, isSpecialKey);
}

/** Process a single character keypress */
function processKeyCharacter(
  event: IGlobalKeyEvent,
  isShift: boolean,
  key: string,
  isSpecialKey: boolean,
): ParsedKey {
  let shouldLog = false;
  let shouldProcessLog = false;

  if (KEY_MAP.has(event.name || "")) {
    const mappedChars = KEY_MAP.get(event.name || "");
    if (!mappedChars) return { raw: "", processed: "", isAppSwitch: false };

    key += event.name === "RETURN" ? "⏎" : mappedChars[isShift ? 1 : 0];
    shouldLog = true;
    shouldProcessLog = !isSpecialKey && event.name !== "BACKSPACE";
  } else if ((event.name || "").length === 1) {
    key += isShift
      ? (event.name || "").toUpperCase()
      : (event.name || "").toLowerCase();
    shouldLog = true;
    shouldProcessLog = true;
  }

  if (!shouldLog) return { raw: "", processed: "", isAppSwitch: false };

  return handleBufferUpdate(event, isShift, key, shouldProcessLog);
}

/** Update application buffer and return processed key */
function handleBufferUpdate(
  event: IGlobalKeyEvent,
  isShift: boolean,
  key: string,
  shouldProcessLog: boolean,
): ParsedKey {
  let processedKey = "";
  const currentBuffer = applicationBuffers.get(currentApplication) || "";

  if (event.name === "BACKSPACE") {
    applicationBuffers.set(currentApplication, currentBuffer.slice(0, -1));
  } else if (shouldProcessLog) {
    let keyToAdd;
    if (KEY_MAP.has(event.name || "")) {
      const [unshifted, shifted] = KEY_MAP.get(event.name || "") || ["", ""];
      keyToAdd = isShift ? shifted : unshifted;
    } else {
      keyToAdd = isShift
        ? (event.name || "").toUpperCase()
        : (event.name || "").toLowerCase();
    }
    applicationBuffers.set(currentApplication, currentBuffer + keyToAdd);
    processedKey = keyToAdd;
  }

  return { raw: key, processed: processedKey, isAppSwitch: false };
}

function parseKeyEvent(
  event: IGlobalKeyEvent,
  down: IGlobalKeyDownMap,
): ParsedKey {
  // Handle application switch
  if (event._raw.includes("Application activated")) {
    const parsed = parseApplicationActivatedRaw(event._raw);
    if (!parsed) return { raw: "", processed: "", isAppSwitch: false };
    return handleAppSwitch(parsed.appName, parsed.windowTitle);
  }

  // Don't log keys if in protected apps
  if (isProtectedApp(currentApplication, preferences.blockedApps)) {
    return { raw: "", processed: "", isAppSwitch: false };
  }

  if (event.state !== "DOWN") {
    return { raw: "", processed: "", isAppSwitch: false };
  }

  return processKeyPress(event, down);
}

let dbBufferedText = "";
let dbBufferedApplicationName = "";
let dbBufferedWindowTitle = "";
let timer: NodeJS.Timeout;
let initialized = false;

function flushDbBuffer(): void {
  if (!dbBufferedText) return;
  const keystrokes = dbBufferedText;
  const applicationName = dbBufferedApplicationName || currentApplication || "Unknown";
  const windowTitle = dbBufferedWindowTitle || currentWindowTitle || "";
  dbBufferedText = "";
  dbBufferedApplicationName = "";
  dbBufferedWindowTitle = "";
  insertLogEvent({
    timestamp: Date.now(),
    keystrokes,
    applicationName,
    windowTitle,
  }).catch((error) => {
    logger.error("Failed to insert logevent:", error);
  });
}

export async function initializeKeylogger() {
  if (initialized) return;
  initialized = true;
  // Load initial preferences
  preferences = loadPreferences();

  keylogger.addListener((event, down) => {
    const parsed = parseKeyEvent(event, down);
    const { raw } = parsed;

    if (raw) {
      clearInterval(timer);
      timer = setTimeout(() => {
        flushDbBuffer();
      }, 500);
    }
    if (parsed.isAppSwitch) {
      flushDbBuffer();
      return;
    }
    if (raw) {
      if (!dbBufferedText) {
        dbBufferedApplicationName = currentApplication || "Unknown";
        dbBufferedWindowTitle = currentWindowTitle || "";
      }
      dbBufferedText += raw;
    }
  });
}

// Export function to handle cleanup when app is shutting down
export function cleanupKeylogger() {
  if (timer) {
    clearTimeout(timer);
  }
  flushDbBuffer();
}

export function updateKeyloggerPreferences(newPrefs: Preferences) {
  preferences = newPrefs;
}

export function getCurrentApplication(): string {
  return currentApplication;
}

export function getCurrentWindowTitle(): string {
  return currentWindowTitle;
}
