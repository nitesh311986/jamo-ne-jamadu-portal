import morgan from 'morgan';
import logger from './logger';

morgan.token('userId', (req) => (req as any).user?.userId ?? 'anonymous');

const morganStream: morgan.StreamOptions = {
  write: (message: string): void => {
    logger.info(message.trim());
  },
};

const morganMiddleware = morgan(
  ':remote-addr :method :url :status :res[content-length] - :response-time ms - userId::userId',
  { stream: morganStream }
);

export default morganMiddleware;
