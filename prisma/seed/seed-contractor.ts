import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import * as argon2 from 'argon2';
import { AccessModule } from '../../src/access/access.module';
import { PrismaService } from '../../src/prisma/prisma.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AccessModule],
})
class SeedModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error'],
  });

  const prisma = app.get(PrismaService);
  const passwordHash = await argon2.hash('Password123!');

  const contractors = [
    {
      role: 'contractor',
      name: 'Winfred Cherotich',
      email: 'cherotichwinfred66@gmail.com',
      phone: '+254722987654',
      zone: 'Zone E — Nakuru East & Section 58',
      crewLabel: 'Nakuru Green Clean Franchise Ltd',
      employeeId: 'CNT-NK-003',
    },
  ];

  for (const c of contractors) {
    await prisma.account.upsert({
      where: { email: c.email },
      create: { ...c, passwordHash, isActive: true },
      update: { passwordHash, isActive: true, role: 'contractor' },
    });
  }

  console.log(
    'Contractor account seeded successfully: cherotichwinfred66@gmail.com / Password123!',
  );
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
