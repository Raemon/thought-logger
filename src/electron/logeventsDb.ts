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
};

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
    "CREATE TABLE IF NOT EXISTS logevent (id INTEGER PRIMARY KEY AUTOINCREMENT,timestamp INTEGER NOT NULL,keystrokes BLOB NOT NULL,applicationName BLOB NOT NULL,windowTitle BLOB NOT NULL)",
  );
  db.exec("CREATE INDEX IF NOT EXISTS logevent_timestamp ON logevent(timestamp)");

  const insertStmt = db.prepare(
    "INSERT INTO logevent (timestamp,keystrokes,applicationName,windowTitle) VALUES (@timestamp,@keystrokes,@applicationName,@windowTitle)",
  );
  const selectSinceStmt = db.prepare(
    "SELECT id,timestamp,keystrokes,applicationName,windowTitle FROM logevent WHERE timestamp >= ? ORDER BY timestamp DESC,id DESC",
  );

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
    const [encKeys, encApp, encTitle] = await Promise.all([
      encrypt(keystrokes),
      encrypt(applicationName),
      encrypt(windowTitle),
    ]);
    insertStmt.run({
      timestamp,
      keystrokes: Buffer.from(encKeys),
      applicationName: Buffer.from(encApp),
      windowTitle: Buffer.from(encTitle),
    });
  }

  async function getLogEventsSince(sinceMs: number): Promise<LogEvent[]> {
    const rows = selectSinceStmt.all(sinceMs) as Array<{
      id: number;
      timestamp: number;
      keystrokes: Buffer;
      applicationName: Buffer;
      windowTitle: Buffer;
    }>;

    const decoder = new TextDecoder();
    const events = await Promise.all(
      rows.map(async (row) => {
        const [keys, appName, title] = await Promise.all([
          decrypt(row.keystrokes),
          decrypt(row.applicationName),
          decrypt(row.windowTitle),
        ]);
        return {
          id: row.id,
          timestamp: row.timestamp,
          keystrokes: decoder.decode(keys),
          applicationName: decoder.decode(appName),
          windowTitle: decoder.decode(title),
        };
      }),
    );

    return events;
  }

  function close(): void {
    db.close();
  }

  return { insertLogEvent, getLogEventsSince, close };
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

export async function getLogEventsSince(sinceMs: number): Promise<LogEvent[]> {
  return getSingleton().getLogEventsSince(sinceMs);
}
