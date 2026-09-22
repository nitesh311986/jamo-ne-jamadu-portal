import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  createSevak,
  searchSevaks,
  exportSevaksExcel,
  updateSevak,
  deleteSevak,
} from '../controllers/sevak.controller';

const router: Router = Router();

router.post('/', authenticateToken, createSevak);
router.get('/search', authenticateToken, searchSevaks);
router.get('/export/excel', authenticateToken, exportSevaksExcel);
router.put('/:id', authenticateToken, updateSevak);
router.delete('/:id', authenticateToken, deleteSevak);

export default router;
