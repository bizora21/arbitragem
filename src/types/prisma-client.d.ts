// Prisma 7 + TypeScript bundler mode workaround
// The generated client lives in node_modules/.prisma/client but @prisma/client's
// default.d.ts re-exports from '.prisma/client/default' which bundler mode cannot resolve.
// This file makes the types available via the @/generated/prisma alias.
export * from '../../node_modules/.prisma/client/index'
