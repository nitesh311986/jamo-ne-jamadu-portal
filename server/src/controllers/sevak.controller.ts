import { Request, Response } from 'express';
import type { Sevak } from '@prisma/client';
import ExcelJS from 'exceljs';
import prisma from '../lib/prisma';
import { logAuditEvent } from '../utils/audit';
import logger from '../utils/logger';
import { parsePaginationParams } from '../utils/pagination';

interface CreateSevakBody {
  fullName: string;
  firstName: string;
  lastName: string;
  mobile: string;
  altMobile?: string | null;
  whatsapp?: string | null;
  address: string;
  mandal: string;
  kshetra: string;
  expectedContacts: number;
}

interface UpdateSevakBody {
  fullName: string;
  firstName: string;
  lastName: string;
  mobile: string;
  altMobile?: string | null;
  whatsapp?: string | null;
  address: string;
  mandal: string;
  kshetra: string;
  expectedContacts: number;
}

function getInitials(firstName: string, lastName: string): string {
  const firstInitial = (firstName.trim()[0] ?? '').toUpperCase();
  const lastInitial = (lastName.trim()[0] ?? 'X').toUpperCase();
  return `${firstInitial}${lastInitial}`;
}

function randomFourDigits(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

async function isCodeUnique(code: string): Promise<boolean> {
  const count = await prisma.sevak.count({
    where: { sevakCode: code },
  });
  return count === 0;
}

export async function generateSevakCode(firstName: string, lastName: string): Promise<string> {
  const base = getInitials(firstName, lastName);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = `${base}${randomFourDigits()}`;
    if (await isCodeUnique(code)) {
      return code;
    }
  }

  throw new Error('Unable to generate a unique sevak code');
}

function normalizeMobile(value: string | undefined | null): string {
  return (value ?? '').replace(/\D/g, '');
}

