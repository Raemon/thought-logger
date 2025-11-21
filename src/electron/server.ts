import http from "http";
import fs from "node:fs/promises";
import path from "path";
import { app } from "electron";

import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types";
import { z } from "zod";
import logger from "../logging";

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
        return await fs.readFile(filePath, "utf-8");
      } catch (error) {
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
    const data = await fs.readFile(filePath, "utf-8");
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(data);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(`Failed to read ${description} log file. ${filePath}`);
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
      onsessioninitialized: (sessionId) => {
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
          text = await fs.readFile(filePath, "utf-8");
        } catch (error) {
          text = `Unable to fetch keylog data for ${date}: ${error}`;
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

/**
 * Starts the local HTTP server for accessing log files
 * @param port The port to listen on
 * @returns The HTTP server instance
 */
export function startLocalServer(port = 8765): http.Server {
  const server = http.createServer(async (req, res) => {
    switch (req.url) {
      case "/":
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

      case "/week":
        try {
          const contents = await getWeekContents({ raw: false });
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end(contents);
        } catch (error) {
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
        } catch (error) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Failed to read raw log files for the past week.");
        }
        break;

      default: {
        // Check if the URL matches the format /YYYY-MM-DD
        const dateMatch = req.url?.match(/^\/(\d{4}-\d{2}-\d{2})$/);

        if (dateMatch) {
          const dateStr = dateMatch[1];
          try {
            // Parse the date from the URL
            const date = new Date(dateStr);

            // Validate if the date is valid
            if (isNaN(date.getTime())) {
              res.writeHead(400, { "Content-Type": "text/plain" });
              res.end("Invalid date format. Please use YYYY-MM-DD.");
              break;
            }

            const filePath = getKeyLogFileForDate(
              date,
              "processed.chronological.",
            );
            await handleLogFileRequest(res, filePath, `log for ${dateStr}`);
          } catch (error) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end(`Failed to retrieve log file for ${dateStr}.`);
          }
        } else {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
        }
      }
    }
  });

  server.listen(port, () => {
    logger.info(`Server is running on http://localhost:${port}`);
  });

  return server;
}
