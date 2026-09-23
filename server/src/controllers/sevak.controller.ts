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

const YEAR = '2026';

function getNamePrefix(firstName: string, lastName: string): string {
  const firstInitial = (firstName.trim()[0] ?? 'x').toLowerCase();
  const lastInitial = (lastName.trim()[0] ?? 'x').toLowerCase();
  return `${firstInitial}${lastInitial}${YEAR}`;
}

export async function generateSevakCode(firstName: string, lastName: string): Promise<string> {
  const prefix = getNamePrefix(firstName, lastName);

  const existing = await prisma.sevak.findMany({
    where: { sevakCode: { startsWith: prefix } },
    select: { sevakCode: true },
  });

  let maxSuffix = 0;
  for (const { sevakCode } of existing) {
    const suffix = sevakCode.slice(prefix.length);
    const n = parseInt(suffix, 10);
    if (!Number.isNaN(n) && n > maxSuffix) {
      maxSuffix = n;
    }
  }

  const next = (maxSuffix + 1).toString().padStart(2, '0');
  return `${prefix}${next}`;
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
    const mobileExists = await prisma.sevak.findFirst({
      where: { mobile: mobile.trim() },
    });
    if (mobileExists) {
      res.status(409).json({
        error: `Mobile number ${mobile.trim()} is already registered with another Sevak`,
      });
      return;
    }

    if (whatsapp?.trim()) {
      const whatsappExists = await prisma.sevak.findFirst({
        where: { whatsapp: whatsapp.trim() },
      });
      if (whatsappExists) {
        res.status(409).json({
          error: `WhatsApp number ${whatsapp.trim()} is already registered with another Sevak`,
        });
        return;
      }
    }

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

    const mobileExists = await prisma.sevak.findFirst({
      where: { mobile: mobile.trim(), NOT: { id } },
    });
    if (mobileExists) {
      res.status(409).json({
        error: `Mobile number ${mobile.trim()} is already registered with another Sevak`,
      });
      return;
    }

    if (whatsapp?.trim()) {
      const whatsappExists = await prisma.sevak.findFirst({
        where: { whatsapp: whatsapp.trim(), NOT: { id } },
      });
      if (whatsappExists) {
        res.status(409).json({
          error: `WhatsApp number ${whatsapp.trim()} is already registered with another Sevak`,
        });
        return;
      }
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

export async function exportSevakBooksSummary(_req: Request, res: Response): Promise<void> {
  try {
    const sevaks = await prisma.sevak.findMany({
      orderBy: { createdAt: 'desc' },
      include: { assignedBooks: true },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sevak Book Allocations');

    worksheet.columns = [
      { header: 'Sevak Code', key: 'sevakCode', width: 18 },
      { header: 'Full Name (પૂરું નામ)', key: 'fullName', width: 30 },
      { header: 'Mobile (મોબાઇલ)', key: 'mobile', width: 18 },
      { header: 'Mandal (મંડળ)', key: 'mandal', width: 22 },
      { header: 'Kshetra (ક્ષેત્ર)', key: 'kshetra', width: 22 },
      { header: 'Assigned Books Count (કુલ ફાળવેલ બુક)', key: 'assignedBooksCount', width: 28 },
      { header: 'Allocated Book Numbers', key: 'allocatedBookNumbers', width: 28 },
      { header: 'Book Statuses', key: 'bookStatuses', width: 40 },
      { header: 'Target Contacts', key: 'expectedContacts', width: 20 },
    ];

    const saffronFill: Partial<ExcelJS.Fill> = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF9933' },
    };
    const navyFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: '000080' } };

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = saffronFill as ExcelJS.Fill;
      cell.font = navyFont as ExcelJS.Font;
      cell.alignment = { horizontal: 'center' };
    });

    const rows = sevaks.map((sevak) => {
      const bookNumbers = sevak.assignedBooks
        .map((b) => b.bookNumber)
        .sort((a, b) => a.localeCompare(b));
      const bookStatuses = sevak.assignedBooks
        .map((b) => `${b.bookNumber} (${b.status})`)
        .sort((a, b) => a.localeCompare(b));

      return {
        sevakCode: sevak.sevakCode,
        fullName: sevak.fullName,
        mobile: sevak.mobile,
        mandal: sevak.mandal,
        kshetra: sevak.kshetra,
        assignedBooksCount: sevak.assignedBooks.length,
        allocatedBookNumbers: bookNumbers.join(', '),
        bookStatuses: bookStatuses.join(', '),
        expectedContacts: sevak.expectedContacts,
      };
    });

    worksheet.addRows(rows);

    for (const column of worksheet.columns) {
      if (!column) continue;
      let maxLength = 0;
      const rawHeader = column.header;
      const headerText = Array.isArray(rawHeader)
        ? rawHeader.join(', ')
        : String(rawHeader ?? '');
      maxLength = Math.max(maxLength, headerText.length);

      (column as ExcelJS.Column).eachCell(
        { includeEmpty: false },
        (cell) => {
          const cellValue = String(cell.value ?? '');
          maxLength = Math.max(maxLength, cellValue.length);
        }
      );

      column.width = Math.min(maxLength + 4, 60);
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Sevak_Book_Allocations_2026.xlsx"'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    logger.error('Export sevak books summary error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}
