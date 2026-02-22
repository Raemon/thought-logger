import { app } from "electron";
import path from "node:path";
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";

import logger from "../logging";
import { loadPreferences } from "../preferences";
import { processSqlRawText } from "./sqlKeylogProcessing";
import { SqlKeylogRepository } from "./sqlKeylogRepository";
import type { SqlLogitem } from "./sqlKeylogTypes";
import {
  getSqlKeylogDbPath,
  readEncryptedSqlKeylogDbBytes,
  writeEncryptedSqlKeylogDbBytesAtomic,
} from "./sqlKeylogStorage";

let repository: SqlKeylogRepository | null = null;
let blockedApps: string[] = [];
let initialized = false;
let persistTimer: NodeJS.Timeout | null = null;
let persistInFlight = false;
let dbDirty = false;
let nativeProcess: ChildProcessWithoutNullStreams | null = null;

const BINARY_NAME = "MacKeyServerSql";

function isProtectedApp(appName: string, blocked: string[]): boolean {
  return blocked.some((app) =>
    appName.trim().toLowerCase().includes(app.trim().toLowerCase()),
  );
}

function getBinaryPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, BINARY_NAME)
    : path.join(app.getAppPath(), "bin", BINARY_NAME);
}

function schedulePersist(): void {
  if (!repository) return;
  if (persistTimer || persistInFlight) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (persistInFlight) return;
    persistInFlight = true;
    dbDirty = false;
    persistSqlKeylogDb()
      .catch((error) => {
        logger.error(`Failed to persist SQL keylog DB: ${error instanceof Error ? error.message : `${error}`}`);
      })
      .finally(() => {
        persistInFlight = false;
        if (dbDirty) schedulePersist();
      });
  }, 500);
}

async function persistSqlKeylogDb(): Promise<void> {
  if (!repository) return;
  const dbPath = getSqlKeylogDbPath();
  const dbBytes = repository.exportBytes();
  await writeEncryptedSqlKeylogDbBytesAtomic(dbPath, dbBytes);
}

function formatTimestampForHeader(timestampMs: number): string {
  const date = new Date(timestampMs);
  const dateStr = date.toLocaleDateString("en-CA");
  const timeStr = date
    .toLocaleTimeString("en-CA", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    .replace(/:/g, ".");
  return `${dateStr} ${timeStr}`;
}

export async function initializeSqlKeylogPipeline(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const prefs = loadPreferences();
  blockedApps = prefs.blockedApps || [];

  const dbPath = getSqlKeylogDbPath();
  let existingBytes: Uint8Array | null = null;
  try {
    existingBytes = await readEncryptedSqlKeylogDbBytes(dbPath);
  } catch (error) {
    logger.error(`Failed to read SQL keylog DB: ${error instanceof Error ? error.message : `${error}`}`);
  }
  repository = await SqlKeylogRepository.initialize(existingBytes);

  if (process.platform !== "darwin") {
    logger.info("SQL keylog pipeline is disabled on non-darwin platforms");
    return;
  }

  const binaryPath = getBinaryPath();
  const proc = spawn(binaryPath, [], { stdio: ["pipe", "pipe", "pipe"] });
  nativeProcess = proc;

  proc.on("error", (error) => {
    logger.error(`Failed to start MacKeyServerSql: ${error instanceof Error ? error.message : `${error}`}`);
  });

  proc.stderr.on("data", (chunk) => {
    logger.error(`MacKeyServerSql stderr: ${chunk.toString("utf8")}`);
  });

  const rl = readline.createInterface({ input: proc.stdout });
  rl.on("line", (line) => {
    try {
      const event = JSON.parse(line) as {
        timestamp: number;
        applicationName: string;
        windowTitle: string;
        rawKey: string;
        state: "DOWN" | "UP";
      };

      if (event.state !== "DOWN") return;
      ingestSqlKeystroke({
        timestamp: event.timestamp,
        applicationName: event.applicationName,
        windowTitle: event.windowTitle,
        rawKey: event.rawKey,
      });
    } catch (error) {
      logger.error(`Failed to parse MacKeyServerSql event: ${error instanceof Error ? error.message : `${error}`}`);
    }
  });

  proc.on("exit", (code) => {
    logger.error(`MacKeyServerSql exited with code ${code}`);
    nativeProcess = null;
  });
}

export function updateSqlKeylogPreferences(): void {
  const prefs = loadPreferences();
  blockedApps = prefs.blockedApps || [];
}

export function ingestSqlKeystroke({
  timestamp,
  applicationName,
  windowTitle,
  rawKey,
}: {
  timestamp: number;
  applicationName: string;
  windowTitle: string;
  rawKey: string;
}): void {
  if (!repository) return;
  if (isProtectedApp(applicationName, blockedApps)) return;
  repository.appendKeystrokeToCurrentLogitem({
    nowTimestampMs: timestamp,
    applicationName,
    windowTitle,
    keystroke: rawKey,
  });
  dbDirty = true;
  schedulePersist();
}

export function getSqlLogitemsPast24Hours(nowTimestampMs = Date.now()): SqlLogitem[] {
  if (!repository) return [];
  const since = nowTimestampMs - 24 * 60 * 60 * 1000;
  return repository.getLogitemsSinceTimestamp(since);
}

export function getSqlLogitemsAll(): SqlLogitem[] {
  if (!repository) return [];
  return repository.getAllLogitems();
}

export function renderSqlLogitemsProcessed(logitems: SqlLogitem[]): string {
  let output = "";
  for (const item of logitems) {
    const headerTime = formatTimestampForHeader(item.timestamp);
    output += `${headerTime}: ${item.applicationName}: ${item.windowTitle}\n`;
    output += `${processSqlRawText(item.keylogs)}\n\n`;
  }
  return output;
}

export function shutdownSqlKeylogPipeline(): Promise<void> {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;

  if (nativeProcess) {
    nativeProcess.kill();
    nativeProcess = null;
  }

  const persistPromise = persistSqlKeylogDb();
  return persistPromise.finally(() => {
    repository?.close();
    repository = null;
    initialized = false;
    persistInFlight = false;
    dbDirty = false;
  });
}

export function __setSqlKeylogRepositoryForTesting(repo: SqlKeylogRepository | null): void {
  repository = repo;
}

