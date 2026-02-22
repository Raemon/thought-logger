import path from "node:path";
import { app } from "electron";
import { rebuildLogByApp, rebuildChronologicalLog } from "../keylogger";
import { setDefaultOptions, isSameWeek, isSameDay } from "date-fns";
import { Keylog, Summary, SummaryScopeTypes } from "../types/files";
import logger from "../logging";
import { loadPreferences } from "../preferences";
import { getRecentSummaries, readFile, writeFile } from "./files";
import { getSecret } from "./credentials";
import { LOG_FILE_ENCRYPTION, OPEN_ROUTER } from "../constants/credentials";
import { SUMMARIZER_SYSTEM_PROMPT } from "../constants/prompts";
import { getSummaryPath } from "./paths";

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
  logger.debug(
    `summarizer.generate.start model=${model} promptBytes=${prompt.length} logBytes=${logContent.length}`,
  );
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
                content: SUMMARIZER_SYSTEM_PROMPT,
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
        logger.info(
          `summarizer.generate.response.not-ok status=${response.status} statusText=${response.statusText}`,
        );
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }

      const data: OpenRouterResponse = await response.json();
      logger.debug("summarizer.generate.success");
      return data.choices[0].message.content;
    } catch (error) {
      lastError = error as Error;
      logger.info(
        `summarizer.generate.retry attempt=${attempt}/${maxRetries} error=${lastError.message}`,
      );
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
  return !(keylog.rawPath && keylog.chronoPath && keylog.appPath);
}

async function processKeylog(file: Keylog): Promise<void> {
  if (!file.rawPath) {
    logger.error(`Missing raw file for keylog ${file.date}`);
    return;
  }
  logger.debug(`Processing keylog file: ${path.basename(file.rawPath)}`);

  await rebuildChronologicalLog(file.rawPath);
  await rebuildLogByApp(file.rawPath);
}

export async function needsSummary(summary: Summary): Promise<boolean> {
  const today = new Date();
  const hasData = summary.keylogs.length > 0 || summary.screenshots.length > 0;

  return (
    hasData &&
    summary.path === null &&
    ((summary.scope === SummaryScopeTypes.Day &&
      !isSameDay(today, summary.date)) ||
      (summary.scope === SummaryScopeTypes.Week &&
        !isSameWeek(today, summary.date)))
  );
}

async function checkAndGenerateSummaries() {
  logger.info("summarizer.check.start");
  const password = await getSecret(LOG_FILE_ENCRYPTION);

  if (!password) {
    logger.info("No password, postponing summary generation");
    setTimeout(() => {
      checkAndGenerateSummaries();
    }, 20000);
    return;
  }

  const summaries = await getRecentSummaries();
  logger.debug(`summarizer.check.loaded summaries=${summaries.length}`);

  for (const summary of summaries) {
    logger.debug(`Checking summary of ${summary.path}`);
    for (const keylog of summary.keylogs) {
      if (await needsProcessing(keylog)) {
        logger.debug(`summarizer.check.process-keylog date=${keylog.date.toISOString()}`);
        await processKeylog(keylog);
      }
    }

    if (await needsSummary(summary)) {
      logger.info(
        `summarizer.check.generate summaryDate=${summary.date.toISOString()} scope=${summary.scope}`,
      );
      await summarize(summary);
    }
  }
  logger.info("summarizer.check.complete");
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
  await checkAndGenerateSummaries();
  logger.info("Summary generation completed successfully");
});

export async function summarize(summary: Summary): Promise<void> {
  const summaryPath = getSummaryPath(summary);
  logger.debug(`Generating summary for ${summaryPath}`);

  let logData = "";
  const {
    dailySummaryPrompt,
    weeklySummaryPrompt,
    summaryModel,
    screenshotSummaryWindow,
  } = loadPreferences();

  logData += "Keylogger data:\n";

  for (const keylog of summary.keylogs) {
    if (!keylog.rawPath) {
      logger.error(`Missing keylog data for ${keylog.date}`);
      continue;
    }

    const text = await readFile(keylog.rawPath);
    logger.debug(
      `summarizer.read.keylog path=${keylog.rawPath} bytes=${text.length}`,
    );
    const filename = path.basename(keylog.rawPath);
    logData += `${filename}:\n${text}\n\n`;
  }

  logData += "Screenshot Summaries:\n";

  for (const screenshot of summary.screenshots) {
    if (!screenshot.summaryPath) {
      logger.info(`Missing screenshot summary for ${screenshot.imagePath}`);
      continue;
    }
    const text = await readFile(screenshot.summaryPath);
    logger.debug(
      `summarizer.read.screenshot-summary path=${screenshot.summaryPath} bytes=${text.length}`,
    );
    let summaryText: string;
    try {
      const jsonData = JSON.parse(text);
      summaryText = jsonData.summary || text;
    } catch {
      summaryText = text;
    }
    const excerpt = summaryText
      .split(" ")
      .slice(0, screenshotSummaryWindow)
      .join(" ");
    const filename = path.basename(screenshot.summaryPath, ".json");
    logData += `Taken on ${filename}:\n${excerpt}\n\n`;
  }

  const text = await generateAISummary(
    logData,
    summary.scope === SummaryScopeTypes.Day
      ? dailySummaryPrompt
      : weeklySummaryPrompt,
    summaryModel,
  );
  await writeFile(summaryPath, text);
  logger.info(`summarizer.write.summary.success path=${summaryPath} bytes=${text.length}`);
  summary.path = summaryPath;
  summary.contents = text;
}
