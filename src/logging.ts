import * as winston from "winston";
import Transport from "winston-transport";
import { DebugPreferences } from "./types/preferences";
import { LogEntry } from "winston";

const KiB = 1024;

let recentErrors: string[] = [];
const recentErrorsListeners: ((messages: string[]) => void)[] = [];
let latestError: string | null = null;
const latestErrorListeners: ((message: string) => void)[] = [];

export const getLatestError = (): string | null => latestError;
export const onLatestError = (
  listener: (message: string) => void,
): (() => void) => {
  latestErrorListeners.push(listener);
  return () => {
    const index = latestErrorListeners.indexOf(listener);
    if (index > -1) {
      latestErrorListeners.splice(index, 1);
    }
  };
};

export const getRecentErrors = (): string[] => recentErrors;
export const onRecentErrors = (
  listener: (messages: string[]) => void,
): (() => void) => {
  recentErrorsListeners.push(listener);
  return () => {
    const index = recentErrorsListeners.indexOf(listener);
    if (index > -1) {
      recentErrorsListeners.splice(index, 1);
    }
  };
};

const format = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.timestamp(),
  winston.format.printf(
    ({ timestamp, level, message }) =>
      `${timestamp} [${level.toUpperCase()}]: ${message}`,
  ),
);

class LatestErrorTransport extends Transport {
  log(info: LogEntry, callback: () => void) {
    setImmediate(() => this.emit("logged", info));
    if (info.level === "error") {
      const formattedMessage = info.message;
      latestError = formattedMessage;
      recentErrors = [formattedMessage, ...recentErrors].slice(0, 3);
      for (const listener of latestErrorListeners) {
        listener(formattedMessage);
      }
      for (const listener of recentErrorsListeners) {
        listener(recentErrors);
      }
    }
    callback();
  }
}

const logger = winston.createLogger({
  levels: winston.config.syslog.levels,
  format,
  transports: [new winston.transports.Console({ level: "info" })],
  handleExceptions: true,
  handleRejections: true,
});

logger.add(new LatestErrorTransport({ level: "debug" }));

export const updateDebugPreferences = (prefs: DebugPreferences): void => {
  logger.transports
    .filter((t) => t instanceof winston.transports.File)
    .forEach((t) => (t.silent = !prefs.loggingEnabled));
};

export const logToFile = (path: string): void => {
  const fileTransport = new winston.transports.File({
    dirname: path,
    filename: "debug.log",
    level: "debug",
    maxsize: 100 * KiB,
    maxFiles: 3,
    tailable: true,
  });

  logger.add(fileTransport);
};

export default logger;
