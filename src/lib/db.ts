// Prisma client — apenas disponível depois de `npx prisma generate`
// Todas as operações de runtime usam supabaseAdmin (REST/HTTPS).
// Este módulo é reservado para uso local/CLI.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _prisma: any = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPrisma(): any {
  if (!_prisma) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaClient } = require('@prisma/client')
      _prisma = new PrismaClient()
    } catch {
      console.warn('[db] @prisma/client não disponível — corre npx prisma generate')
    }
  }
  return _prisma
}

export const prisma = getPrisma()
export default prisma
