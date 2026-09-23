import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RoleName } from '@prisma/client';

const JWT_SECRET: string | undefined = process.env['JWT_SECRET'];

export interface TokenPayload {
  userId: string;
  email: string;
  fullName: string;
  role: RoleName;
}

export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const cookieToken: string | undefined = req.cookies?.auth_token;
  const authHeader: string | undefined = req.headers['authorization'];
  const token: string | undefined =
    cookieToken ?? authHeader?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  if (!JWT_SECRET) {
    res.status(500).json({ error: 'JWT secret not configured' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || !decoded) {
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }

    const payload = decoded as TokenPayload;
    req.user = {
      userId: payload.userId,
      email: payload.email,
      fullName: payload.fullName,
      role: payload.role,
    };
    next();
  });
}

export function requireRoles(roles: RoleName[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}
