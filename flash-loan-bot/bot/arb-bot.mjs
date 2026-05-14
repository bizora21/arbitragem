/**
 * Flash Loan Arbitrage Bot — Base Chain
 * Polls the scanner API and executes profitable opportunities via FlashLoanArb.sol
 */
import { ethers }    from 'ethers'
import { config }    from 'dotenv'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

config()

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

// ── Load compiled ABI ─────────────────────────────────────────────────────────
const artifactPath = join(__dirname, '../artifacts/contracts/FlashLoanArb.sol/FlashLoanArb.json')
let ABI
try {
  ABI = JSON.parse(readFileSync(artifactPath, 'utf8')).abi
} catch {
  console.error('❌ Artifact not found. Compile first:  npm run compile')
  process.exit(1)
}

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_RPC_URL     = process.env.BASE_RPC_URL      || 'https://mainnet.base.org'
const PRIVATE_KEY      = process.env.PRIVATE_KEY
const CONTRACT_ADDR    = process.env.CONTRACT_ADDRESS
const MIN_NET_EDGE_BP  = parseFloat(process.env.MIN_NET_EDGE_BP    || '8')
const MIN_PROFIT_USD   = parseFloat(process.env.MIN_PROFIT_USD     || '1.00')
const FLASH_AMOUNT_USD = parseFloat(process.env.FLASH_LOAN_AMOUNT  || '10000')
const SCAN_INTERVAL_MS = parseInt(process.env.SCAN_INTERVAL_MS     || '15000')
const SCANNER_URL      = 'https://arbitragem-eta.vercel.app/api/flash-loan'
const GAS_LIMIT        = 600_000n
const WETH_PRICE_USD   = 3500
const CBBTC_PRICE_USD  = 95000

if (!PRIVATE_KEY)   { console.error('❌ PRIVATE_KEY missing in .env');    process.exit(1) }
if (!CONTRACT_ADDR) { console.error('❌ CONTRACT_ADDRESS missing in .env'); process.exit(1) }

