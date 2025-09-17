import { createLogger, format, transports } from "winston";

const { combine, timestamp, printf, colorize, errors, splat } = format;

// Custom log format: include timestamp, level, message, and stack when present
const logFormat = printf(({ timestamp, level, message, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} [${level}] ${stack || message}${metaStr}`;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    errors({ stack: true }), // <-- capture stack trace
    splat(),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    colorize({ all: true }),
    logFormat
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: "logs/error.log", level: "error" }),
    new transports.File({ filename: "logs/combined.log" }),
  ],
  exitOnError: false,
});

// Stream interface for morgan or other HTTP loggers
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export const createSocketLogger = (socketLike?: { id?: string } | string) => {
  const id = typeof socketLike === "string" ? socketLike : socketLike?.id;
  const prefix = id ? `[socket:${id}]` : "[socket:unknown]";

  const info = (msg: string, meta?: Record<string, any>) =>
    logger.info(`${prefix} ${msg}`, meta);
  const warn = (msg: string, meta?: Record<string, any>) =>
    logger.warn(`${prefix} ${msg}`, meta);
  const error = (msg: string, meta?: Record<string, any>) =>
    logger.error(`${prefix} ${msg}`, meta);

  return { info, warn, error };
};

export default logger;
