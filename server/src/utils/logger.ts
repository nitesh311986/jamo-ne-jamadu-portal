import fs from 'fs';
import path from 'path';
import { createLogger, format, transports, type Logger } from 'winston';

const LOG_DIR: string = path.join(process.cwd(), 'logs');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logger: Logger = createLogger({
  level: process.env['LOG_LEVEL'] ?? 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'baps-anand-jamo-ne-jamadu' },
  transports: [
    new transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
    }),
    new transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
    }),
  ],
});

if (process.env['NODE_ENV'] !== 'production') {
  logger.add(
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, ...metadata }) => {
          const meta: string = Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : '';
          return `${String(timestamp)} [${level}]: ${String(message)} ${meta}`;
        })
      ),
    })
  );
}

export default logger;
