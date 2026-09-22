import { Request, Response } from 'express';
import { BookStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { logAuditEvent } from '../utils/audit';
import logger from '../utils/logger';
import { parsePaginationParams } from '../utils/pagination';

interface BatchAssignBody {
  sevakId: string;
  bookNumbers: string[];
}

interface UpdateBookBody {
  bookNumber: string;
}

function cleanBookNumber(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeBookNumbers(values: unknown[]): string[] {
  return values
    .filter((v): v is string => typeof v === 'string')
    .map(cleanBookNumber)
    .filter((v) => v.length > 0);
}

export async function getBooksBySevak(
  req: Request<{ sevakId: string }>,
  res: Response
): Promise<void> {
  const { sevakId } = req.params;
  const { page, limit, skip, take } = parsePaginationParams(req.query);

  try {
    const sevak = await prisma.sevak.findUnique({ where: { id: sevakId } });
    if (!sevak) {
      res.status(404).json({ error: 'Sevak not found' });
      return;
    }

    const where = { sevakId };
    const [total, books] = await prisma.$transaction([
      prisma.bookAllocation.count({ where }),
      prisma.bookAllocation.findMany({
        where,
        skip,
        take,
        orderBy: { assignedAt: 'desc' },
      }),
    ]);

    res.status(200).json({ books, total, page, limit });
  } catch (err) {
    logger.error('Get books by sevak error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function batchAssignBooks(
  req: Request<Record<string, never>, unknown, BatchAssignBody>,
  res: Response
): Promise<void> {
  const { sevakId } = req.body;
  const rawBookNumbers = Array.isArray(req.body.bookNumbers) ? req.body.bookNumbers : [];

  if (!sevakId?.trim()) {
    res.status(400).json({ error: 'sevakId is required' });
    return;
  }

  const bookNumbers = normalizeBookNumbers(rawBookNumbers);

  if (bookNumbers.length === 0) {
    res.status(400).json({ error: 'At least one book number is required' });
    return;
  }

  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const bookNumber of bookNumbers) {
    if (seen.has(bookNumber)) {
      duplicates.push(bookNumber);
    } else {
      seen.add(bookNumber);
    }
  }

  if (duplicates.length > 0) {
    res.status(400).json({
      error: 'Duplicate book numbers in request',
      duplicates: [...new Set(duplicates)],
    });
    return;
  }

  try {
    const sevak = await prisma.sevak.findUnique({ where: { id: sevakId } });
    if (!sevak) {
      res.status(404).json({ error: 'Sevak not found' });
      return;
    }

    const existing = await prisma.bookAllocation.findMany({
      where: { bookNumber: { in: bookNumbers } },
    });

    if (existing.length > 0) {
      res.status(409).json({
        error: 'One or more book numbers are already assigned',
        conflicts: existing.map((b) => b.bookNumber),
      });
      return;
    }

    const created = await prisma.$transaction(
      bookNumbers.map((bookNumber) =>
        prisma.bookAllocation.create({
          data: {
            bookNumber,
            sevakId,
            status: BookStatus.ASSIGNED,
          },
          include: { sevak: { select: { sevakCode: true, fullName: true } } },
        })
      )
    );

    const actorId = req.user?.userId ?? 'unknown';
    await logAuditEvent(actorId, 'BOOK_BATCH_ASSIGN', {
      sevakId,
      bookNumbers: bookNumbers.join(', '),
      count: bookNumbers.length,
    });

    logger.info('Books batch assigned', {
      actorId,
      sevakId,
      count: created.length,
      bookNumbers,
    });

    res.status(201).json({ books: created, count: created.length });
  } catch (err) {
    logger.error('Batch assign books error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateBook(
  req: Request<{ bookId: string }, unknown, UpdateBookBody>,
  res: Response
): Promise<void> {
  const { bookId } = req.params;
  const { bookNumber } = req.body;

  if (!bookNumber?.trim()) {
    res.status(400).json({ error: 'bookNumber is required' });
    return;
  }

  const normalizedNumber = cleanBookNumber(bookNumber);

  try {
    const book = await prisma.bookAllocation.findUnique({
      where: { id: bookId },
    });

    if (!book) {
      res.status(404).json({ error: 'Book allocation not found' });
      return;
    }

    const existing = await prisma.bookAllocation.findUnique({
      where: { bookNumber: normalizedNumber },
    });

    if (existing && existing.id !== bookId) {
      res.status(409).json({ error: 'Book number is already assigned' });
      return;
    }

    const updated = await prisma.bookAllocation.update({
      where: { id: bookId },
      data: { bookNumber: normalizedNumber },
    });

    const actorId = req.user?.userId ?? 'unknown';
    await logAuditEvent(actorId, 'BOOK_UPDATED', {
      bookId,
      sevakId: updated.sevakId,
      previousBookNumber: book.bookNumber,
      newBookNumber: updated.bookNumber,
    });

    logger.info('Book updated', {
      actorId,
      bookId,
      previousBookNumber: book.bookNumber,
      newBookNumber: updated.bookNumber,
    });

    res.status(200).json({ book: updated });
  } catch (err) {
    logger.error('Update book error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteBook(
  req: Request<{ bookId: string }>,
  res: Response
): Promise<void> {
  const { bookId } = req.params;

  try {
    const book = await prisma.bookAllocation.findUnique({
      where: { id: bookId },
    });

    if (!book) {
      res.status(404).json({ error: 'Book allocation not found' });
      return;
    }

    const receiptCount = await prisma.sevaReceipt.count({
      where: { bookNumber: book.bookNumber },
    });

    if (receiptCount > 0) {
      res.status(400).json({
        error: 'Cannot delete book with existing logged receipts',
      });
      return;
    }

    await prisma.bookAllocation.delete({
      where: { id: bookId },
    });

    const actorId = req.user?.userId ?? 'unknown';
    await logAuditEvent(actorId, 'BOOK_DELETED', {
      bookId,
      sevakId: book.sevakId,
      bookNumber: book.bookNumber,
    });

    logger.info('Book deleted', {
      actorId,
      bookId,
      sevakId: book.sevakId,
      bookNumber: book.bookNumber,
    });

    res.status(200).json({ message: 'Book allocation deleted' });
  } catch (err) {
    logger.error('Delete book error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}
