import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { RoleName, type User } from '@prisma/client';
import prisma from '../lib/prisma';
import { logAuditEvent } from '../utils/audit';
import logger from '../utils/logger';

const JWT_SECRET: string | undefined = process.env['JWT_SECRET'];

export type SafeUser = Omit<User, 'passwordHash'>;

interface LoginBody {
  email: string;
  password: string;
}

interface CreateUserBody {
  email: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
  role: RoleName;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  fullName: string;
  role: RoleName;
}

function excludePasswordHash(user: User): SafeUser {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function generateToken(payload: AuthTokenPayload): string {
  if (!JWT_SECRET) {
    throw new Error('JWT secret is not configured');
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

export async function login(req: Request<Record<string, never>, unknown, LoginBody>, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isMatch: boolean = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const payload: AuthTokenPayload = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };

    const token: string = generateToken(payload);

    await logAuditEvent(user.id, 'USER_LOGIN', { email: user.email, ip: req.ip ?? null });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 12 * 60 * 60 * 1000,
    });

    res.status(200).json({
      user: excludePasswordHash(user),
    });
  } catch (err) {
    logger.error('Login error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createUser(req: Request<Record<string, never>, unknown, CreateUserBody>, res: Response): Promise<void> {
  const { email, password, fullName, phoneNumber, role } = req.body;

  if (!email || !password || !fullName || !role) {
    res.status(400).json({ error: 'Email, password, fullName, and role are required' });
    return;
  }

  if (!Object.values(RoleName).includes(role)) {
    res.status(400).json({ error: 'Invalid role' });
    return;
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

    const passwordHash: string = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        fullName,
        phoneNumber,
        role,
      },
    });

    const actorId: string = req.user?.userId ?? 'unknown';
    await logAuditEvent(actorId, 'USER_CREATED', {
      createdUserId: user.id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      user: excludePasswordHash(user),
    });
  } catch (err) {
    logger.error('Create user error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({
      user: excludePasswordHash(user),
    });
  } catch (err) {
    logger.error('Get me error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const safeUsers: SafeUser[] = users.map(excludePasswordHash);

    res.status(200).json({
      users: safeUsers,
    });
  } catch (err) {
    logger.error('List users error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie('auth_token');
  res.status(200).json({ success: true, message: 'Logged out successfully' });
}
