// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client') as typeof import('@/generated/prisma')
import { PrismaPg } from '@prisma/adapter-pg'

type PC = InstanceType<typeof PrismaClient>

const globalForPrisma = globalThis as unknown as { prisma: PC | undefined }

function createClient(): PC {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.warn('[db] DATABASE_URL not set – DB ops will fail at runtime')
    return new PrismaClient()
  }
  const adapter = new PrismaPg(url)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter: adapter as any })
}

export const prisma: PC = globalForPrisma.prisma ?? createClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
export default prisma
