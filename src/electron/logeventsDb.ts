import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import logger from "../logging";
import { decryptUserData, encryptUserData } from "./encryption";

export type LogEvent = {
  id: number;
  timestamp: number;
  keystrokes: string;
  applicationName: string;
  windowTitle: string;
  eventType: "keylog" | "screenshotSummary";
  payload: unknown | null;
  meta: unknown | null;
};

function repairLegacyAppWindowFields({
  applicationName,
  windowTitle,
}: {
  applicationName: string;
  windowTitle: string;
}): { applicationName: string; windowTitle: string } {
  if (windowTitle) return { applicationName, windowTitle };
  const trimmed = applicationName.trim();
  if (!trimmed.startsWith("{")) return { applicationName, windowTitle };
  if (!trimmed.includes('"appName"') && !trimmed.includes('"windowTitle"')) {
    return { applicationName, windowTitle };
  }
  const jsonText = trimmed.endsWith("}") ? trimmed : `${trimmed}}`;
  try {
    const parsed = JSON.parse(jsonText) as { appName?: string; windowTitle?: string };
    if (!parsed.appName && !parsed.windowTitle) return { applicationName, windowTitle };
    return { applicationName: parsed.appName || applicationName, windowTitle: parsed.windowTitle || "" };
  } catch {
    return { applicationName, windowTitle };
  }
}

type Encrypter = (
  plaintext: string | Uint8Array<ArrayBufferLike>,
) => Promise<Uint8Array>;
type Decrypter = (ciphertext: Uint8Array<ArrayBufferLike>) => Promise<Uint8Array>;

