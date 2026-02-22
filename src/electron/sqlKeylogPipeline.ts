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
let nativeReadline: readline.Interface | null = null;
let nativeRestartTimer: NodeJS.Timeout | null = null;
let nativeRestartAttempts = 0;
let shuttingDown = false;

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
  shuttingDown = false;

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

  startNativeHelper();
}

export function updateSqlKeylogPreferences(): void {
  const prefs = loadPreferences();
  blockedApps = prefs.blockedApps || [];
}

function cleanupNativeHelper(): void {
  if (nativeRestartTimer) {
    clearTimeout(nativeRestartTimer);
    nativeRestartTimer = null;
  }

  if (nativeReadline) {
    nativeReadline.close();
    nativeReadline = null;
  }

  if (nativeProcess) {
    nativeProcess.kill();
    nativeProcess = null;
  }
}

function scheduleNativeRestart(reason: string): void {
  if (shuttingDown) return;
  if (process.platform !== "darwin") return;
  if (nativeRestartTimer) return;

  nativeRestartAttempts += 1;
  const delayMs = Math.min(30000, 1000 * Math.pow(2, Math.min(nativeRestartAttempts, 5)));
  logger.error(`Scheduling MacKeyServerSql restart in ${delayMs}ms (${reason})`);
  nativeRestartTimer = setTimeout(() => {
    nativeRestartTimer = null;
    startNativeHelper();
  }, delayMs);
}

function startNativeHelper(): void {
  if (shuttingDown) return;
  if (nativeProcess) return;

  const binaryPath = getBinaryPath();
  const proc = spawn(binaryPath, [], { stdio: ["pipe", "pipe", "pipe"] });
  nativeProcess = proc;

  proc.on("spawn", () => {
    nativeRestartAttempts = 0;
  });

  proc.on("error", (error) => {
    logger.error(`Failed to start MacKeyServerSql: ${error instanceof Error ? error.message : `${error}`}`);
    nativeProcess = null;
    scheduleNativeRestart("spawn error");
  });

  proc.stderr.on("data", (chunk) => {
    logger.error(`MacKeyServerSql stderr: ${chunk.toString("utf8")}`);
  });

  const rl = readline.createInterface({ input: proc.stdout });
  nativeReadline = rl;
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
    nativeReadline?.close();
    nativeReadline = null;
    scheduleNativeRestart("process exit");
  });
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
  shuttingDown = true;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;

  cleanupNativeHelper();

  const persistPromise = persistSqlKeylogDb();
  return persistPromise.finally(() => {
    repository?.close();
    repository = null;
    initialized = false;
    persistInFlight = false;
    dbDirty = false;
    nativeRestartAttempts = 0;
  });
}

export function __setSqlKeylogRepositoryForTesting(repo: SqlKeylogRepository | null): void {
  repository = repo;
}

