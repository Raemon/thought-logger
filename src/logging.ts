import winston from "winston";
import { DebugPreferences } from "./types/preferences";

const KiB = 1024;

const format = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.timestamp(),
  winston.format.printf(
    ({ timestamp, level, message }) =>
      `${timestamp} [${level.toUpperCase()}]: ${message}`,
  ),
);

const logger = winston.createLogger({
  levels: winston.config.syslog.levels,
  format,
  transports: [new winston.transports.Console({ level: "info" })],
});

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
