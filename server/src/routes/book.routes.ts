import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { assignBook, getBooksBySevak } from '../controllers/book.controller';

const router: Router = Router();

router.post('/assign', authenticateToken, assignBook);
router.get('/sevak/:sevakId', authenticateToken, getBooksBySevak);

export default router;
