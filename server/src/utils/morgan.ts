import morgan from 'morgan';
import logger from './logger';

const morganStream: morgan.StreamOptions = {
  write: (message: string): void => {
    logger.info(message.trim());
  },
};

const morganMiddleware = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream: morganStream }
);

export default morganMiddleware;
