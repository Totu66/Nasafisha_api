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
  if (
    process.env.ALLOW_ACCESS_TEST_SEED !== 'true' ||
    process.env.NODE_ENV === 'production'
  ) {
    throw new Error(
      'Refusing to seed test accounts. Set ALLOW_ACCESS_TEST_SEED=true in a non-production environment to continue.',
    );
  }

  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error'],
  });

  try {
    const prisma = app.get(PrismaService);
    const pinHash = await argon2.hash('1234');
    const people = [
      {
        role: 'field_crew',
        name: 'Otieno Odhiambo',
        employeeId: 'NKR-0417',
        crewLabel: 'Crew B',
        zone: 'Section 58',
      },
      {
        role: 'field_supervisor',
        name: 'Achieng',
        employeeId: 'NKR-0100',
        zone: 'Lanet, Free Area',
      },
    ];

    for (const person of people) {
      await prisma.account.upsert({
        where: { employeeId: person.employeeId },
        create: { ...person, pinHash },
        update: {},
      });
    }

    console.log('Test accounts created or already present.');
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
