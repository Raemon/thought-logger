import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { rebuildLogByApp, rebuildChronologicalLog } from "../keylogger";
import { setDefaultOptions, isSameWeek, isSameDay } from "date-fns";
import { Keylog, Summary, SummaryScopeTypes } from "../types/files.d";
import log from "../logging";
import { loadPreferences } from "../preferences";
import { getRecentSummaries } from "./files";
import { getApiKey } from "./credentials";

setDefaultOptions({ weekStartsOn: 1 });

export interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function getAvailableModels(
  imageSupport: boolean = false,
): Promise<string[]> {
  const apiKey = await getApiKey();
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
        architecture: {
          input_modalities: string[];
        };
        supported_parameters: string[];
      }) =>
        !imageSupport ||
        (model.architecture.input_modalities.includes("image") &&
          model.supported_parameters.includes("structured_outputs")),
    )
    .map((model: { id: string }) => model.id);
}

async function generateAISummary(
  logContent: string,
  prompt: string,
  model: string,
  maxRetries = 3,
): Promise<string> {
  const apiKey = await getApiKey();

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
  console.log(`Processing ${path.basename(file.rawPath)}`);

  try {
    // Generate processed files
    rebuildChronologicalLog(file.rawPath);
    rebuildLogByApp(file.rawPath);
  } catch (error) {
    log.error(`Failed to process ${path.basename(file.rawPath)}:`, error);
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
        isSameDay(today, summary.date)) ||
      (summary.scope === SummaryScopeTypes.Week &&
        isSameWeek(today, summary.date))
    );
  }
}

async function checkAndGenerateSummaries() {
  const summaries = await getRecentSummaries();

  for (let summary of summaries) {
    for (let keylog of summary.keylogs) {
      if (needsProcessing(keylog)) {
        processKeylog(keylog);
      }
    }

    if (needsSummary(summary)) {
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
    console.log("Summary generation completed successfully");
  } catch (error) {
    log.error("Failed to generate summaries:", error);
  }
});

export async function summarize(summary: Summary): Promise<void> {
  console.log(`Generating summary for ${path.basename(summary.path)}`);
  try {
    let logData: string = "";
    for (let keylog of summary.keylogs) {
      let text = await fs.readFile(keylog.rawPath, { encoding: "utf-8" });
      let filename = path.basename(keylog.rawPath);
      logData += `${filename}:\n${text}\n\n`;
    }
    const { dailySummaryPrompt, summaryModel } = await loadPreferences();
    const text = await generateAISummary(
      logData,
      dailySummaryPrompt,
      summaryModel,
    );
    await fs.writeFile(summary.path, text);
    summary.contents = text;
  } catch (error) {
    log.error(
      `Failed to generate summary for ${path.basename(summary.path)}:`,
      error,
    );
    throw error; // Re-throw to handle in the calling function
  }
}
