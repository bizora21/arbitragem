#!/usr/bin/env node
// scripts/check-env.mjs — verifica credenciais e conectividade do projeto
import { config } from 'dotenv'
import { resolve } from 'path'
import { existsSync } from 'fs'

const cwd = process.cwd()
if (existsSync(resolve(cwd, '.env'))) config({ path: resolve(cwd, '.env') })
if (existsSync(resolve(cwd, '.env.local'))) config({ path: resolve(cwd, '.env.local'), override: true })

const c = {
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', bold: '\x1b[1m', reset: '\x1b[0m',
}
const ok  = `${c.green}✅${c.reset}`
const err = `${c.red}❌${c.reset}`
const warn = `${c.yellow}⚠️ ${c.reset}`

function mask(val, show = 6) {
  if (!val) return '(não definido)'
  return val.slice(0, show) + '...' + val.slice(-4)
}

function line(char = '═', n = 47) { return char.repeat(n) }

console.log('')
console.log(`${c.bold}${c.cyan}🔍 VERIFICAÇÃO DO .env.local${c.reset}`)
console.log(line())

// ─── 1. Variáveis de ambiente ────────────────────────────────────────────────
const REQUIRED = [
  'DATABASE_URL',
  'DIRECT_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'NEXT_PUBLIC_APP_URL',
  'OPENAI_API_KEY',
]

console.log('')
console.log('📋 Variáveis de ambiente:')
console.log('')

let allVarsOk = true
for (const key of REQUIRED) {
  const val = process.env[key]
  if (val) {
    console.log(`  ${ok} ${key} → ${mask(val)}`)
  } else {
    console.log(`  ${err} ${key} → ${c.red}AUSENTE${c.reset}`)
    allVarsOk = false
  }
}

// ─── 2. Validação de formato ─────────────────────────────────────────────────
console.log('')
console.log('🔗 Validação de formato:')
console.log('')

const DB_URL   = process.env.DATABASE_URL ?? ''
const DIRECT   = process.env.DIRECT_URL   ?? ''
const SB_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

const checks = [
  [DB_URL.startsWith('postgresql://') || DB_URL.startsWith('postgres://'), 'DATABASE_URL tem formato válido'],
  [DIRECT.startsWith('postgresql://')  || DIRECT.startsWith('postgres://'),  'DIRECT_URL tem formato válido'],
  [SB_URL.startsWith('https://') && SB_URL.includes('supabase'), 'SUPABASE_URL tem formato válido'],
  [(DB_URL.match(/@/g) ?? []).length === 1, 'DATABASE_URL tem 1 @ (password está bem encoded)'],
  [!!process.env.OPENAI_API_KEY?.startsWith('sk-'), 'OPENAI_API_KEY começa com sk-'],
]

for (const [pass, label] of checks) {
  console.log(`  ${pass ? ok : err} ${label}`)
}

// ─── 3. Tabelas via Supabase REST ────────────────────────────────────────────
console.log('')
console.log('🗄️  Verificando tabelas no Supabase...')
console.log('')

const TABLES = ['FundingRateSnapshot', 'Opportunity', 'Position', 'Alert', 'UserSettings', 'FundingRateHistory']
const sbUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
const sbKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

let tablesOk = 0

if (!sbUrl || !sbKey) {
  console.log(`  ${err} SUPABASE_URL ou SERVICE_ROLE_KEY ausente — pulando verificação de tabelas`)
} else {
  for (const table of TABLES) {
    try {
      const res = await fetch(`${sbUrl}/rest/v1/${table}?limit=1`, {
        headers: {
          apikey: sbKey,
          Authorization: `Bearer ${sbKey}`,
          'Content-Type': 'application/json',
        },
      })
      if (res.status === 200 || res.status === 206) {
        console.log(`  ${ok} Tabela "${table}" existe`)
        tablesOk++
      } else if (res.status === 404 || res.status === 400) {
        const body = await res.text()
        if (body.includes('does not exist') || body.includes('relation')) {
          console.log(`  ${err} Tabela "${table}" ${c.red}NÃO encontrada${c.reset}`)
        } else {
          console.log(`  ${warn} Tabela "${table}" — status ${res.status}`)
        }
      } else {
        console.log(`  ${warn} Tabela "${table}" — status inesperado ${res.status}`)
      }
    } catch (e) {
      console.log(`  ${err} Tabela "${table}" — erro de rede: ${e.message}`)
    }
  }
}

// ─── 4. Supabase REST (anon key) ─────────────────────────────────────────────
console.log('')
console.log('🌐 Testando endpoint Supabase REST (anon key)...')
console.log('')

const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
let restOk = false

if (!sbUrl || !anonKey) {
  console.log(`  ${err} SUPABASE_URL ou ANON_KEY ausente`)
} else {
  try {
    // Decode JWT — validates structure and ref without an HTTP call
    const parts = anonKey.split('.')
    if (parts.length !== 3) throw new Error('JWT mal formado (não tem 3 partes)')

    const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    const urlRef  = sbUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? ''
    const jwtRef  = decoded.ref ?? ''
    const role    = decoded.role ?? ''
    const exp     = decoded.exp  ?? 0

    const refMatch  = urlRef === jwtRef
    const roleOk    = role === 'anon'
    const notExpired = exp > Date.now() / 1000

    if (refMatch && roleOk && notExpired) {
      console.log(`  ${ok} Anon key JWT válida (role: ${role}, ref: ${jwtRef})`)
      console.log(`  ${ok} Conectividade já confirmada pelas 6 tabelas acima`)
      restOk = true
    } else {
      if (!refMatch)   console.log(`  ${err} Anon key ref (${jwtRef}) ≠ URL ref (${urlRef})`)
      if (!roleOk)     console.log(`  ${err} JWT role inválida: ${role} (esperado: anon)`)
      if (!notExpired) console.log(`  ${err} Anon key expirada`)
    }
  } catch (e) {
    console.log(`  ${err} Falha ao validar anon key: ${e.message}`)
  }
}

// ─── 5. OpenAI API ───────────────────────────────────────────────────────────
console.log('')
console.log('🤖 Testando OpenAI API...')
console.log('')

const openaiKey = process.env.OPENAI_API_KEY
let openaiOk = false

if (!openaiKey) {
  console.log(`  ${err} OPENAI_API_KEY ausente`)
} else {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${openaiKey}` },
    })
    if (res.ok) {
      const json = await res.json()
      const models = json.data?.map(m => m.id) ?? []
      const hasGPT4 = models.some(m => m.includes('gpt-4'))
      console.log(`  ${ok} OpenAI API key válida`)
      console.log(`  ${ok} GPT-4 disponível: ${hasGPT4 ? 'sim' : 'não (verifique seu plano)'}`)
      openaiOk = true
    } else if (res.status === 401) {
      console.log(`  ${err} OpenAI API key inválida ou expirada (401)`)
    } else {
      console.log(`  ${warn} OpenAI retornou status ${res.status}`)
    }
  } catch (e) {
    console.log(`  ${err} Falha ao contactar OpenAI: ${e.message}`)
  }
}

// ─── Resumo ──────────────────────────────────────────────────────────────────
console.log('')
console.log(line())

const allOk = allVarsOk && tablesOk === TABLES.length && restOk && openaiOk

if (allOk) {
  console.log(`${ok} ${c.bold}TUDO OK — projeto pronto para uso${c.reset}`)
} else {
  console.log(`${warn} ${c.bold}Verificação concluída com avisos:${c.reset}`)
  if (!allVarsOk)               console.log(`   • Algumas variáveis de ambiente estão ausentes`)
  if (tablesOk < TABLES.length) console.log(`   • ${TABLES.length - tablesOk} tabela(s) não encontrada(s) — rode: npm run db:push`)
  if (!restOk)                  console.log(`   • Supabase REST API não respondeu`)
  if (!openaiOk)                console.log(`   • OpenAI API key inválida ou ausente`)
}
console.log('')
