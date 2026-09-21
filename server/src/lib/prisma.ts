import { PrismaClient } from '@prisma/client';

const globalForPrisma: { prisma?: PrismaClient } = global as { prisma?: PrismaClient };

const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
