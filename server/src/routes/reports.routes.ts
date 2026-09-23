import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { exportMasterSummaryExcel } from '../controllers/prasad.controller';

const router: Router = Router();

router.get('/master-summary/excel', authenticateToken, exportMasterSummaryExcel);

export default router;
