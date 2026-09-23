import prisma from '../lib/prisma';

export interface AuditDetails {
  [key: string]: string | number | boolean | null | Date | AuditDetails | AuditDetails[];
}

export async function logAuditEvent(
  userId: string,
  action: string,
  details: AuditDetails
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        details,
      },
    });
  } catch (err) {
    // Audit logging should never break the main flow.
    // eslint-disable-next-line no-console
    console.error('Failed to write audit log:', err);
  }
}
