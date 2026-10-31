import { Request, Response } from 'express';
import { getDashboardStats } from '../services/dashboard.service';
import logger from '../utils/logger';

export async function getDashboardStatsController(req: Request, res: Response): Promise<void> {
  try {
    const data = await getDashboardStats();
    logger.info('Dashboard stats fetched', { userId: req.user?.userId ?? 'unknown' });
    res.status(200).json({ success: true, data });
  } catch (err) {
    const error = err as Error & { code?: string };
    console.error('[DashboardController] stats failed:', {
      message: error?.message ?? String(err),
      code: error?.code ?? null,
      stack: error?.stack,
    });
    logger.error('Dashboard stats error', {
      error: error?.message ?? String(err),
      code: error?.code ?? null,
      stack: error?.stack,
    });
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
      code: error?.code || null,
    });
  }
}
