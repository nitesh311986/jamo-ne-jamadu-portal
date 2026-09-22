import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  createReceipts,
  searchReceipts,
  getSevakReceiptSummary,
  exportReceiptsExcel,
  getSevakReceipts,
  updateReceipt,
  deleteReceipt,
  bulkSyncReceipts,
} from '../controllers/receipt.controller';

const router: Router = Router();

router.post('/', authenticateToken, createReceipts);
router.get('/search', authenticateToken, searchReceipts);
router.get('/sevak/:sevakId', authenticateToken, getSevakReceipts);
router.get('/sevak/:sevakId/summary', authenticateToken, getSevakReceiptSummary);
router.put('/:receiptId', authenticateToken, updateReceipt);
router.delete('/:receiptId', authenticateToken, deleteReceipt);
router.post('/bulk-sync', authenticateToken, bulkSyncReceipts);
router.get('/export/excel', authenticateToken, exportReceiptsExcel);

export default router;
