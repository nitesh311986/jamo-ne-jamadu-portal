import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { logAuditEvent } from '../utils/audit';
import logger from '../utils/logger';

interface AssignBookBody {
  bookNumber: string;
  sevakId: string;
}

export async function assignBook(
  req: Request<Record<string, never>, unknown, AssignBookBody>,
  res: Response
): Promise<void> {
  const { bookNumber, sevakId } = req.body;

  if (!bookNumber?.trim() || !sevakId?.trim()) {
    res.status(400).json({ error: 'bookNumber and sevakId are required' });
    return;
  }

  try {
    const sevak = await prisma.sevak.findUnique({ where: { id: sevakId } });
    if (!sevak) {
      res.status(404).json({ error: 'Sevak not found' });
      return;
    }

    const existing = await prisma.bookAllocation.findUnique({
      where: { bookNumber: bookNumber.trim() },
    });
    if (existing) {
      res.status(409).json({ error: 'Book number already assigned' });
      return;
    }

    const book = await prisma.bookAllocation.create({
      data: {
        bookNumber: bookNumber.trim(),
        sevakId,
      },
      include: { sevak: { select: { sevakCode: true, fullName: true } } },
    });

    const actorId = req.user?.userId ?? 'unknown';
    await logAuditEvent(actorId, 'BOOK_ASSIGNED', {
      bookNumber: book.bookNumber,
      sevakId: book.sevakId,
    });

    res.status(201).json({ book });
  } catch (err) {
    logger.error('Assign book error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getBooksBySevak(
  req: Request<{ sevakId: string }>,
  res: Response
): Promise<void> {
  const { sevakId } = req.params;

  try {
    const sevak = await prisma.sevak.findUnique({ where: { id: sevakId } });
    if (!sevak) {
      res.status(404).json({ error: 'Sevak not found' });
      return;
    }

    const books = await prisma.bookAllocation.findMany({
      where: { sevakId },
      orderBy: { assignedAt: 'desc' },
    });

    res.status(200).json({ books });
  } catch (err) {
    logger.error('Get books by sevak error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}
