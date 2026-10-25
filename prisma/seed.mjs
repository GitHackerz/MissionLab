import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_DEFAULT_PASSWORD || 'Password123!';
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();

  const accounts = [
    {
      email: 'commander@missionlab.local',
      name: 'Commander Habib',
      role: 'STUDENT',
      password,
    },
    {
      email: 'student@missionlab.local',
      name: 'Cadet Alex',
      role: 'STUDENT',
      password,
    },
    {
      email: 'teacher@missionlab.local',
      name: 'Instructor Davis',
      role: 'TEACHER',
      password,
    },
  ];

  for (const acc of accounts) {
    const user = await prisma.user.upsert({
      where: { email: acc.email },
      update: {
        name: acc.name,
        passwordHash,
        role: acc.role,
        emailVerifiedAt: now,
        onboardedAt: now,
      },
      create: {
        email: acc.email,
        name: acc.name,
        passwordHash,
        role: acc.role,
        emailVerifiedAt: now,
        onboardedAt: now,
      },
    });
    console.log(`Seeded account: ${user.email} (Role: ${user.role}, Password: ${acc.password})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
