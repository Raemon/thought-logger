import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => {
  return {
    ipcMain: {
      handle: (): undefined => undefined,
      on: (): undefined => undefined,
    },
    app: {
      isPackaged: false,
      getPath: () => "/",
      getAppPath: () => "/",
      on: (): undefined => undefined,
      whenReady: () => Promise.reject(),
    },
  };
});

vi.mock("better-sqlite3", () => {
  type StoredRow = {
    id: number;
    timestamp: number;
    keystrokes: Buffer;
    applicationName: Buffer;
    windowTitle: Buffer;
  };
  type DbState = { rows: StoredRow[]; nextId: number };
  type InsertParams = {
    timestamp: number;
    keystrokes: Buffer;
    applicationName: Buffer;
    windowTitle: Buffer;
  };

  class FakeStatement {
    private readonly kind: "insert" | "selectSince";
    private readonly state: DbState;
    constructor(kind: "insert" | "selectSince", state: DbState) {
      this.kind = kind;
      this.state = state;
    }
    run(params: InsertParams) {
      if (this.kind !== "insert") throw new Error("run() only supported for insert");
      const row: StoredRow = {
        id: this.state.nextId++,
        timestamp: params.timestamp,
        keystrokes: params.keystrokes,
        applicationName: params.applicationName,
        windowTitle: params.windowTitle,
      };
      this.state.rows.push(row);
      return { changes: 1, lastInsertRowid: row.id };
    }
    all(sinceMs: number): StoredRow[] {
      if (this.kind !== "selectSince") throw new Error("all() only supported for selectSince");
      return this.state.rows
        .filter((r) => r.timestamp >= sinceMs)
        .sort((a, b) => (b.timestamp - a.timestamp) || (b.id - a.id));
    }
  }

  class FakeDatabase {
    private readonly state: DbState = { rows: [], nextId: 1 };
    pragma(): string {
      return "wal";
    }
    exec(): void {
      return;
    }
    prepare(sql: string) {
      if (sql.startsWith("INSERT INTO logevent")) return new FakeStatement("insert", this.state);
      if (sql.startsWith("SELECT id,timestamp,keystrokes,applicationName,windowTitle FROM logevent")) {
        return new FakeStatement("selectSince", this.state);
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }
    close(): void {
      return;
    }
  }

  return { __esModule: true, default: FakeDatabase };
});

describe("logeventsDb", () => {
  it("inserts and queries decrypted rows newest-first", async () => {
    const { createLogeventsDb } = await import("src/electron/logeventsDb");
    const encoder = new TextEncoder();
    const decrypt = async (ciphertext: Uint8Array<ArrayBufferLike>) => ciphertext;
    const encrypt = async (plaintext: string | Uint8Array<ArrayBufferLike>) =>
      typeof plaintext === "string" ? encoder.encode(plaintext) : plaintext;

    const db = createLogeventsDb({ dbPath: ":memory:", encrypt, decrypt });
    const now = Date.now();

    await db.insertLogEvent({
      timestamp: now - 2000,
      keystrokes: "a",
      applicationName: "App1",
      windowTitle: "Win1",
    });
    await db.insertLogEvent({
      timestamp: now - 1000,
      keystrokes: "b",
      applicationName: "App2",
      windowTitle: "",
    });

    const events = await db.getLogEventsSince(now - 60 * 60 * 1000);
    expect(events.length).toBe(2);
    expect(events[0].timestamp).toBe(now - 1000);
    expect(events[0].keystrokes).toBe("b");
    expect(events[0].applicationName).toBe("App2");
    expect(events[0].windowTitle).toBe("");
    expect(events[1].timestamp).toBe(now - 2000);
    expect(events[1].keystrokes).toBe("a");
    expect(events[1].applicationName).toBe("App1");
    expect(events[1].windowTitle).toBe("Win1");
    db.close();
  });
});
