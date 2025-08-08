import winston from "winston";
import { homedir } from "node:os";

const home = homedir();
const logPath =
  process.platform === "darwin"
    ? `${home}/Library/Logs/thought-logger/combined.log`
    : `${home}/.local/state/log/thought-logger.log`;

const log = winston.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
    new winston.transports.File({
      filename: logPath,
    }),
  ],
});

export default log;