// ── Token registry ────────────────────────────────────────────────────────────
const TOKENS = {
  USDC:  { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6  },
  USDbC: { address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', decimals: 6  },
  USDT:  { address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6  },
  WETH:  { address: '0x4200000000000000000000000000000000000006', decimals: 18 },
  cbETH: { address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7AA3cf0DEc22', decimals: 18 },
  weETH: { address: '0x04c0599A5a08C8Af1f776801855A2C0f6f2586c2', decimals: 18 },
  rETH:  { address: '0xB6fe221Fe9EeC5f639e95A61E9d44E0b35771910', decimals: 18 },
  AERO:  { address: '0x940181a94A35A4569E4529A3CDfB74bc389882D0', decimals: 18 },
  cbBTC: { address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', decimals: 8  },
}

const STABLE_TOKENS = new Set(['USDC', 'USDbC', 'USDT', 'DAI'])
const ZERO_ADDR     = '0x0000000000000000000000000000000000000000'

// ── DEX registry ──────────────────────────────────────────────────────────────
// type: 0=V2 (address[] path), 1=UniV3 (no deadline), 2=PCS (with deadline), 3=Aerodrome (Route struct)
// fee:  V3 → fee tier (500/3000/10000); Aerodrome → 0=volatile, 1=stable
const DEX_MAP = {
  'Aerodrome':      { router: '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43', type: 3, fee: 0    },
  'Aerodrome V2':   { router: '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43', type: 3, fee: 0    },
  'Uniswap V3':     { router: '0x2626664c2603336E57B271c5C0b26F421741e481', type: 1, fee: 3000  },
  'Uniswap V4':     { router: '0x2626664c2603336E57B271c5C0b26F421741e481', type: 1, fee: 3000  },
  'PancakeSwap':    { router: '0x1b81D678ffb9C0263b24A97847620C99d213eB14', type: 2, fee: 500   },
  'PancakeSwap V3': { router: '0x1b81D678ffb9C0263b24A97847620C99d213eB14', type: 2, fee: 500   },
  'SushiSwap':      { router: '0x6BDED42C6DA8FBf0d2bA55B2fa120cB5E8955D3b', type: 0, fee: 0    },
  'BaseSwap':       { router: '0x327Df1E72FdB0eF3E7A1E872E15Aed1b69E5EeAa', type: 0, fee: 0    },
  // TODO: fill these router addresses (set to zero to skip automatically)
  'QuickSwap':      { router: ZERO_ADDR, type: 0, fee: 0 },
  'Alien Base':     { router: ZERO_ADDR, type: 0, fee: 0 },
  'Equalizer':      { router: ZERO_ADDR, type: 0, fee: 0 },
  'SharkSwap':      { router: ZERO_ADDR, type: 0, fee: 0 },
  'Velocimeter':    { router: ZERO_ADDR, type: 0, fee: 0 },
  'SwapBased':      { router: ZERO_ADDR, type: 0, fee: 0 },
  'DackieSwap':     { router: ZERO_ADDR, type: 0, fee: 0 },
  'Solidly':        { router: ZERO_ADDR, type: 0, fee: 0 },
  'iZiSwap':        { router: ZERO_ADDR, type: 1, fee: 400 },
  'Curve':          { router: ZERO_ADDR, type: 9, fee: 0 },   // unsupported
  'Balancer':       { router: ZERO_ADDR, type: 9, fee: 0 },   // unsupported
}

// ── Param builder ─────────────────────────────────────────────────────────────

function getFlashTokenName(t0, t1) {
  if (STABLE_TOKENS.has(t1)) return t1
  if (STABLE_TOKENS.has(t0)) return t0
  if (t1 === 'WETH') return t1
  if (t0 === 'WETH') return t0
  return t1  // fallback: use token1 as flash token
}

function buildParams(opp) {
  const [t0Name, t1Name] = opp.pair.split('/')
  const token0 = TOKENS[t0Name]
  const token1 = TOKENS[t1Name]
  if (!token0 || !token1) return null

  const buyDex  = DEX_MAP[opp.buyDex]
  const sellDex = DEX_MAP[opp.sellDex]
  if (!buyDex || !sellDex)                  return null
  if (buyDex.router  === ZERO_ADDR)         return null
  if (sellDex.router === ZERO_ADDR)         return null
  if (buyDex.type  >= 9 || sellDex.type >= 9) return null  // skip Curve/Balancer

  const flashName  = getFlashTokenName(t0Name, t1Name)
  const buyName    = flashName === t1Name ? t0Name : t1Name
  const flashToken = TOKENS[flashName]
  const buyToken   = TOKENS[buyName]

  let flashAmount
  if (flashToken.decimals === 18) {
    flashAmount = ethers.parseUnits((FLASH_AMOUNT_USD / WETH_PRICE_USD).toFixed(6), 18)
  } else if (flashToken.decimals === 8) {
    flashAmount = ethers.parseUnits((FLASH_AMOUNT_USD / CBBTC_PRICE_USD).toFixed(8), 8)
  } else {
    flashAmount = ethers.parseUnits(FLASH_AMOUNT_USD.toFixed(6), flashToken.decimals)
  }

  return {
    flashToken:     flashToken.address,
    flashTokenName: flashName,
    flashAmount,
    buyToken:       buyToken.address,
    buyTokenName:   buyName,
    buyRouter:      buyDex.router,
    sellRouter:     sellDex.router,
    buyDexType:     buyDex.type,
    sellDexType:    sellDex.type,
    buyPoolFee:     buyDex.fee,
    sellPoolFee:    sellDex.fee,
    minProfitBps:   1n,
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────

const stats = {
  scans:        0,
  found:        0,
  executions:   0,
  successes:    0,
  failures:     0,
  profitWei:    0n,
  gasWei:       0n,
  startTime:    Date.now(),
}

function printStats() {
  const uptime = Math.floor((Date.now() - stats.startTime) / 1000)
  const h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60), s = uptime % 60
  const uptimeStr = `${h}h${m}m${s}s`
  console.log(`\n📊 Stats [${uptimeStr}]  scans=${stats.scans}  found=${stats.found}  execs=${stats.executions}  ✅${stats.successes}  ❌${stats.failures}  gas=${ethers.formatEther(stats.gasWei)} ETH\n`)
}

// ── Bot loop ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  🤖 Flash Loan Arb Bot — Base Chain')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📋 Contract:   ${CONTRACT_ADDR}`)
  console.log(`⚙️  Min edge:   ${MIN_NET_EDGE_BP} bp`)
  console.log(`💰 Min profit: $${MIN_PROFIT_USD}`)
  console.log(`💵 Flash size: $${FLASH_AMOUNT_USD}`)
  console.log(`🔄 Interval:   ${SCAN_INTERVAL_MS / 1000}s`)

  const provider = new ethers.JsonRpcProvider(BASE_RPC_URL)
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider)
  const contract = new ethers.Contract(CONTRACT_ADDR, ABI, wallet)

  const ethBal = await provider.getBalance(wallet.address)
  console.log(`\n💳 Wallet:     ${wallet.address}`)
  console.log(`⛽ ETH:        ${ethers.formatEther(ethBal)} ETH`)

  if (ethBal < ethers.parseEther('0.001')) {
    console.warn('\n⚠️  Low ETH balance. Each tx costs ~$0.03–0.10 in gas.')
    console.warn('   Get at least 0.005 ETH on Base before running the bot.\n')
  }

  console.log('\n🟢 Bot started. Ctrl+C to stop.\n')

  let executing = false

  async function scan() {
    stats.scans++
    try {
      const res  = await fetch(SCANNER_URL, { signal: AbortSignal.timeout(10_000) })
      const json = await res.json()
      const all  = json.data?.opportunities ?? []

      const filtered = all
        .filter(o => o.netEdgeBp >= MIN_NET_EDGE_BP && o.estimatedProfitUsd >= MIN_PROFIT_USD)
        .sort((a, b) => b.estimatedProfitUsd - a.estimatedProfitUsd)

      stats.found += filtered.length

      if (filtered.length === 0) {
        process.stdout.write(`\r[${new Date().toTimeString().slice(0,8)}] scan #${stats.scans} — ${all.length} total, none qualify   `)
        return
      }

      console.log(`\n[${new Date().toISOString()}] scan #${stats.scans} — ${filtered.length} opportunities (${all.length} total)`)

      if (executing) {
        console.log('⏳ Previous tx in flight — skipping this cycle')
        return
      }

      // Try each opportunity in rank order until we find one we can build params for
      let params = null
      let best   = null
      for (const opp of filtered) {
        const p = buildParams(opp)
        if (p) { params = p; best = opp; break }
        console.log(`   ⚠️  Skip ${opp.pair} (${opp.buyDex}→${opp.sellDex}): no router`)
      }

      if (!params) {
        console.log('   ⚠️  All opportunities use unsupported DEXes — waiting')
        return
      }

      const flashFmt = ethers.formatUnits(params.flashAmount, TOKENS[params.flashTokenName].decimals)
      console.log(`🎯 ${best.pair}  ${best.buyDex}→${best.sellDex}  edge=${best.netEdgeBp.toFixed(1)}bp  profit≈$${best.estimatedProfitUsd.toFixed(2)}`)
      console.log(`   flash ${flashFmt} ${params.flashTokenName}  |  buy ${params.buyTokenName}  |  types buy=${params.buyDexType} sell=${params.sellDexType}`)

      executing = true
      stats.executions++

      try {
        const tx = await contract.executeArbitrage(
          params.flashToken,
          params.flashAmount,
          params.buyToken,
          params.buyRouter,
          params.sellRouter,
          params.buyDexType,
          params.sellDexType,
          params.buyPoolFee,
          params.sellPoolFee,
          params.minProfitBps,
          { gasLimit: GAS_LIMIT }
        )
        console.log(`🚀 TX: ${tx.hash}`)

        const receipt = await tx.wait()
        const gasUsed = receipt.gasUsed * receipt.gasPrice
        stats.gasWei += gasUsed

        if (receipt.status === 1) {
          // Parse profit from ArbitrageExecuted event
          const evt = receipt.logs
            .map(log => { try { return contract.interface.parseLog(log) } catch { return null } })
            .find(e => e?.name === 'ArbitrageExecuted')
          const profit = evt ? evt.args.profit : 0n
          stats.profitWei += profit
          stats.successes++
          const profitFmt = ethers.formatUnits(profit, TOKENS[params.flashTokenName].decimals)
          console.log(`✅ Profit: ${profitFmt} ${params.flashTokenName}  |  gas: ${ethers.formatEther(gasUsed)} ETH`)
        } else {
          stats.failures++
          console.log(`❌ TX reverted — spread closed between scan and execution (gas only, no capital loss)`)
        }
      } catch (err) {
        stats.failures++
        const msg = (err.shortMessage || err.message || String(err)).slice(0, 300)
        console.log(`❌ Error: ${msg}`)
      }

      executing = false
      printStats()
    } catch (err) {
      console.error(`\n⚠️  Scan error: ${err.message}`)
    }
  }

  // Initial scan immediately, then recurring
  await scan()
  setInterval(scan, SCAN_INTERVAL_MS)
}

main().catch(console.error)
