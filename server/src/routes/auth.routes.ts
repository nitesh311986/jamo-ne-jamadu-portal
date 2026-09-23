import { Router } from 'express';
import { authenticateToken, requireRoles } from '../middleware/auth.middleware';
import { login, createUser, getMe, listUsers, logout } from '../controllers/auth.controller';
import { RoleName } from '@prisma/client';

const router: Router = Router();

router.post('/login', login);
router.post('/logout', logout);

router.post(
  '/users',
  authenticateToken,
  requireRoles([RoleName.SUPER_ADMIN]),
  createUser
);

router.get('/me', authenticateToken, getMe);

router.get(
  '/users',
  authenticateToken,
  requireRoles([RoleName.SUPER_ADMIN]),
  listUsers
);

export default router;
