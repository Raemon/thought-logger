import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { rebuildLogByApp, rebuildChronologicalLog } from "../keylogger";
import { loadPreferences, recentFiles } from "../main";
import {
  startOfWeek,
  endOfWeek,
  subWeeks,
  isWithinInterval,
  setDefaultOptions,
  parse,
  format,
} from "date-fns";
import { SerializedLog, SerializedScopeTypes } from "../types/files.d";
setDefaultOptions({ weekStartsOn: 1 });

const userDataPath = app.getPath("userData");

// Import keytar safely
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let keytar: any;
try {
  keytar = require("keytar");
} catch (error) {
  // If we can't load keytar directly, try to load it from the resources directory
  try {
    const keytarPath = app.isPackaged
      ? path.join(process.resourcesPath, "keytar.node")
      : path.join(
          app.getAppPath(),
          "node_modules",
          "keytar",
          "build",
          "Release",
          "keytar.node",
        );
    console.log("Attempting to load keytar from:", keytarPath);
    keytar = require(keytarPath);
  } catch (secondError) {
    console.error("Failed to load keytar:", secondError);
    // Provide a fallback implementation that logs error but doesn't crash
    keytar = {
      getPassword: async (): Promise<string | null> => null,
      setPassword: async (): Promise<void> =>
        console.error("Unable to save password: keytar not available"),
    };
  }
}

// Constants for keychain access
const SERVICE_NAME = "ThoughtLogger";
const ACCOUNT_NAME = "OpenRouter";

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface LogFileInfo {
  rawPath: string;
  chronologicalPath: string;
  byAppPath: string;
  summaryPath: string;
  date: Date;
}

async function getOpenRouterApiKey(): Promise<string> {
  const apiKey = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  if (!apiKey) {
    throw new Error("OpenRouter API key not found");
  }
  return apiKey;
}

export async function getAvailableModels(): Promise<string[]> {
  const apiKey = await getOpenRouterApiKey();
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://github.com/raymondarnold/thought-logger",
      "X-Title": "ThoughtLogger",
    },
  });

  const body = await response.json();
  return body.data.map((model: { id: string }) => model.id);
}

async function generateAISummary(
  logContent: string,
  prompt: string,
  model: string,
  maxRetries = 3,
): Promise<string> {
  const apiKey = await getOpenRouterApiKey();

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://github.com/raymondarnold/thought-logger",
            "X-Title": "ThoughtLogger",
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content:
                  "You are a helpful assistant that analyzes computer activity logs and identifies major projects and tasks worked on. Focus on identifying distinct projects, and significant activities. Be concise but informative.",
              },
              {
                role: "user",
                content: `${prompt}\n\n${logContent}`,
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }

      const data: OpenRouterResponse = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        console.warn(`Attempt ${attempt} failed, retrying...`, error);
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }
    }
  }

  throw new Error(
    `Failed to generate summary after ${maxRetries} attempts: ${lastError?.message}`,
  );
}

function getLogFileInfo(logPath: string): LogFileInfo {
  if (!logPath.endsWith(".log")) {
    throw new Error(`Invalid log file path: ${logPath}. Must end with .log`);
  }

  const date = parse(path.basename(logPath, ".log"), "yyyy-MM-dd", new Date());

  return {
    rawPath: logPath,
    chronologicalPath: logPath.replace(".log", ".processed.chronological.log"),
    byAppPath: logPath.replace(".log", ".processed.by-app.log"),
    summaryPath: logPath.replace(".log", ".aisummary.log"),
    date,
  };
}

async function needsProcessing(fileInfo: LogFileInfo): Promise<boolean> {
  try {
    await Promise.all([
      fs.access(fileInfo.chronologicalPath),
      fs.access(fileInfo.byAppPath),
    ]);
    return false;
  } catch {
    return true;
  }
}

async function processLogFile(fileInfo: LogFileInfo): Promise<void> {
  console.log(`Processing ${path.basename(fileInfo.rawPath)}`);

  try {
    // Generate processed files
    rebuildChronologicalLog(fileInfo.rawPath);
    rebuildLogByApp(fileInfo.rawPath);
  } catch (error) {
    console.error(
      `Failed to process ${path.basename(fileInfo.rawPath)}:`,
      error,
    );
    throw error; // Re-throw to handle in the calling function
  }
}

async function needsSummary(fileInfo: LogFileInfo): Promise<boolean> {
  try {
    await fs.access(fileInfo.summaryPath);
    console.log(
      `Summary already exists for ${path.basename(fileInfo.rawPath)}`,
    );
    return false;
  } catch {
    return true;
  }
}

async function generateSummary(fileInfo: LogFileInfo): Promise<void> {
  console.log(`Generating summary for ${path.basename(fileInfo.rawPath)}`);
  try {
    // Ensure the chronological log exists before trying to read it
    await fs.access(fileInfo.chronologicalPath);
    const logContent = await fs.readFile(fileInfo.chronologicalPath, "utf-8");
    const { dailySummaryPrompt, summaryModel } = await loadPreferences();
    const summary = await generateAISummary(
      logContent,
      dailySummaryPrompt,
      summaryModel,
    );
    await fs.writeFile(fileInfo.summaryPath, summary);
  } catch (error) {
    console.error(
      `Failed to generate summary for ${path.basename(fileInfo.rawPath)}:`,
      error,
    );
    throw error; // Re-throw to handle in the calling function
  }
}

