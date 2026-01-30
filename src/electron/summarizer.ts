import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { rebuildLogByApp, rebuildChronologicalLog } from "../keylogger";
import { setDefaultOptions, isSameWeek, isSameDay } from "date-fns";
import { Keylog, Summary, SummaryScopeTypes } from "../types/files.d";
import logger from "../logging";
import { loadPreferences } from "../preferences";
import { getRecentSummaries, maybeReadContents } from "./files";
import { getSecret, OPEN_ROUTER } from "./credentials";
import { readFile } from "./paths";

setDefaultOptions({ weekStartsOn: 1 });

export interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function getAvailableModels(
  imageSupport = false,
): Promise<string[]> {
  const apiKey = await getSecret(OPEN_ROUTER);
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
  return body.data
    .filter(
      (model: {
        id: string;
        architecture: {
          input_modalities: string[];
        };
        supported_parameters: string[];
      }) =>
        !imageSupport ||
        (model.architecture.input_modalities.includes("image") &&
          model.supported_parameters.includes("structured_outputs") &&
          !model.id.startsWith("google/gemini")),
    )
    .map((model: { id: string }) => model.id);
}

async function generateAISummary(
  logContent: string,
  prompt: string,
  model: string,
  maxRetries = 3,
): Promise<string> {
  logger.debug("Generating AI summary");
  const apiKey = await getSecret(OPEN_ROUTER);

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

async function needsProcessing(keylog: Keylog): Promise<boolean> {
  try {
    await Promise.all([
      fs.access(keylog.chronoPath),
      fs.access(keylog.appPath),
    ]);
    return false;
  } catch {
    return true;
  }
}

async function processKeylog(file: Keylog): Promise<void> {
  logger.debug(`Processing keylog file: ${path.basename(file.rawPath)}`);

  try {
    // Generate processed files
    rebuildChronologicalLog(file.rawPath);
    rebuildLogByApp(file.rawPath);
  } catch (error) {
    logger.error(`Failed to process ${path.basename(file.rawPath)}:`, error);
    throw error; // Re-throw to handle in the calling function
  }
}

export async function needsSummary(summary: Summary): Promise<boolean> {
  const today = new Date();

  try {
    await fs.access(summary.path);
    return false;
  } catch {
    return (
      (summary.scope === SummaryScopeTypes.Day &&
        !isSameDay(today, summary.date)) ||
      (summary.scope === SummaryScopeTypes.Week &&
        !isSameWeek(today, summary.date))
    );
  }
}

async function checkAndGenerateSummaries() {
  const summaries = await getRecentSummaries();

  for (const summary of summaries) {
    logger.debug(`Checking summary of ${summary.path}`);
    for (const keylog of summary.keylogs) {
      if (needsProcessing(keylog)) {
        processKeylog(keylog);
      }
    }

    if (await needsSummary(summary)) {
      summarize(summary);
    }
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
    logger.info("Summary generation completed successfully");
  } catch (error) {
    logger.error("Failed to generate summaries:", error);
  }
});

export async function summarize(summary: Summary): Promise<void> {
  logger.debug(`Generating summary for ${summary.path}`);
  try {
    let logData = "";
    const {
      dailySummaryPrompt,
      weeklySummaryPrompt,
      summaryModel,
      screenshotSummaryWindow,
    } = loadPreferences();

    logData += "Keylogger data:\n";

    for (const keylog of summary.keylogs) {
      try {
        const text = await readFile(keylog.rawPath);
        const filename = path.basename(keylog.rawPath);
        logData += `${filename}:\n${text}\n\n`;
      } catch (error) {
        if (error.code === "ENOENT") {
          logger.info(`Keylog for ${keylog.date} didn't exist`);
        } else {
          throw error;
        }
      }
    }

    logData += "Screenshot Summaries:\n";

    for (const screenshot of summary.screenshots) {
      const text = await maybeReadContents(screenshot.summaryPath);
      if (text === null) {
        continue;
      }
      const excerpt = text
        .split(" ")
        .slice(0, screenshotSummaryWindow)
        .join(" ");
      const filename = path.basename(screenshot.summaryPath, ".txt");
      logData += `Taken on ${filename}:\n${excerpt}\n\n`;
    }

    const text = await generateAISummary(
      logData,
      summary.scope === SummaryScopeTypes.Day
        ? dailySummaryPrompt
        : weeklySummaryPrompt,
      summaryModel,
    );
    await fs.writeFile(summary.path, text);
    summary.contents = text;
  } catch (error) {
    logger.error(
      `Failed to generate summary for ${path.basename(summary.path)}:`,
      error,
    );
    throw error; // Re-throw to handle in the calling function
  }
}