export function createLogeventsDb({
  dbPath,
  encrypt = encryptUserData,
  decrypt = decryptUserData,
}: {
  dbPath: string;
  encrypt?: Encrypter;
  decrypt?: Decrypter;
}) {
  if (dbPath !== ":memory:") {
    try {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    } catch (error) {
      logger.error("Failed to create logevents db directory:", error);
    }
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(
    "CREATE TABLE IF NOT EXISTS logevent (id INTEGER PRIMARY KEY AUTOINCREMENT,timestamp INTEGER NOT NULL,keystrokes BLOB NOT NULL,applicationName BLOB NOT NULL,windowTitle BLOB NOT NULL,eventType TEXT NOT NULL DEFAULT 'keylog',payload BLOB,meta BLOB)",
  );
  db.exec("CREATE INDEX IF NOT EXISTS logevent_timestamp ON logevent(timestamp)");

  const existingColsRaw = db.pragma("table_info(logevent)") as unknown;
  const existingCols = Array.isArray(existingColsRaw)
    ? (existingColsRaw as Array<{ name: string }>)
    : [];
  const colNames = new Set(existingCols.map((c) => c.name));
  if (!colNames.has("eventType")) {
    db.exec("ALTER TABLE logevent ADD COLUMN eventType TEXT NOT NULL DEFAULT 'keylog'");
  }
  if (!colNames.has("payload")) {
    db.exec("ALTER TABLE logevent ADD COLUMN payload BLOB");
  }
  if (!colNames.has("meta")) {
    db.exec("ALTER TABLE logevent ADD COLUMN meta BLOB");
  }

  const insertStmt = db.prepare(
    "INSERT INTO logevent (timestamp,keystrokes,applicationName,windowTitle,eventType,payload,meta) VALUES (@timestamp,@keystrokes,@applicationName,@windowTitle,@eventType,@payload,@meta)",
  );
  const selectSinceStmt = db.prepare(
    "SELECT id,timestamp,keystrokes,applicationName,windowTitle,eventType,payload,meta FROM logevent WHERE timestamp >= ? ORDER BY timestamp DESC,id DESC",
  );

  async function insertRow({
    timestamp,
    keystrokes,
    applicationName,
    windowTitle,
    eventType,
    payload,
    meta,
  }: {
    timestamp: number;
    keystrokes: string;
    applicationName: string;
    windowTitle: string;
    eventType: "keylog" | "screenshotSummary";
    payload: unknown | null;
    meta: unknown | null;
  }): Promise<void> {
    const payloadText = payload === null ? null : JSON.stringify(payload);
    const metaText = meta === null ? null : JSON.stringify(meta);
    const [encKeys, encApp, encTitle] = await Promise.all([
      encrypt(keystrokes),
      encrypt(applicationName),
      encrypt(windowTitle),
    ]);
    const [encPayload, encMeta] = await Promise.all([
      payloadText === null ? null : encrypt(payloadText),
      metaText === null ? null : encrypt(metaText),
    ]);
    insertStmt.run({
      timestamp,
      keystrokes: Buffer.from(encKeys),
      applicationName: Buffer.from(encApp),
      windowTitle: Buffer.from(encTitle),
      eventType,
      payload: encPayload === null ? null : Buffer.from(encPayload),
      meta: encMeta === null ? null : Buffer.from(encMeta),
    });
  }

  async function insertLogEvent({
    timestamp,
    keystrokes,
    applicationName,
    windowTitle,
  }: {
    timestamp: number;
    keystrokes: string;
    applicationName: string;
    windowTitle: string;
  }): Promise<void> {
    return insertRow({
      timestamp,
      keystrokes,
      applicationName,
      windowTitle,
      eventType: "keylog",
      payload: null,
      meta: null,
    });
  }

  async function insertScreenshotSummaryLogEvent({
    timestamp,
    applicationName,
    windowTitle,
    payload,
    meta,
  }: {
    timestamp: number;
    applicationName: string;
    windowTitle: string;
    payload: unknown;
    meta: unknown;
  }): Promise<void> {
    return insertRow({
      timestamp,
      keystrokes: "",
      applicationName,
      windowTitle,
      eventType: "screenshotSummary",
      payload,
      meta,
    });
  }

  async function getLogEventsSince(sinceMs: number): Promise<LogEvent[]> {
    const rows = selectSinceStmt.all(sinceMs) as Array<{
      id: number;
      timestamp: number;
      keystrokes: Buffer;
      applicationName: Buffer;
      windowTitle: Buffer;
      eventType: "keylog" | "screenshotSummary" | string;
      payload: Buffer | null;
      meta: Buffer | null;
    }>;

    const decoder = new TextDecoder();
    const events = await Promise.all(
      rows.map(async (row) => {
        const [keys, appName, title] = await Promise.all([
          decrypt(row.keystrokes),
          decrypt(row.applicationName),
          decrypt(row.windowTitle),
        ]);
        const [payloadBytes, metaBytes] = await Promise.all([
          row.payload ? decrypt(row.payload) : null,
          row.meta ? decrypt(row.meta) : null,
        ]);
        const payloadText = payloadBytes ? decoder.decode(payloadBytes) : null;
        const metaText = metaBytes ? decoder.decode(metaBytes) : null;
        let payload: unknown | null = null;
        let meta: unknown | null = null;
        if (payloadText) {
          try {
            payload = JSON.parse(payloadText);
          } catch {
            payload = payloadText;
          }
        }
        if (metaText) {
          try {
            meta = JSON.parse(metaText);
          } catch {
            meta = metaText;
          }
        }
        const repaired = repairLegacyAppWindowFields({
          applicationName: decoder.decode(appName),
          windowTitle: decoder.decode(title),
        });
        const eventType =
          row.eventType === "screenshotSummary" ? ("screenshotSummary" as const) : ("keylog" as const);
        return {
          id: row.id,
          timestamp: row.timestamp,
          keystrokes: decoder.decode(keys),
          applicationName: repaired.applicationName,
          windowTitle: repaired.windowTitle,
          eventType,
          payload,
          meta,
        };
      }),
    );

    return events;
  }

  function close(): void {
    db.close();
  }

  return { insertLogEvent, insertScreenshotSummaryLogEvent, getLogEventsSince, close };
}

let singleton:
  | ReturnType<typeof createLogeventsDb>
  | null = null;

function defaultDbPath(): string {
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, "files", "logevents.sqlite3");
}

function getSingleton() {
  if (singleton) return singleton;
  try {
    singleton = createLogeventsDb({ dbPath: defaultDbPath() });
  } catch (error) {
    logger.error("Failed to initialize logevents sqlite db:", error);
    throw error;
  }
  return singleton;
}

export async function insertLogEvent(args: {
  timestamp: number;
  keystrokes: string;
  applicationName: string;
  windowTitle: string;
}): Promise<void> {
  return getSingleton().insertLogEvent(args);
}

export async function insertScreenshotSummaryLogEvent(args: {
  timestamp: number;
  applicationName: string;
  windowTitle: string;
  payload: unknown;
  meta: unknown;
}): Promise<void> {
  return getSingleton().insertScreenshotSummaryLogEvent(args);
}

export async function getLogEventsSince(sinceMs: number): Promise<LogEvent[]> {
  return getSingleton().getLogEventsSince(sinceMs);
}
