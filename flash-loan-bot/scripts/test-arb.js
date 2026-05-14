/**
 * Dry-run: fetches scanner opportunities and validates contract param parsing
 * without executing any on-chain transaction.
 */
const { ethers } = require('ethers')
require('dotenv').config()

const SCANNER_URL     = 'https://arbitragem-eta.vercel.app/api/flash-loan'
const MIN_NET_EDGE_BP = parseFloat(process.env.MIN_NET_EDGE_BP   || '8')
const MIN_PROFIT_USD  = parseFloat(process.env.MIN_PROFIT_USD    || '1.00')
const FLASH_AMOUNT_USD = parseFloat(process.env.FLASH_LOAN_AMOUNT || '10000')

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

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

// type: 0=V2, 1=UniV3 (no deadline), 2=PCS (with deadline), 3=Aerodrome (Route struct)
// fee: V3 = fee tier; Aerodrome: 0=volatile, 1=stable
const DEX_MAP = {
  'Aerodrome':      { router: '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43', type: 3, fee: 0 },
  'Aerodrome V2':   { router: '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43', type: 3, fee: 0 },
  'Uniswap V3':     { router: '0x2626664c2603336E57B271c5C0b26F421741e481', type: 1, fee: 3000 },
  'Uniswap V4':     { router: '0x2626664c2603336E57B271c5C0b26F421741e481', type: 1, fee: 3000 },
  'PancakeSwap':    { router: '0x1b81D678ffb9C0263b24A97847620C99d213eB14', type: 2, fee: 500  },
  'PancakeSwap V3': { router: '0x1b81D678ffb9C0263b24A97847620C99d213eB14', type: 2, fee: 500  },
  'SushiSwap':      { router: '0x6BDED42C6DA8FBf0d2bA55B2fa120cB5E8955D3b', type: 0, fee: 0 },
  'BaseSwap':       { router: '0x327Df1E72FdB0eF3E7A1E872E15Aed1b69E5EeAa', type: 0, fee: 0 },
  // TODO: add router addresses for these DEXes on Base
  'QuickSwap':      { router: ZERO_ADDR, type: 0, fee: 0 },
  'Alien Base':     { router: ZERO_ADDR, type: 0, fee: 0 },
  'Equalizer':      { router: ZERO_ADDR, type: 0, fee: 0 },
  'SharkSwap':      { router: ZERO_ADDR, type: 0, fee: 0 },
  'Velocimeter':    { router: ZERO_ADDR, type: 0, fee: 0 },
  'SwapBased':      { router: ZERO_ADDR, type: 0, fee: 0 },
  'DackieSwap':     { router: ZERO_ADDR, type: 0, fee: 0 },
  'Solidly':        { router: ZERO_ADDR, type: 0, fee: 0 },
  'iZiSwap':        { router: ZERO_ADDR, type: 1, fee: 400 },
  'Curve':          { router: ZERO_ADDR, type: 9, fee: 0 }, // unsupported (different logic)
  'Balancer':       { router: ZERO_ADDR, type: 9, fee: 0 }, // unsupported (different logic)
}

const STABLE_TOKENS = ['USDC', 'USDbC', 'USDT', 'DAI']
const WETH_PRICE_USD  = 3500
const CBBTC_PRICE_USD = 95000

function getFlashTokenName(t0, t1) {
  if (STABLE_TOKENS.includes(t1)) return t1
  if (STABLE_TOKENS.includes(t0)) return t0
  if (t1 === 'WETH') return t1
  if (t0 === 'WETH') return t0
  return t1
}

function buildParams(opp) {
  const [t0Name, t1Name] = opp.pair.split('/')
  const token0 = TOKENS[t0Name]
  const token1 = TOKENS[t1Name]
  if (!token0 || !token1) return { ok: false, reason: `Unknown token in pair: ${opp.pair}` }

  const buyDex  = DEX_MAP[opp.buyDex]
  const sellDex = DEX_MAP[opp.sellDex]
  if (!buyDex)                              return { ok: false, reason: `Unknown buyDex: ${opp.buyDex}` }
  if (!sellDex)                             return { ok: false, reason: `Unknown sellDex: ${opp.sellDex}` }
  if (buyDex.router  === ZERO_ADDR)         return { ok: false, reason: `No router for ${opp.buyDex} (TODO)` }
  if (sellDex.router === ZERO_ADDR)         return { ok: false, reason: `No router for ${opp.sellDex} (TODO)` }
  if (buyDex.type  >= 9 || sellDex.type >= 9) return { ok: false, reason: 'Curve/Balancer not supported yet' }

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
    ok: true,
    flashTokenName:  flashName,
    flashToken:      flashToken.address,
    flashAmount,
    flashAmountFmt:  ethers.formatUnits(flashAmount, flashToken.decimals),
    buyTokenName:    buyName,
    buyToken:        buyToken.address,
    buyRouter:       buyDex.router,
    sellRouter:      sellDex.router,
    buyDexType:      buyDex.type,
    sellDexType:     sellDex.type,
    buyPoolFee:      buyDex.fee,
    sellPoolFee:     sellDex.fee,
    minProfitBps:    1,
  }
}

async function main() {
  console.log('🔍 Flash Loan Arb — Dry Run (no blockchain calls)\n')
  console.log('Scanner:', SCANNER_URL)
  console.log(`Filter:  edge ≥ ${MIN_NET_EDGE_BP} bp  |  profit ≥ $${MIN_PROFIT_USD}\n`)

  const res  = await fetch(SCANNER_URL)
  const json = await res.json()
  const all  = json.data?.opportunities ?? []

  console.log(`Total opportunities from scanner: ${all.length}`)

  const filtered = all
    .filter(o => o.netEdgeBp >= MIN_NET_EDGE_BP && o.estimatedProfitUsd >= MIN_PROFIT_USD)
    .sort((a, b) => b.estimatedProfitUsd - a.estimatedProfitUsd)

  console.log(`Matching filter: ${filtered.length}\n`)

  if (filtered.length === 0) {
    console.log('No opportunities meet the criteria right now.')
    return
  }

  let ready = 0
  let skipped = 0

  for (const opp of filtered.slice(0, 10)) {
    const p = buildParams(opp)
    const status = p.ok ? '✅ READY' : `⚠️  SKIP`
    console.log(`${status}  ${opp.pair.padEnd(16)} ${opp.buyDex.padEnd(14)}→ ${opp.sellDex.padEnd(14)}  edge=${opp.netEdgeBp.toFixed(1).padStart(5)}bp  profit=$${opp.estimatedProfitUsd.toFixed(2)}`)
    if (p.ok) {
      console.log(`         flash ${p.flashAmountFmt} ${p.flashTokenName} | buy ${p.buyTokenName} | dexTypes buy=${p.buyDexType} sell=${p.sellDexType}`)
      ready++
    } else {
      console.log(`         Reason: ${p.reason}`)
      skipped++
    }
    console.log()
  }

  console.log(`─────────────────────────────────────`)
  console.log(`Ready: ${ready}  |  Skipped: ${skipped}`)

  if (ready > 0) {
    console.log('\n✅ Params look correct. Deploy the contract and start the bot:')
    console.log('   npm run deploy   # deploy FlashLoanArb.sol')
    console.log('   npm run bot      # start automated execution')
  } else {
    console.log('\n⚠️  All opportunities use unsupported DEXes. Add router addresses to DEX_MAP.')
  }
}

main().catch(console.error)
