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

  const people = [
    { role: 'executive', name: 'Town Clerk', email: 'clerk@nakuru.go.ke' },
    { role: 'operations_manager', name: 'Mwangi', email: 'm.mwangi@nakuru.go.ke' },
    { role: 'county_ict_admin', name: 'Kamau', email: 'ict@nakuru.go.ke' },
  ];

  for (const p of people) {
    await prisma.account.upsert({
      where: { email: p.email },
      create: { ...p, passwordHash },
      update: {},
    });
  }

  console.log('Admin accounts ready. Password: Password123!');
  await app.close();
}

main();
