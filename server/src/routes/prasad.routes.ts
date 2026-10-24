import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  getPrasadSummary,
  distributePrasad,
  exportPrasadExcel,
} from '../controllers/prasad.controller';

const router: Router = Router();

router.get('/summary', authenticateToken, getPrasadSummary);
router.post('/distribute', authenticateToken, distributePrasad);
router.get('/export', authenticateToken, exportPrasadExcel);

export default router;
