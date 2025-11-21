import winston from "winston";
import { homedir } from "node:os";

const KiB = 1024;

const home = homedir();
const logPath =
  process.platform === "darwin"
    ? `${home}/Library/Logs/thought-logger/combined.log`
    : `${home}/.local/state/log/thought-logger.log`;

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
  transports: [
    new winston.transports.Console({ level: "info" }),
    new winston.transports.File({
      filename: logPath,
      level: "debug",
      maxsize: 100 * KiB,
      maxFiles: 3,
    }),
  ],
});

export default logger;
