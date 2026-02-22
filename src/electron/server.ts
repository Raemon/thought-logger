import http from "http";
import path from "path";
import { app } from "electron";

import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types";
import { z } from "zod";
import logger from "../logging";
import {
  getScreenshotSummariesForDate,
  getScreenshotImagePathsForDate,
  readFile,
} from "./files";
import { buildHealthPastWeekHtml } from "./health";
import { allEndpoints } from "../constants/endpoints";

const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

const userDataPath = app.getPath("userData");

/**
 * Gets the path to a key log file for a specific date
 * @param date The date to get the log file for
 * @returns The path to the log file
 */
function getKeyLogFileForDate(date: Date, suffix: string): string {
  const year = date.getFullYear();
  const month = new Intl.DateTimeFormat("en-US", { month: "2-digit" }).format(
    date,
  );
  const dateStr = date.toLocaleDateString("en-CA"); // Format as YYYY-MM-DD

  const folderPath = path.join(
    userDataPath,
    "files",
    "keylogs",
    `${year}-${month}`,
  );

  return path.join(folderPath, `${dateStr}.${suffix}log`);
}

/**
 * Gets the path to today's key log file
 * @returns The path to today's log file
 */
export function currentKeyLogFile({ raw = false }: { raw?: boolean }): string {
  return getKeyLogFileForDate(
    new Date(),
    raw ? "" : "processed.chronological.",
  );
}

/**
 * Gets the path to yesterday's key log file
 * @returns The path to yesterday's log file
 */
function getYesterdayKeyLogFile({ raw = false }: { raw?: boolean }): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getKeyLogFileForDate(yesterday, raw ? "" : "processed.chronological.");
}

/**
 * Gets the paths to all key log files from the past week
 * @returns Array of paths to log files from the past week
 */
function getWeekKeyLogFiles(): string[] {
  const files = [];
  const today = new Date();

  // Get log files for today and the past 6 days (7 days total)
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    files.push(getKeyLogFileForDate(date, "processed.chronological."));
  }

  return files;
}

/**
 * Fetches contents of log files for the week
 */
async function getWeekContents({
  raw = false,
}: {
  raw?: boolean;
}): Promise<string> {
  const filePaths = getWeekKeyLogFiles().map((file) => {
    // If raw is true, remove the "processed.chronological." suffix
    return raw ? file.replace("processed.chronological.", "") : file;
  });

  const contents = await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        return readFile(filePath);
      } catch {
        return `Unable to read file: ${filePath}\n`;
      }
    }),
  );
  return contents.join("\n\n");
}

/**
 * Route handler for serving log files
 */
async function handleLogFileRequest(
  res: http.ServerResponse,
  filePath: string,
  description: string,
) {
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(data);
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(`Failed to read ${description} log file. ${filePath}`);
  }
}

async function handleScreenshotSummaryList(
  res: http.ServerResponse,
  dateString: string,
) {
  const summaries = await getScreenshotSummariesForDate(dateString);
  res.writeHead(200, { "Content-Type": "text/plain" });
  if (summaries.length === 0) {
    res.end(`No screenshot summaries for ${dateString}.`);
    return;
  }
  const contents = summaries
    .map((summary) => {
      try {
        const jsonData = JSON.parse(summary.contents);
        return `${summary.path}:\n${JSON.stringify(jsonData, null, 2)}`;
      } catch {
        return `${summary.path}:\n${summary.contents}`;
      }
    })
    .join("\n\n");
  res.end(contents);
}

async function handleScreenshotImageListForDate(
  res: http.ServerResponse,
  dateString: string,
) {
  const imagePaths = await getScreenshotImagePathsForDate(dateString);
  res.writeHead(200, { "Content-Type": "text/html" });
  if (imagePaths.length === 0) {
    res.end(`No screenshot images for ${dateString}.`);
    return;
  }
  const images = imagePaths
    .map((imagePath) => {
      const url = `/screenshot/${encodeURIComponent(imagePath)}`;
      return `<a href="${url}" target="_blank"><img src="${url}" style="width:300px" /></a>`;
    })
    .join("");
  res.end(
    `<h1>Screenshot Images for ${dateString}</h1><div style="display:flex;flex-wrap:wrap;gap:8px">${images}</div>`,
  );
}

async function handleScreenshotImageGalleryForDate(
  res: http.ServerResponse,
  dateString: string,
) {
  const imagePaths = await getScreenshotImagePathsForDate(dateString);
  res.writeHead(200, { "Content-Type": "text/html" });
  if (imagePaths.length === 0) {
    res.end(`No screenshot images for ${dateString}.`);
    return;
  }
  const images = imagePaths
    .map((imagePath) => {
      const url = `/screenshot/${encodeURIComponent(imagePath)}`;
      return `<div><img src="${url}" style="max-width:100%" /></div>`;
    })
    .join("");
  res.end(`<h1>Screenshot Images for ${dateString}</h1>${images}`);
}

