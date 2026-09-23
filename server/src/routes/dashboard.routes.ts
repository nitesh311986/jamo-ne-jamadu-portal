import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { getDashboardStatsController } from '../controllers/dashboard.controller';

const router: Router = Router();

router.get('/stats', authenticateToken, getDashboardStatsController);

export default router;
