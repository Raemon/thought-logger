import type { SqlLogitem } from "./sqlKeylogTypes";

type SqlJsDatabase = {
  run: (sql: string, params?: unknown[]) => void;
  exec: (sql: string, params?: unknown[]) => Array<{ columns: string[]; values: unknown[][] }>;
  export: () => Uint8Array;
  close: () => void;
};

type SqlJsStatic = {
  Database: new (data?: Uint8Array) => SqlJsDatabase;
};

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

async function getSqlJs(): Promise<SqlJsStatic> {
  if (sqlJsPromise) return sqlJsPromise;
  sqlJsPromise = import("sql.js/dist/sql-asm.js").then((mod) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    (mod.default as (config?: unknown) => Promise<SqlJsStatic>)().then((sql) => sql),
  );
  return sqlJsPromise;
}

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS logitem (
  timestamp INTEGER NOT NULL,
  applicationName TEXT NOT NULL,
  windowTitle TEXT NOT NULL,
  keylogs TEXT NOT NULL
)`;

export class SqlKeylogRepository {
  private db: SqlJsDatabase;

  private constructor(db: SqlJsDatabase) {
    this.db = db;
    this.db.run(CREATE_TABLE_SQL);
  }

  static async initialize(dbBytes: Uint8Array | null): Promise<SqlKeylogRepository> {
    const SQL = await getSqlJs();
    const db = dbBytes ? new SQL.Database(dbBytes) : new SQL.Database();
    return new SqlKeylogRepository(db);
  }

  close(): void {
    this.db.close();
  }

  exportBytes(): Uint8Array {
    return this.db.export();
  }

  getLogitemsSinceTimestamp(sinceTimestampMs: number): SqlLogitem[] {
    const results = this.db.exec(
      "SELECT timestamp, applicationName, windowTitle, keylogs FROM logitem WHERE timestamp >= ? ORDER BY timestamp DESC",
      [sinceTimestampMs],
    );
    if (results.length === 0) return [];
    return results[0].values.map((row) => ({
      timestamp: row[0] as number,
      applicationName: row[1] as string,
      windowTitle: row[2] as string,
      keylogs: row[3] as string,
    }));
  }

  getAllLogitems(): SqlLogitem[] {
    const results = this.db.exec(
      "SELECT timestamp, applicationName, windowTitle, keylogs FROM logitem ORDER BY timestamp DESC",
    );
    if (results.length === 0) return [];
    return results[0].values.map((row) => ({
      timestamp: row[0] as number,
      applicationName: row[1] as string,
      windowTitle: row[2] as string,
      keylogs: row[3] as string,
    }));
  }

  private getLatestLogitem(): SqlLogitem | null {
    const results = this.db.exec(
      "SELECT timestamp, applicationName, windowTitle, keylogs FROM logitem ORDER BY timestamp DESC LIMIT 1",
    );
    if (results.length === 0) return null;
    if (results[0].values.length === 0) return null;
    const row = results[0].values[0];
    return {
      timestamp: row[0] as number,
      applicationName: row[1] as string,
      windowTitle: row[2] as string,
      keylogs: row[3] as string,
    };
  }

  appendKeystrokeToCurrentLogitem({
    nowTimestampMs,
    applicationName,
    windowTitle,
    keystroke,
  }: {
    nowTimestampMs: number;
    applicationName: string;
    windowTitle: string;
    keystroke: string;
  }): void {
    const latest = this.getLatestLogitem();
    const isLatestValid =
      latest &&
      latest.applicationName === applicationName &&
      latest.windowTitle === windowTitle &&
      nowTimestampMs - latest.timestamp <= 60 * 1000;

    if (!isLatestValid) {
      this.db.run(
        "INSERT INTO logitem (timestamp, applicationName, windowTitle, keylogs) VALUES (?, ?, ?, ?)",
        [nowTimestampMs, applicationName, windowTitle, keystroke],
      );
      return;
    }

    this.db.run(
      "UPDATE logitem SET keylogs = keylogs || ? WHERE timestamp = ? AND applicationName = ? AND windowTitle = ?",
      [keystroke, latest.timestamp, latest.applicationName, latest.windowTitle],
    );
  }
}