async function handleScreenshotImageRequest(
  res: http.ServerResponse,
  encodedPath: string,
) {
  try {
    const screenshotRoot = path.join(userDataPath, "files", "screenshots");
    const requestedPath = decodeURIComponent(encodedPath);
    const resolvedPath = path.resolve(requestedPath);
    const relativePath = path.relative(screenshotRoot, resolvedPath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Invalid screenshot path.");
      return;
    }
    const imageData = await readFile(resolvedPath, true);
    res.writeHead(200, { "Content-Type": "image/jpeg" });
    res.end(imageData);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Screenshot not found.");
  }
}

async function handleMCPRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end("Invalid or missing session ID");
    return;
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
}

async function handleMCPPostRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  req.setEncoding("utf8");
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  let transport: StreamableHTTPServerTransport;
  let body;
  let data = "";
  req.on("data", function (chunk) {
    data += chunk;
  });

  await new Promise((resolve) =>
    req.on("end", function () {
      body = JSON.parse(data);
      resolve(true);
    }),
  );

  if (sessionId && transports[sessionId]) {
    // Reuse existing transport
    transport = transports[sessionId];
  } else if (!sessionId && isInitializeRequest(body)) {
    // New initialization request
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId: string) => {
        // Store the transport by session ID
        transports[sessionId] = transport;
      },
    });

    // Clean up transport when closed
    transport.onclose = () => {
      if (transport.sessionId) {
        delete transports[transport.sessionId];
      }
    };

    const server = new McpServer({
      name: "thought-logger",
      version: "1.0.0",
    });

    server.tool(
      "keylogs",
      "Request the user's keylog data for a specific date",
      {
        date: z.string().date(),
      },
      async ({ date }) => {
        let text: string;

        const parsedDate = new Date(date);

        try {
          const filePath = getKeyLogFileForDate(
            parsedDate,
            "processed.chronological.",
          );
          text = await readFile(filePath);
        } catch (error) {
          if (error instanceof Error) {
            text = `Unable to fetch keylog data for ${date}: ${error.message}`;
          } else {
            throw error;
          }
        }

        return {
          content: [
            {
              type: "text",
              text,
            },
          ],
        };
      },
    );

    // Connect to the MCP server
    await server.connect(transport);
  } else {
    // Invalid request
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      }),
    );
    return;
  }

  // Handle the request
  await transport.handleRequest(req, res, body);
}

function handleIndexRequest(res: http.ServerResponse) {
  const todayDate = new Date().toLocaleDateString("en-CA");
  const endpointLines = allEndpoints
    .map((endpoint) => {
      const path = endpoint.path.replace("YYYY-MM-DD", todayDate);
      return `<li><a href="${path}" target="_blank" rel="noopener noreferrer">${path}</a> - ${endpoint.description}</li>`;
    })
    .join("");
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`<h1>Available endpoints</h1><ul>${endpointLines}</ul>`);
}

/**
 * Starts the local HTTP server for accessing log files
 * @param port The port to listen on
 * @returns The HTTP server instance
 */
