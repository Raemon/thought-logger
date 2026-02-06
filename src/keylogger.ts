import { app } from "electron";
import path from "node:path";
import forEach from "lodash/forEach";
import {
  GlobalKeyboardListener,
  IGlobalKeyDownMap,
  IGlobalKeyEvent,
} from "node-global-key-listener";
import { currentKeyLogFile, readFile, writeFile } from "./electron/paths";
import { loadPreferences } from "./preferences";
import { Preferences } from "./types/preferences.d";
import logger from "./logging";
import { isErrnoException } from "./electron/utils";

const BINARY_NAME = "MacKeyServer";

const binaryPath = app.isPackaged
  ? path.join(process.resourcesPath, BINARY_NAME)
  : path.join(app.getAppPath(), "bin", BINARY_NAME);

const keylogger = new GlobalKeyboardListener({
  mac: { serverPath: binaryPath },
});

// Track current application and text buffers per application
let currentApplication = "";
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
function handleAppSwitch(appName: string): ParsedKey {
  const { dateStr, timeStr } = getFormattedTimestamp();

  currentApplication = appName;
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
    const match = event._raw.match(/\{\{(.*)\}\}/);
    if (!match) return { raw: "", processed: "", isAppSwitch: false };
    return handleAppSwitch(match[1]);
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

/** Process raw text by handling backspaces and special characters */
function processRawText(text: string, specialChars: Set<string>): string {
  let buffer = "";
  for (const char of text) {
    if (char === "⌫") {
      buffer = buffer.slice(0, -1);
    } else if (char === "⏎") {
      buffer += "\n"; // Convert placeholder back to newline
    } else if (!specialChars.has(char)) {
      buffer += char;
    }
  }
  return buffer;
}

const specialChars = new Set([
  "⌃",
  "⌘",
  "⌥",
  "←",
  "→",
  "↑",
  "↓",
  "⎋",
  "↹",
  "§",
  "±",
]);

/** Rebuild log chronologically, filtering out empty app sections */
export async function rebuildChronologicalLog(filePath: string) {
  let rawText: string;

  try {
    rawText = await readFile(filePath);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      logger.info(`Skipping chronological log rebuild for ${filePath}`);
    } else {
      throw error;
    }

    return;
  }

  try {
    const lines = rawText.split("\n");
    let processedContent = "";

    let currentAppLine = "";
    let sectionLines: string[] = [];

    // Process line by line
    forEach(lines, (line) => {
      // Match lines that start with date/time, like "2023-10-05 13.22.55: AppName"
      const dateAppSwitch = line.match(
        /^(\d{4}-\d{2}-\d{2})\s+(\d{2}\.\d{2}\.\d{2}):\s+(.*)$/,
      );

      if (dateAppSwitch) {
        // Process the previous section
        if (currentAppLine) {
          const sectionText = sectionLines.join("\n");
          const processedText = processRawText(sectionText, specialChars);
          // Only add the section if it has content after processing
          if (processedText.trim()) {
            processedContent += currentAppLine + "\n" + processedText + "\n\n";
          }
        }

        // Set up for new section
        currentAppLine = line;
        sectionLines = [];
      } else {
        sectionLines.push(line);
      }
    });

    // Process the last section
    if (currentAppLine) {
      const sectionText = sectionLines.join("\n");
      const processedText = processRawText(sectionText, specialChars);
      if (processedText.trim()) {
        processedContent += currentAppLine + "\n" + processedText + "\n";
      }
    }

    if (processedContent) {
      const dir = path.dirname(filePath);
      const basename = path.basename(filePath, "log");
      const outputPath = path.join(
        dir,
        `${basename}processed.chronological.log`,
      );
      writeFile(outputPath, processedContent);
    }
  } catch (error) {
    logger.error("Failed to rebuild chronological log:", error);
  }
}

// Refactor rebuildLogByApp to use the shared processRawText function
export async function rebuildLogByApp(filePath: string) {
  let rawText: string;

  try {
    rawText = await readFile(filePath);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      logger.info(`Skipping log by app rebuild for ${filePath}`);
    } else {
      throw error;
    }

    return;
  }

  try {
    const lines = rawText.split("\n");
    const appBuffers = new Map<string, string>();
    let activeApp = "Unknown";
    const lastAppTime = new Map<string, Date>();

    forEach(lines, (line) => {
      // Match lines that start with date/time, like "2023-10-05 13.22.55: AppName"
      const dateAppSwitch = line.match(
        /^(\d{4}-\d{2}-\d{2})\s+(\d{2}\.\d{2}\.\d{2}):\s+(.*)$/,
      );
      if (dateAppSwitch) {
        activeApp = dateAppSwitch[3];
        const currentTime = new Date(
          `${dateAppSwitch[1]} ${dateAppSwitch[2].replace(/\./g, ":")}`,
        );

        // Add extra newline and timestamp if more than 15 minutes since last use
        const lastTime = lastAppTime.get(activeApp);
        if (
          lastTime &&
          currentTime.getTime() - lastTime.getTime() > 15 * 60 * 1000
        ) {
          const timeStr = currentTime.toLocaleTimeString("en-CA", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
          });
          const existingBuffer = appBuffers.get(activeApp) || "";
          appBuffers.set(activeApp, existingBuffer + `\n[${timeStr}]\n`);
        }

        lastAppTime.set(activeApp, currentTime);
        if (!appBuffers.has(activeApp)) {
          appBuffers.set(activeApp, "");
        }
      } else {
        let buffer = appBuffers.get(activeApp) || "";
        buffer = processRawText(line, specialChars);
        appBuffers.set(activeApp, buffer);
      }
    });

    let processedContent = "";
    appBuffers.forEach((text, app) => {
      const trimmed = text.trim();
      if (trimmed) {
        processedContent += `\n=== ${app} ===\n${trimmed}\n`;
      }
    });
    if (processedContent) {
      const dir = path.dirname(filePath);
      const basename = path.basename(filePath, "log");
      const outputPath = path.join(dir, `${basename}processed.by-app.log`);
      writeFile(outputPath, processedContent);
    }
  } catch (error) {
    logger.error("Failed to rebuild processed log:", error);
  }
}

let bufferedText = "";
let timer: NodeJS.Timeout;

export async function initializeKeylogger() {
  // Load initial preferences
  preferences = loadPreferences();

  // Set up periodic re-processing of logs
  setInterval(async () => {
    await rebuildLogByApp(currentKeyLogFile());
    await rebuildChronologicalLog(currentKeyLogFile());
  }, 5 * 1000);

  keylogger.addListener((event, down) => {
    const { raw } = parseKeyEvent(event, down);

    // Write to raw log
    if (raw) {
      bufferedText += raw;
      clearInterval(timer);
      timer = setTimeout(() => {
        writeFile(currentKeyLogFile(), bufferedText, true);
        bufferedText = "";
      }, 500);
    }
  });
}

export function updateKeyloggerPreferences(newPrefs: Preferences) {
  preferences = newPrefs;
}

export function getCurrentApplication(): string {
  return currentApplication;
}
