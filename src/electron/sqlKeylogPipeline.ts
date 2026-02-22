import { app } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";

import logger from "../logging";
import { loadPreferences } from "../preferences";
import { processSqlRawText } from "./sqlKeylogProcessing";
import { SqlKeylogRepository } from "./sqlKeylogRepository";
import type { SqlLogitem } from "./sqlKeylogTypes";
import {
  getSqlKeylogDbPath,
  quarantineEncryptedSqlKeylogDb,
  readEncryptedSqlKeylogDbBytes,
  writeEncryptedSqlKeylogDbBytesAtomic,
} from "./sqlKeylogStorage";
import { isErrnoException } from "./utils";

let repository: SqlKeylogRepository | null = null;
let blockedApps: string[] = [];
let initialized = false;
let initializing = false;
let persistTimer: NodeJS.Timeout | null = null;
let persistInFlight = false;
let dbDirty = false;
let nativeProcess: ChildProcessWithoutNullStreams | null = null;
let nativeReadline: readline.Interface | null = null;
let nativeRestartTimer: NodeJS.Timeout | null = null;
let nativeRestartAttempts = 0;
let shuttingDown = false;
let lockHandle: FileHandle | null = null;
let lockFilePath: string | null = null;

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

function looksLikeSqliteDb(bytes: Uint8Array): boolean {
  if (bytes.length < 16) return false;
  const header = Buffer.from(bytes.slice(0, 16)).toString("utf8");
  return header === "SQLite format 3\u0000";
}

async function acquireSqlKeylogWriterLock(): Promise<boolean> {
  if (process.platform !== "darwin") return true;
  if (lockHandle) return true;
  const dbPath = getSqlKeylogDbPath();
  const dir = path.dirname(dbPath);
  const lockPath = path.join(dir, "logitems.lock");
  await fs.mkdir(dir, { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      lockHandle = await fs.open(lockPath, "wx");
      lockFilePath = lockPath;
      await lockHandle.writeFile(JSON.stringify({ pid: process.pid, startedAtMs: Date.now() }), "utf8");
      return true;
    } catch (error: unknown) {
      if (!(isErrnoException(error) && error.code === "EEXIST")) {
        throw error;
      }
      try {
        const raw = await fs.readFile(lockPath, "utf8");
        const parsed = JSON.parse(raw) as { pid?: number };
        const otherPid = typeof parsed.pid === "number" ? parsed.pid : null;
        if (otherPid) {
          try {
            process.kill(otherPid, 0);
            return false;
          } catch (killError: unknown) {
            if (!(isErrnoException(killError) && killError.code === "ESRCH")) {
              return false;
            }
          }
        }
        await fs.unlink(lockPath);
      } catch (readError: unknown) {
        if (!(isErrnoException(readError) && readError.code === "ENOENT")) {
          try {
            await fs.unlink(lockPath);
          } catch (unlinkError: unknown) {
            if (!(isErrnoException(unlinkError) && unlinkError.code === "ENOENT")) {
              return false;
            }
          }
        }
      }
    }
  }
  return false;
}

async function releaseSqlKeylogWriterLock(): Promise<void> {
  const handle = lockHandle;
  const filePath = lockFilePath;
  lockHandle = null;
  lockFilePath = null;
  try {
    await handle?.close();
  } catch (error: unknown) {
    void error;
  }
  try {
    if (filePath) await fs.unlink(filePath);
  } catch (error: unknown) {
    if (!(isErrnoException(error) && error.code === "ENOENT")) {
      throw error;
    }
  }
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
        dbDirty = true;
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
  if (initialized || initializing) return;
  initializing = true;
  shuttingDown = false;

  try {
    const prefs = loadPreferences();
    blockedApps = prefs.blockedApps || [];

    const acquiredLock = await acquireSqlKeylogWriterLock();
    if (!acquiredLock) {
      logger.error("Refusing to start SQL keylog pipeline: another instance is running");
      return;
    }

    const dbPath = getSqlKeylogDbPath();
    const existingBytes = await readEncryptedSqlKeylogDbBytes(dbPath);
    if (existingBytes && !looksLikeSqliteDb(existingBytes)) {
      await quarantineEncryptedSqlKeylogDb(dbPath, "not-sqlite-header");
      logger.error("Refusing to start SQL keylog pipeline: existing DB bytes are not a valid SQLite database");
      await releaseSqlKeylogWriterLock();
      return;
    }
    repository = await SqlKeylogRepository.initialize(existingBytes);
    initialized = true;

    if (process.platform !== "darwin") {
      logger.info("SQL keylog pipeline is disabled on non-darwin platforms");
      return;
    }

    startNativeHelper();
  } catch (error) {
    logger.error(`Failed to initialize SQL keylog pipeline: ${error instanceof Error ? error.message : `${error}`}`);
    initialized = false;
    repository?.close();
    repository = null;
    await releaseSqlKeylogWriterLock();
    return;
  } finally {
    initializing = false;
  }
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
  return persistPromise.finally(async () => {
    repository?.close();
    repository = null;
    initialized = false;
    persistInFlight = false;
    dbDirty = false;
    nativeRestartAttempts = 0;
    await releaseSqlKeylogWriterLock();
  });
}

export function __setSqlKeylogRepositoryForTesting(repo: SqlKeylogRepository | null): void {
  repository = repo;
}