export function startLocalServer(port = 8765): http.Server {
  const server = http.createServer(async (req, res) => {
    switch (req.url) {
      case "/":
        handleIndexRequest(res);
        break;
      case "/today":
        await handleLogFileRequest(
          res,
          currentKeyLogFile({ raw: false }),
          "today's",
        );
        break;

      case "/today/raw":
        await handleLogFileRequest(
          res,
          currentKeyLogFile({ raw: true }),
          "today's",
        );
        break;

      case "/today/screenshots": {
        try {
          const dateString = new Date().toLocaleDateString("en-CA");
          await handleScreenshotImageListForDate(res, dateString);
        } catch {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Failed to list today's screenshot images.");
        }
        break;
      }

      case "/today/screenshots/all": {
        try {
          const dateString = new Date().toLocaleDateString("en-CA");
          await handleScreenshotImageGalleryForDate(res, dateString);
        } catch {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Failed to render today's screenshot gallery.");
        }
        break;
      }

      case "/today/screenshots/summaries": {
        try {
          const dateString = new Date().toLocaleDateString("en-CA");
          await handleScreenshotSummaryList(res, dateString);
        } catch {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Failed to list today's screenshot summaries.");
        }
        break;
      }

      case "/yesterday":
        await handleLogFileRequest(
          res,
          getYesterdayKeyLogFile({ raw: false }),
          "yesterday's",
        );
        break;

      case "/yesterday/raw":
        await handleLogFileRequest(
          res,
          getYesterdayKeyLogFile({ raw: true }),
          "yesterday's",
        );
        break;

      case "/yesterday/screenshots": {
        try {
          const date = new Date();
          date.setDate(date.getDate() - 1);
          const dateString = date.toLocaleDateString("en-CA");
          await handleScreenshotImageListForDate(res, dateString);
        } catch {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Failed to list yesterday's screenshot images.");
        }
        break;
      }

      case "/yesterday/screenshots/all": {
        try {
          const date = new Date();
          date.setDate(date.getDate() - 1);
          const dateString = date.toLocaleDateString("en-CA");
          await handleScreenshotImageGalleryForDate(res, dateString);
        } catch {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Failed to render yesterday's screenshot gallery.");
        }
        break;
      }

      case "/yesterday/screenshots/summaries": {
        try {
          const date = new Date();
          date.setDate(date.getDate() - 1);
          const dateString = date.toLocaleDateString("en-CA");
          await handleScreenshotSummaryList(res, dateString);
        } catch {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Failed to list yesterday's screenshot summaries.");
        }
        break;
      }

      case "/health": {
        try {
          const html = await buildHealthPastWeekHtml({
            userDataPath,
            readFile,
            getKeyLogFileForDate,
          });
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(html);
        } catch {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Failed to render /health.");
        }
        break;
      }

      case "/week":
        try {
          const contents = await getWeekContents({ raw: false });
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end(contents);
        } catch {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Failed to read log files for the past week.");
        }
        break;

      case "/mcp":
        if (req.method == "POST") {
          handleMCPPostRequest(req, res);
        } else {
          handleMCPRequest(req, res);
        }

        break;

      case "/week/raw":
        try {
          const contents = await getWeekContents({ raw: true });
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end(contents);
        } catch {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Failed to read raw log files for the past week.");
        }
        break;

      default: {
        const screenshotFileMatch = req.url?.match(/^\/screenshot\/(.+)$/);
        // Check if the URL matches the format /YYYY-MM-DD
        const screenshotImageMatch = req.url?.match(
          /^\/(\d{4}-\d{2}-\d{2})\/screenshots$/,
        );
        const screenshotGalleryMatch = req.url?.match(
          /^\/(\d{4}-\d{2}-\d{2})\/screenshots\/all$/,
        );
        const screenshotSummaryMatch = req.url?.match(
          /^\/(\d{4}-\d{2}-\d{2})\/screenshots\/summaries$/,
        );
        const dateMatch = req.url?.match(/^\/(\d{4}-\d{2}-\d{2})$/);

        if (screenshotFileMatch) {
          await handleScreenshotImageRequest(res, screenshotFileMatch[1]);
        } else if (
          screenshotImageMatch ||
          screenshotGalleryMatch ||
          screenshotSummaryMatch ||
          dateMatch
        ) {
          const dateStr = (screenshotImageMatch ||
            screenshotGalleryMatch ||
            screenshotSummaryMatch ||
            dateMatch)?.[1];

          if (!dateStr) {
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end("Invalid URL pattern.");
            break;
          }

          try {
            // Parse the date from the URL
            const date = new Date(dateStr);

            // Validate if the date is valid
            if (isNaN(date.getTime())) {
              res.writeHead(400, { "Content-Type": "text/plain" });
              res.end("Invalid date format. Please use YYYY-MM-DD.");
              break;
            }

            if (screenshotSummaryMatch) {
              await handleScreenshotSummaryList(res, dateStr);
            } else if (screenshotGalleryMatch) {
              await handleScreenshotImageGalleryForDate(res, dateStr);
            } else if (screenshotImageMatch) {
              await handleScreenshotImageListForDate(res, dateStr);
            } else {
              const filePath = getKeyLogFileForDate(
                date,
                "processed.chronological.",
              );
              await handleLogFileRequest(res, filePath, `log for ${dateStr}`);
            }
          } catch {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end(
              screenshotSummaryMatch
                ? `Failed to retrieve screenshot summaries for ${dateStr}.`
                : screenshotGalleryMatch
                  ? `Failed to render screenshot gallery for ${dateStr}.`
                  : screenshotImageMatch
                    ? `Failed to retrieve screenshot images for ${dateStr}.`
                    : `Failed to retrieve log file for ${dateStr}.`,
            );
          }
        } else {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
        }
      }
    }
  });

  server.listen(port, "127.0.0.1", () => {
    logger.info(`Server is running on http://localhost:${port}`);
  });

  return server;
}
