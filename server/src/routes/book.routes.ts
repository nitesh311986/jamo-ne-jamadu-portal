import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  batchAssignBooks,
  deleteBook,
  getBooksBySevak,
  updateBook,
} from '../controllers/book.controller';

const router: Router = Router();

router.get('/sevak/:sevakId', authenticateToken, getBooksBySevak);
router.post('/batch-assign', authenticateToken, batchAssignBooks);
router.put('/:bookId', authenticateToken, updateBook);
router.delete('/:bookId', authenticateToken, deleteBook);

export default router;
