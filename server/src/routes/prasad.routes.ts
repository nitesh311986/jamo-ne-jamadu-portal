import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { getSevakOverview, distributePrasad } from '../controllers/prasad.controller';

const router: Router = Router();

router.get('/sevak/:sevakId', authenticateToken, getSevakOverview);
router.post('/distribute', authenticateToken, distributePrasad);

export default router;