export async function createSevak(
  req: Request<Record<string, never>, unknown, CreateSevakBody>,
  res: Response
): Promise<void> {
  const {
    fullName,
    firstName,
    lastName,
    mobile,
    altMobile,
    whatsapp,
    address,
    mandal,
    kshetra,
    expectedContacts,
  } = req.body;

  if (
    !fullName?.trim() ||
    !firstName?.trim() ||
    !lastName?.trim() ||
    !mobile?.trim() ||
    !address?.trim() ||
    !mandal?.trim() ||
    !kshetra?.trim() ||
    expectedContacts === undefined ||
    expectedContacts === null
  ) {
    res.status(400).json({ error: 'Required fields are missing' });
    return;
  }

  if (
    typeof expectedContacts !== 'number' ||
    !Number.isInteger(expectedContacts) ||
    expectedContacts < 0
  ) {
    res.status(400).json({ error: 'expectedContacts must be a non-negative integer' });
    return;
  }

  if (normalizeMobile(mobile).length < 10) {
    res.status(400).json({ error: 'Mobile number must contain at least 10 digits' });
    return;
  }

  if (altMobile && normalizeMobile(altMobile).length < 10) {
    res.status(400).json({ error: 'Alt mobile number must contain at least 10 digits' });
    return;
  }

  if (whatsapp && normalizeMobile(whatsapp).length < 10) {
    res.status(400).json({ error: 'WhatsApp number must contain at least 10 digits' });
    return;
  }

  try {
    const sevakCode = await generateSevakCode(firstName, lastName);

    const sevak = await prisma.sevak.create({
      data: {
        sevakCode,
        fullName: fullName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mobile: mobile.trim(),
        altMobile: altMobile?.trim() || null,
        whatsapp: whatsapp?.trim() || null,
        address: address.trim(),
        mandal: mandal.trim(),
        kshetra: kshetra.trim(),
        expectedContacts,
      },
    });

    const actorId = req.user?.userId ?? 'unknown';
    await logAuditEvent(actorId, 'SEVAK_CREATED', {
      sevakId: sevak.id,
      sevakCode: sevak.sevakCode,
    });

    res.status(201).json({ sevak });
  } catch (err) {
    logger.error('Create sevak error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function searchSevaks(req: Request, res: Response): Promise<void> {
  const rawQuery = String(req.query.q ?? '').trim();
  const { page, limit, skip, take } = parsePaginationParams(req.query);

  const where = rawQuery.length > 0
    ? {
        OR: [
          { sevakCode: { startsWith: rawQuery, mode: 'insensitive' as const } },
          { mobile: { startsWith: rawQuery } },
          { altMobile: { startsWith: rawQuery } },
          { fullName: { contains: rawQuery, mode: 'insensitive' as const } },
        ],
      }
    : {};

  try {
    const [total, sevaks] = await prisma.$transaction([
      prisma.sevak.count({ where }),
      prisma.sevak.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { assignedBooks: true },
      }),
    ]);

    res.status(200).json({
      sevaks,
      total,
      page,
      limit,
    });
  } catch (err) {
    logger.error('Search sevaks error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function exportSevaksExcel(_req: Request, res: Response): Promise<void> {
  try {
    const sevaks: Sevak[] = await prisma.sevak.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sevaks');

    worksheet.columns = [
      { header: 'સેવક કોડ / Sevak Code', key: 'sevakCode', width: 18 },
      { header: 'પૂરું નામ / Full Name', key: 'fullName', width: 28 },
      { header: 'પ્રથમ નામ / First Name', key: 'firstName', width: 20 },
      { header: 'છેલ્લું નામ / Last Name', key: 'lastName', width: 20 },
      { header: 'મોબાઇલ / Mobile', key: 'mobile', width: 16 },
      { header: 'અન્ય મોબાઇલ / Alt Mobile', key: 'altMobile', width: 18 },
      { header: 'વ્હોટ્સએપ / WhatsApp', key: 'whatsapp', width: 18 },
      { header: 'સરનામું / Address', key: 'address', width: 36 },
      { header: 'મંડળ / Mandal', key: 'mandal', width: 20 },
      { header: 'ક્ષેત્ર / Kshetra', key: 'kshetra', width: 20 },
      { header: 'અપેક્ષિત સંપર્કો / Expected Contacts', key: 'expectedContacts', width: 24 },
      { header: 'બનાવેલ તારીખ / Created At', key: 'createdAt', width: 22 },
    ];

    const rows = sevaks.map((sevak) => ({
      ...sevak,
      createdAt: sevak.createdAt.toISOString(),
    }));

    worksheet.addRows(rows);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="sevaks.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    logger.error('Export sevaks error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateSevak(
  req: Request<{ id: string }, unknown, UpdateSevakBody>,
  res: Response
): Promise<void> {
  const { id } = req.params;
  const {
    fullName,
    firstName,
    lastName,
    mobile,
    altMobile,
    whatsapp,
    address,
    mandal,
    kshetra,
    expectedContacts,
  } = req.body;

  if (
    !fullName?.trim() ||
    !firstName?.trim() ||
    !lastName?.trim() ||
    !mobile?.trim() ||
    !address?.trim() ||
    !mandal?.trim() ||
    !kshetra?.trim() ||
    expectedContacts === undefined ||
    expectedContacts === null
  ) {
    res.status(400).json({ error: 'Required fields are missing' });
    return;
  }

  if (
    typeof expectedContacts !== 'number' ||
    !Number.isInteger(expectedContacts) ||
    expectedContacts < 0
  ) {
    res.status(400).json({ error: 'expectedContacts must be a non-negative integer' });
    return;
  }

  if (normalizeMobile(mobile).length < 10) {
    res.status(400).json({ error: 'Mobile number must contain at least 10 digits' });
    return;
  }

  if (altMobile && normalizeMobile(altMobile).length < 10) {
    res.status(400).json({ error: 'Alt mobile number must contain at least 10 digits' });
    return;
  }

  if (whatsapp && normalizeMobile(whatsapp).length < 10) {
    res.status(400).json({ error: 'WhatsApp number must contain at least 10 digits' });
    return;
  }

  try {
    const existing = await prisma.sevak.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Sevak not found' });
      return;
    }

    const sevak = await prisma.sevak.update({
      where: { id },
      data: {
        fullName: fullName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mobile: mobile.trim(),
        altMobile: altMobile?.trim() || null,
        whatsapp: whatsapp?.trim() || null,
        address: address.trim(),
        mandal: mandal.trim(),
        kshetra: kshetra.trim(),
        expectedContacts,
      },
    });

    const actorId = req.user?.userId ?? 'unknown';
    await logAuditEvent(actorId, 'SEVAK_UPDATE', {
      sevakId: sevak.id,
      sevakCode: sevak.sevakCode,
    });

    logger.info('Sevak updated', {
      actorId,
      sevakId: sevak.id,
      sevakCode: sevak.sevakCode,
    });

    res.status(200).json({ sevak });
  } catch (err) {
    logger.error('Update sevak error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteSevak(
  req: Request<{ id: string }>,
  res: Response
): Promise<void> {
  const { id } = req.params;

  try {
    const sevak = await prisma.sevak.findUnique({
      where: { id },
      include: { receipts: { take: 1 } },
    });

    if (!sevak) {
      res.status(404).json({ error: 'Sevak not found' });
      return;
    }

    const receiptCount = await prisma.sevaReceipt.count({ where: { sevakId: id } });
    if (receiptCount > 0) {
      res.status(400).json({ error: 'Cannot delete Sevak with active donation receipts' });
      return;
    }

    await prisma.$transaction([
      prisma.bookAllocation.deleteMany({ where: { sevakId: id } }),
      prisma.prasadDistribution.deleteMany({ where: { sevakId: id } }),
      prisma.sevak.delete({ where: { id } }),
    ]);

    const actorId = req.user?.userId ?? 'unknown';
    await logAuditEvent(actorId, 'SEVAK_DELETE', {
      sevakId: sevak.id,
      sevakCode: sevak.sevakCode,
    });

    logger.info('Sevak deleted', {
      actorId,
      sevakId: sevak.id,
      sevakCode: sevak.sevakCode,
    });

    res.status(200).json({ message: 'Sevak deleted' });
  } catch (err) {
    logger.error('Delete sevak error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}