export async function rebuildSummary(log: SerializedLog): Promise<void> {
  if (log.scope === SerializedScopeTypes.Week) {
    return generateWeeklySummary(log.date);
  } else {
    const fileInfo = getLogFileInfo(log.rawPath);
    return generateSummary(fileInfo);
  }
}

// Weekly Summaries

async function getWeekKeyLogs(date: Date): Promise<string[]> {
  const weekStart = startOfWeek(date);
  const weekEnd = endOfWeek(date);

  const files = await recentFiles();
  const fileInfo = files
    .filter(
      (f) =>
        f.endsWith(".log") &&
        !f.includes("processed.") &&
        !f.includes("aisummary."),
    )
    .map(getLogFileInfo)
    .filter((info) =>
      isWithinInterval(info.date, { start: weekStart, end: weekEnd }),
    );

  return fileInfo.map((info) => info.rawPath);
}

function weeklySummaryPath(date: Date): string {
  const keylogsPath = path.join(userDataPath, "files", "keylogs");
  const weekString = format(date, "yyyy-'W'ww");
  return path.join(keylogsPath, `${weekString}.aisummary.log`);
}

async function needsWeekSummary(date: Date): Promise<boolean> {
  const files = await getWeekKeyLogs(date);
  const weeklyPath = weeklySummaryPath(date);

  if (files.length === 0) {
    return false;
  }

  try {
    await fs.access(weeklyPath);
    return false;
  } catch {
    return true;
  }
}

async function generateWeeklySummary(date: Date): Promise<void> {
  const logFiles = await getWeekKeyLogs(date);
  const fileContents = await Promise.all(
    logFiles.map((file) => fs.readFile(file)),
  );
  const logContents = fileContents.join("\n");
  const { weeklySummaryPrompt, summaryModel } = await loadPreferences();
  const summary = await generateAISummary(
    logContents,
    weeklySummaryPrompt,
    summaryModel,
  );
  const summaryPath = weeklySummaryPath(date);

  fs.writeFile(summaryPath, summary);
}

async function processMonthFolder(monthPath: string): Promise<void> {
  const files = await fs.readdir(monthPath);
  const rawLogs = files.filter(
    (f) =>
      f.endsWith(".log") &&
      !f.includes("processed.") &&
      !f.includes("aisummary."),
  );

  for (const logFile of rawLogs) {
    try {
      const logPath = path.join(monthPath, logFile);
      const fileInfo = getLogFileInfo(logPath);

      if (await needsProcessing(fileInfo)) {
        try {
          await processLogFile(fileInfo);
        } catch (error) {
          console.error(`Failed to process ${logFile}:`, error);
          continue; // Continue with next file even if this one fails
        }
      }

      if (await needsSummary(fileInfo)) {
        try {
          await generateSummary(fileInfo);
        } catch (error) {
          console.error(`Failed to generate summary for ${logFile}:`, error);
          continue; // Continue with next file even if this one fails
        }
      }
    } catch (error) {
      console.error(`Error processing file ${logFile}:`, error);
      continue; // Continue with next file even if this one fails
    }
  }
}

async function checkAndGenerateSummaries() {
  const keylogsPath = path.join(userDataPath, "files", "keylogs");

  try {
    // Get all month folders
    const monthFolders = await fs.readdir(keylogsPath);
    console.log(monthFolders);

    for (const monthFolder of monthFolders) {
      try {
        const monthPath = path.join(keylogsPath, monthFolder);
        const stats = await fs.stat(monthPath);

        if (!stats.isDirectory()) continue;

        await processMonthFolder(monthPath);
      } catch (error) {
        console.error(`Failed to process month folder ${monthFolder}:`, error);
        continue; // Continue with next month even if this one fails
      }
    }

    const today = new Date();
    const lastWeek = subWeeks(today, 1);
    if (needsWeekSummary(lastWeek)) {
      console.log("Generating a summary for last week...");
      await generateWeeklySummary(lastWeek);
    }
  } catch (error) {
    console.error("Error checking and generating summaries:", error);
    throw error; // Re-throw to handle in the calling function
  }
}

// Run once a day at midnight
export function startDailySummaryCheck() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const msUntilMidnight = tomorrow.getTime() - now.getTime();

  // Run first check after msUntilMidnight
  setTimeout(() => {
    checkAndGenerateSummaries();
    // Then run every 24 hours
    setInterval(checkAndGenerateSummaries, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
}

// Initialize electron app
app.whenReady().then(async () => {
  try {
    await checkAndGenerateSummaries();
    console.log("Summary generation completed successfully");
  } catch (error) {
    console.error("Failed to generate summaries:", error);
  }
});
