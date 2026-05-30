// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // pg v8+ treats sslmode=require as verify-full (full cert verification).
    // Amazon RDS CA cert is not in Ubuntu's default trust store, so verification fails.
    // Strip sslmode from the connection string and configure SSL explicitly instead.
    const rawUrl = process.env.DATABASE_URL ?? '';
    let connectionString = rawUrl;
    try {
      const url = new URL(rawUrl);
      url.searchParams.delete('sslmode');
      connectionString = url.toString();
    } catch {
      // keep rawUrl as-is if URL parsing fails
    }

    const pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
