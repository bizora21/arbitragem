import { defineConfig } from 'prisma/config'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env before Prisma config is evaluated
config({ path: resolve(__dirname, '.env') })
config({ path: resolve(__dirname, '.env.local'), override: false })

const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? ''

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: dbUrl,
  },
})
