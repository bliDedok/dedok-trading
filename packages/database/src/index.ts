import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client/client.js';

let client: PrismaClient | undefined;

export function getPrismaClient(databaseUrl: string): PrismaClient {
  client ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = undefined;
  }
}

export type { PrismaClient } from './generated/client/client.js';
