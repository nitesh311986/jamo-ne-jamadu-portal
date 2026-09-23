import { PrismaClient, RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('--- Starting Database Seeding ---');

  const superAdminPassword = await bcrypt.hash('BapsAnand@2026', 10);
  const volunteerPassword = await bcrypt.hash('Sevak@123', 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@anandbaps.org' },
    create: {
      email: 'admin@anandbaps.org',
      passwordHash: superAdminPassword,
      fullName: 'Anand Mandir Super Admin',
      phoneNumber: '9879549734',
      role: RoleName.SUPER_ADMIN,
    },
    update: {
      fullName: 'Anand Mandir Super Admin',
      phoneNumber: '9879549734',
      role: RoleName.SUPER_ADMIN,
    },
  });

  const volunteer = await prisma.user.upsert({
    where: { email: 'sevak@anandbaps.org' },
    create: {
      email: 'sevak@anandbaps.org',
      passwordHash: volunteerPassword,
      fullName: 'Mandir Desk Volunteer',
      phoneNumber: '9879563095',
      role: RoleName.VOLUNTEER,
    },
    update: {
      fullName: 'Mandir Desk Volunteer',
      phoneNumber: '9879563095',
      role: RoleName.VOLUNTEER,
    },
  });

  console.log('Database seeded successfully:');
  console.log(`- Super Admin: ${superAdmin.email}`);
  console.log(`- Volunteer:   ${volunteer.email}`);
}

main()
  .catch((e: Error) => {
    console.error('Seeding process failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });