import app from './app';
import logger from './utils/logger';

const PORT: number = Number(process.env['PORT'] ?? 5000);

app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});
