import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  getPrasadSummary,
  getSevakSlabSummary,
  distributePrasad,
  exportPrasadExcel,
  allocateGift,
  getGiftSummary,
  getSevakGifts,
} from '../controllers/prasad.controller';

const router: Router = Router();

router.get('/summary', authenticateToken, getPrasadSummary);
router.get('/sevak/:sevakId/slab-summary', authenticateToken, getSevakSlabSummary);
router.post('/distribute', authenticateToken, distributePrasad);
router.get('/export', authenticateToken, exportPrasadExcel);
router.post('/gifts/allocate', authenticateToken, allocateGift);
router.get('/gifts/summary', authenticateToken, getGiftSummary);
router.get('/gifts/sevak/:sevakId', authenticateToken, getSevakGifts);

export default router;
