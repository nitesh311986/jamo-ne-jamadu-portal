import { Request, Response } from 'express';
import { getDashboardStats } from '../services/dashboard.service';
import logger from '../utils/logger';

export async function getDashboardStatsController(req: Request, res: Response): Promise<void> {
  try {
    const data = await getDashboardStats();
    logger.info('Dashboard stats fetched', { userId: req.user?.userId ?? 'unknown' });
    res.status(200).json({ success: true, data });
  } catch (err) {
    logger.error('Dashboard stats error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
