import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  createReceipts,
  searchReceipts,
  getSevakReceiptSummary,
  exportReceiptsExcel,
} from '../controllers/receipt.controller';

const router: Router = Router();

router.post('/', authenticateToken, createReceipts);
router.get('/search', authenticateToken, searchReceipts);
router.get('/sevak/:sevakId/summary', authenticateToken, getSevakReceiptSummary);
router.get('/export/excel', authenticateToken, exportReceiptsExcel);

export default router;
