/**
 * Aave V3 Liquidation Bot - Base Chain
 * 
 * Architecture:
 *   Phase 1 (Indexer)  - Builds persistent borrower database from events
 *   Phase 2 (Monitor)  - Watches risky positions, scores by priority
 *   Phase 3 (Executor) - Simulates PnL, executes only when profitable
 * 
 * Design principles:
 *   - Zero gas until profit is proven via simulation
 *   - Persistent state (survives restarts)
 *   - Incremental indexing (no re-scanning old blocks)
 *   - Priority scoring (focus resources on best opportunities)
 *   - Correct Aave mechanics (onBehalfOf, per-reserve positions, close factor)
 */

import { ethers } from 'ethers';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import dotenv from 'dotenv';
import { syncToSupabase, logLiquidation } from './supabase-sync.mjs';
dotenv.config();

// ============ CONFIGURATION ============

const CONFIG = {
  RPC_URL: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  PRIVATE_KEY: process.env.PRIVATE_KEY || '',
  CONTRACT_ADDRESS: process.env.LIQUIDATOR_ADDRESS || '',
  
  // Timing
  INDEX_INTERVAL_MS: 60000,        // Index new borrows every 60s
  MONITOR_FAST_MS: 5000,           // Check high-priority positions every 5s
  MONITOR_SLOW_MS: 30000,          // Check low-priority positions every 30s
  SAVE_INTERVAL_MS: 120000,        // Save state every 2 min
  
  // Thresholds
  HF_WATCH_THRESHOLD: 1.3,         // Start watching when HF < 1.3
  HF_HOT_THRESHOLD: 1.1,           // High priority when HF < 1.1
  HF_LIQUIDATABLE: 1.0,            // Can liquidate when HF < 1.0
  MIN_DEBT_USD: 100,               // Ignore positions under $100 debt
  MIN_PROFIT_USD: 1.0,             // Minimum profit after all costs
  
  // Gas
  MAX_GAS_PRICE_GWEI: 0.2,
  GAS_LIMIT: 700000,
  
  // Files
  STATE_FILE: './data/bot-state.json',
};

// Aave V3 Base addresses
const AAVE = {
  POOL: fix('0xA238Dd80C259a72e81d7e4664a9801593F98d1c5'),
};

// Token info
const TOKENS = {
  WETH:   { addr: fix('0x4200000000000000000000000000000000000006'), dec: 18, priceUsd: 2300 },
  USDC:   { addr: fix('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'), dec: 6,  priceUsd: 1 },
  USDbC:  { addr: fix('0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA'), dec: 6,  priceUsd: 1 },
  cbETH:  { addr: fix('0x2Ae3F1Ec7F1F5012CFEab0185bfc7AA3cf0DEc22'), dec: 18, priceUsd: 2400 },
  cbBTC:  { addr: fix('0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf'), dec: 8,  priceUsd: 60000 },
  wstETH: { addr: fix('0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452'), dec: 18, priceUsd: 2500 },
};

// aToken and variableDebtToken addresses (from Aave V3 Base deployment)
const RESERVES = {
  WETH:   { asset: TOKENS.WETH.addr,   aToken: fix('0xD4a0e0b9149BCee3C920d2E00b5dE09138fd8bb7'), debtToken: fix('0x24e6e0795b3c7c71D965fCc4f371803d1c1DcA1E'), dec: 18, liqBonus: 500 },
  USDC:   { asset: TOKENS.USDC.addr,   aToken: fix('0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB'), debtToken: fix('0x59dca05b6c26dBD64b5381374aAaC5CD05644C28'), dec: 6,  liqBonus: 500 },
  USDbC:  { asset: TOKENS.USDbC.addr,  aToken: fix('0x0a1d576f3eFeF75b330424287a95A366e8281D54'), debtToken: fix('0x7376b2F323dC56fCd4C191B34163ac8a84702DAB'), dec: 6,  liqBonus: 500 },
  cbETH:  { asset: TOKENS.cbETH.addr,  aToken: fix('0xcf3D55c10DB69f28fD1A75Bd73f3D8A2d9c595ad'), debtToken: fix('0x1DabC36f19909425f654777249815c073E8Fd79F'), dec: 18, liqBonus: 750 },
  cbBTC:  { asset: TOKENS.cbBTC.addr,  aToken: fix('0xBdb9300b7CDE636d9cD4AFF00f6F009fFBBc8EE2'), debtToken: fix('0x05e08702c380d63d8B0E2F6913530F45d1C0e1d6'), dec: 8,  liqBonus: 500 },
  wstETH: { asset: TOKENS.wstETH.addr, aToken: fix('0x99CBC45ea5bb7eF3a5BC08FB1B7E56bB2442Ef0D'), debtToken: fix('0x41A7C3f5e59d4718E3030e1D60A88D13AcbD1abF'), dec: 18, liqBonus: 700 },
};

// Swap routes for collateral -> debt conversion
// swapType: 0=none, 1=V3, 2=Aero volatile, 3=Aero stable
const SWAP_ROUTES = {
  // collateral -> debt -> { swapType, fee }
  // Same token = no swap needed
};

// Build swap routes dynamically
function getSwapRoute(collateral, debt) {
  const lo = (a) => a.toLowerCase();
  if (lo(collateral) === lo(debt)) return { swapType: 0, fee: 0 };
  
  // Stablecoin pairs -> Aerodrome stable
  const stables = new Set([lo(TOKENS.USDC.addr), lo(TOKENS.USDbC.addr)]);
  if (stables.has(lo(collateral)) && stables.has(lo(debt))) {
    return { swapType: 3, fee: 0 };
  }
  
  // ETH variants -> WETH via Aerodrome volatile
  const ethLike = new Set([lo(TOKENS.WETH.addr), lo(TOKENS.cbETH.addr), lo(TOKENS.wstETH.addr)]);
  
  // ETH-like -> stablecoin: Aerodrome volatile
  if (ethLike.has(lo(collateral)) && stables.has(lo(debt))) {
    return { swapType: 2, fee: 0 };
  }
  
  // Stablecoin -> ETH-like: use V3 fee=100 (proven to work)
  if (stables.has(lo(collateral)) && lo(debt) === lo(TOKENS.WETH.addr)) {
    return { swapType: 1, fee: 100 };
  }
  
  // ETH variants between each other: Aerodrome volatile
  if (ethLike.has(lo(collateral)) && ethLike.has(lo(debt))) {
    return { swapType: 2, fee: 0 };
  }
  
  // cbBTC -> anything: try Aerodrome volatile
  if (lo(collateral) === lo(TOKENS.cbBTC.addr) || lo(debt) === lo(TOKENS.cbBTC.addr)) {
    return { swapType: 2, fee: 0 };
  }
  
  // Default: Aerodrome volatile
  return { swapType: 2, fee: 0 };
}

// ============ HELPERS ============

function fix(a) { return ethers.getAddress(a.toLowerCase()); }
function lo(a) { return a.toLowerCase(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function now() { return new Date().toLocaleTimeString('pt-BR'); }

function tokenSymbol(addr) {
  const l = lo(addr);
  for (const [sym, t] of Object.entries(TOKENS)) {
    if (lo(t.addr) === l) return sym;
  }
  return addr.slice(0, 8) + '...';
}

function tokenPrice(addr) {
  const l = lo(addr);
  for (const t of Object.values(TOKENS)) {
    if (lo(t.addr) === l) return t.priceUsd;
  }
  return 0;
}

function reserveByAsset(addr) {
  const l = lo(addr);
  for (const [sym, r] of Object.entries(RESERVES)) {
    if (lo(r.asset) === l) return { sym, ...r };
  }
  return null;
}

// ============ STATE MANAGEMENT ============

let state = {
  lastIndexedBlock: 0,
  borrowers: {},        // addr -> { firstSeen, lastChecked, hf, debt, col, priority }
  watchlist: {},        // addr -> { hf, debt, col, positions: [{reserve, collateral, debt}], lastChecked }
  stats: { indexed: 0, monitored: 0, simulated: 0, executed: 0, profit: 0 },
};

function loadState() {
  try {
    if (existsSync(CONFIG.STATE_FILE)) {
      const data = JSON.parse(readFileSync(CONFIG.STATE_FILE, 'utf8'));
      state = { ...state, ...data };
      console.log(`  Loaded state: ${Object.keys(state.borrowers).length} borrowers, last block ${state.lastIndexedBlock}`);
    } else {
      console.log('  No saved state, starting fresh');
    }
  } catch(e) {
    console.log('  Failed to load state: ' + e.message);
  }
}

function saveState() {
  try {
    // Ensure data directory exists
    const dir = CONFIG.STATE_FILE.split('/').slice(0, -1).join('/');
    if (dir && !existsSync(dir)) {
      const { mkdirSync } = require('fs');
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(CONFIG.STATE_FILE, JSON.stringify(state, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  } catch(e) {
    console.log('  Save error: ' + e.message);
  }
}

// ============ PHASE 1: INDEXER ============

const POOL_ABI = [
  'event Borrow(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint8 interestRateMode, uint256 borrowRate, uint16 indexed referralCode)',
  'event Supply(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint16 indexed referralCode)',
  'event LiquidationCall(address indexed collateralAsset, address indexed debtAsset, address indexed user, uint256 debtToCover, uint256 liquidatedCollateralAmount, address liquidator, bool receiveAToken)',
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
];

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

let provider, wallet, contract, poolContract;

async function indexNewBorrowers() {
  const currentBlock = await provider.getBlockNumber();
  
  // On first run, start from 24h ago
  if (state.lastIndexedBlock === 0) {
    state.lastIndexedBlock = currentBlock - 43200;
    console.log(`  First run: starting from block ${state.lastIndexedBlock}`);
  }
  
  // Don't re-scan already processed blocks
  const fromBlock = state.lastIndexedBlock + 1;
  if (fromBlock >= currentBlock) return;

  // Scan in chunks to avoid RPC limits
  const CHUNK = 5000;
  let newBorrowers = 0;

  for (let start = fromBlock; start <= currentBlock; start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, currentBlock);
    
    try {
      // Get Borrow events
      const borrowEvents = await poolContract.queryFilter('Borrow', start, end);
      for (const e of borrowEvents) {
        // Use onBehalfOf as the position owner (correct for credit delegation)
        const owner = e.args.onBehalfOf || e.args.user;
        if (!state.borrowers[owner]) {
          state.borrowers[owner] = { 
            firstSeen: Date.now(), 
            lastChecked: 0, 
            hf: 999, 
            debt: 0, 
            col: 0, 
            priority: 0 
          };
          newBorrowers++;
        }
      }
      
      // Also track liquidations (remove already-liquidated positions)
      const liqEvents = await poolContract.queryFilter('LiquidationCall', start, end);
      for (const e of liqEvents) {
        const user = e.args.user;
        if (state.borrowers[user]) {
          state.borrowers[user].lastChecked = 0; // Force re-check
        }
      }

      state.lastIndexedBlock = end;
    } catch(e) {
      // RPC limit - wait and continue
      await sleep(2000);
    }
    
    await sleep(300); // Rate limit protection
  }
  
  if (newBorrowers > 0) {
    console.log(`  [Indexer] +${newBorrowers} new borrowers (total: ${Object.keys(state.borrowers).length}), block ${state.lastIndexedBlock}`);
    state.stats.indexed += newBorrowers;
  }
}

// ============ PHASE 2: MONITOR ============

async function checkHealthFactor(addr) {
  try {
    const data = await poolContract.getUserAccountData(addr);
    const hf = parseFloat(ethers.formatUnits(data.healthFactor, 18));
    const debt = parseFloat(ethers.formatUnits(data.totalDebtBase, 8));
    const col = parseFloat(ethers.formatUnits(data.totalCollateralBase, 8));
    return { hf, debt, col };
  } catch(e) {
    return null;
  }
}

async function getPositionDetails(addr) {
  const positions = [];
  
  for (const [sym, reserve] of Object.entries(RESERVES)) {
    try {
      const aToken = new ethers.Contract(reserve.aToken, ERC20_ABI, provider);
      const debtToken = new ethers.Contract(reserve.debtToken, ERC20_ABI, provider);
      
      const [aBalRaw, dBalRaw] = await Promise.all([
        aToken.balanceOf(addr),
        debtToken.balanceOf(addr),
      ]);
      
      const aBal = parseFloat(ethers.formatUnits(aBalRaw, reserve.dec));
      const dBal = parseFloat(ethers.formatUnits(dBalRaw, reserve.dec));
      
      if (aBal > 0.0001 || dBal > 0.0001) {
        const price = tokenPrice(reserve.asset);
        positions.push({
          reserve: sym,
          asset: reserve.asset,
          collateral: aBal,
          collateralUsd: aBal * price,
          collateralRaw: aBalRaw,
          debt: dBal,
          debtUsd: dBal * price,
          debtRaw: dBalRaw,
          liqBonus: reserve.liqBonus,
          decimals: reserve.dec,
        });
      }
    } catch(e) {
      // Skip on RPC error
    }
    await sleep(150);
  }
  
  return positions;
}

function calculatePriority(hf, debt, col) {
  if (debt < CONFIG.MIN_DEBT_USD) return 0;
  
  // Priority = proximity to liquidation * debt size * sqrt(col)
  const proximity = Math.max(0, CONFIG.HF_WATCH_THRESHOLD - hf);
  const debtFactor = Math.log10(Math.max(debt, 1));
  return proximity * debtFactor * 100;
}

async function monitorPositions() {
  const addresses = Object.keys(state.borrowers);
  if (addresses.length === 0) return;
  
  const nowMs = Date.now();
  let checked = 0;
  let watchlistUpdated = 0;
  let liquidatable = 0;
  
  // Sort by priority (highest first) and staleness
  const sorted = addresses
    .map(addr => ({ addr, ...state.borrowers[addr] }))
    .sort((a, b) => {
      // Check hot positions more frequently
      const aStale = nowMs - a.lastChecked;
      const bStale = nowMs - b.lastChecked;
      const aHot = a.hf < CONFIG.HF_HOT_THRESHOLD;
      const bHot = b.hf < CONFIG.HF_HOT_THRESHOLD;
      
      if (aHot && !bHot) return -1;
      if (bHot && !aHot) return 1;
      return b.priority - a.priority || bStale - aStale;
    });
  
  // Check up to 30 per cycle (rate limit friendly)
  const toCheck = sorted
    .filter(b => {
      const stale = nowMs - b.lastChecked;
      if (b.hf < CONFIG.HF_HOT_THRESHOLD) return stale > CONFIG.MONITOR_FAST_MS;
      return stale > CONFIG.MONITOR_SLOW_MS;
    })
    .slice(0, 30);

  for (const borrower of toCheck) {
    const result = await checkHealthFactor(borrower.addr);
    if (!result) { await sleep(300); continue; }
    
    const { hf, debt, col } = result;
    const priority = calculatePriority(hf, debt, col);
    
    // Update borrower state
    state.borrowers[borrower.addr] = {
      ...state.borrowers[borrower.addr],
      lastChecked: nowMs,
      hf, debt, col, priority,
    };
    
    // Add to watchlist if risky
    if (hf < CONFIG.HF_WATCH_THRESHOLD && debt >= CONFIG.MIN_DEBT_USD) {
      if (!state.watchlist[borrower.addr] || nowMs - (state.watchlist[borrower.addr].detailedAt || 0) > 300000) {
        // Get detailed position (every 5 min for watched positions)
        const positions = await getPositionDetails(borrower.addr);
        state.watchlist[borrower.addr] = {
          hf, debt, col, priority, positions,
          detailedAt: nowMs,
          lastChecked: nowMs,
        };
        watchlistUpdated++;
      } else {
        state.watchlist[borrower.addr].hf = hf;
        state.watchlist[borrower.addr].debt = debt;
        state.watchlist[borrower.addr].col = col;
        state.watchlist[borrower.addr].priority = priority;
        state.watchlist[borrower.addr].lastChecked = nowMs;
      }
    }
    
    // Remove from watchlist if healthy again
    if (hf > CONFIG.HF_WATCH_THRESHOLD + 0.1) {
      delete state.watchlist[borrower.addr];
    }
    
    // LIQUIDATABLE!
    if (hf < CONFIG.HF_LIQUIDATABLE && debt >= CONFIG.MIN_DEBT_USD) {
      liquidatable++;
      console.log(`  ðŸ”´ LIQUIDATABLE: ${borrower.addr.slice(0, 12)}... HF=${hf.toFixed(4)} debt=$${debt.toFixed(0)}`);
    }
    
    checked++;
    await sleep(200);
  }
  
  state.stats.monitored = Object.keys(state.watchlist).length;
  
  if (checked > 0 || watchlistUpdated > 0) {
    const watchCount = Object.keys(state.watchlist).length;
    const hotCount = Object.values(state.watchlist).filter(w => w.hf < CONFIG.HF_HOT_THRESHOLD).length;
    console.log(`  [Monitor] Checked ${checked} | Watchlist: ${watchCount} (${hotCount} hot) | Liquidatable: ${liquidatable}`);
  }
  
  return liquidatable;
}

// ============ PHASE 3: EXECUTOR ============

// On-chain quote ABIs (proven to work)
const AERO_IFACE = new ethers.Interface([
  'function getAmountsOut(uint256 amountIn, tuple(address from, address to, bool stable, address factory)[] routes) view returns (uint256[])',
]);
const QUOTER_V2 = fix('0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a');
const QUOTER_IFACE = new ethers.Interface([
  'function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
]);
const AERO_ROUTER = fix('0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43');
const AERO_FACTORY = fix('0x420DD381b31aEf6683db6B902084cB0FFECe40Da');

async function quoteSwap(tokenIn, tokenOut, amountIn, swapType, fee) {
  try {
    if (swapType === 0) return amountIn; // No swap needed
    
    if (swapType === 1) {
      // V3
      const cd = QUOTER_IFACE.encodeFunctionData('quoteExactInputSingle', [{
        tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0
      }]);
      const res = await provider.call({ to: QUOTER_V2, data: cd });
      if (res === '0x' || res.length < 10) return null;
      return QUOTER_IFACE.decodeFunctionResult('quoteExactInputSingle', res).amountOut;
    }
    
    if (swapType === 2 || swapType === 3) {
      // Aerodrome
      const stable = swapType === 3;
      const cd = AERO_IFACE.encodeFunctionData('getAmountsOut', [
        amountIn, [{ from: tokenIn, to: tokenOut, stable, factory: AERO_FACTORY }]
      ]);
      const res = await provider.call({ to: AERO_ROUTER, data: cd });
      if (res === '0x' || res.length < 10) return null;
      return AERO_IFACE.decodeFunctionResult('getAmountsOut', res)[0][1];
    }
  } catch(e) {
    return null;
  }
  return null;
}

async function simulateLiquidation(userAddr, watchData) {
  const positions = watchData.positions;
  if (!positions || positions.length === 0) return null;
  
  // Find best collateral/debt pair
  const debtPositions = positions.filter(p => p.debt > 0.0001);
  const colPositions = positions.filter(p => p.collateral > 0.0001);
  
  if (debtPositions.length === 0 || colPositions.length === 0) return null;
  
  let bestPnl = -Infinity;
  let bestParams = null;
  
  for (const debtPos of debtPositions) {
    for (const colPos of colPositions) {
      // Skip if same asset (can't liquidate with same collateral and debt)
      if (lo(debtPos.asset) === lo(colPos.asset)) continue;
      
      // Close factor: 50% normally, 100% if HF <= 0.95 or debt < $2000
      const closeFactor = (watchData.hf <= 0.95 || debtPos.debtUsd < 2000) ? 1.0 : 0.5;
      const debtToCover = debtPos.debtRaw * BigInt(Math.floor(closeFactor * 100)) / 100n;
      
      if (debtToCover === 0n) continue;
      
      // Calculate collateral received (with liquidation bonus)
      // collateralReceived = (debtToCover * debtPrice / colPrice) * (1 + bonus)
      const debtUsdValue = parseFloat(ethers.formatUnits(debtToCover, debtPos.decimals)) * tokenPrice(debtPos.asset);
      const bonusMultiplier = 1 + (colPos.liqBonus / 10000);
      const colUsdReceived = debtUsdValue * bonusMultiplier;
      const colPrice = tokenPrice(colPos.asset);
      if (colPrice === 0) continue;
      
      const colAmountReceived = colUsdReceived / colPrice;
      const colAmountRaw = ethers.parseUnits(colAmountReceived.toFixed(colPos.decimals > 8 ? 8 : colPos.decimals), colPos.decimals);
      
      // Check if position has enough collateral
      if (colAmountRaw > colPos.collateralRaw) continue;
      
      // Get swap route
      const route = getSwapRoute(colPos.asset, debtPos.asset);
      
      // Quote the swap
      const swapOut = await quoteSwap(colPos.asset, debtPos.asset, colAmountRaw, route.swapType, route.fee);
      if (!swapOut) continue;
      
      // Calculate PnL
      const debtPaidRaw = debtToCover;
      const flashLoanFee = debtPaidRaw * 5n / 10000n; // 0.05% Aave fee
      const totalCost = debtPaidRaw + flashLoanFee;
      
      let profitRaw;
      if (route.swapType === 0) {
        // No swap: collateral == debt token
        profitRaw = colAmountRaw - totalCost;
      } else {
        profitRaw = swapOut - totalCost;
      }
      
      const profitUsd = parseFloat(ethers.formatUnits(profitRaw, debtPos.decimals)) * tokenPrice(debtPos.asset);
      
      // Subtract estimated gas cost
      const gasCostUsd = 0.05; // ~$0.05 on Base
      const netProfitUsd = profitUsd - gasCostUsd;
      
      if (netProfitUsd > bestPnl) {
        bestPnl = netProfitUsd;
        bestParams = {
          user: userAddr,
          collateralAsset: colPos.asset,
          collateralSymbol: colPos.reserve,
          debtAsset: debtPos.asset,
          debtSymbol: debtPos.reserve,
          debtToCover,
          swapType: route.swapType,
          swapFee: route.fee,
          estimatedProfitUsd: netProfitUsd,
          colReceived: colAmountReceived,
          debtPaid: parseFloat(ethers.formatUnits(debtToCover, debtPos.decimals)),
        };
      }
      
      await sleep(200);
    }
  }
  
  return bestParams;
}

async function executeLiquidation(params) {
  if (!contract) {
    console.log('  No contract configured - simulation only');
    return false;
  }
  
  console.log(`\n  âš¡ EXECUTING LIQUIDATION`);
  console.log(`    User: ${params.user}`);
  console.log(`    Debt: ${params.debtPaid.toFixed(4)} ${params.debtSymbol}`);
  console.log(`    Collateral: ${params.colReceived.toFixed(4)} ${params.collateralSymbol}`);
  console.log(`    Swap: type=${params.swapType} fee=${params.swapFee}`);
  console.log(`    Est. profit: $${params.estimatedProfitUsd.toFixed(2)}`);
  
  // Min profit in debt token units (for contract)
  const debtDec = RESERVES[params.debtSymbol]?.dec || 18;
  const minProfitRaw = ethers.parseUnits(
    Math.max(0.001, CONFIG.MIN_PROFIT_USD / tokenPrice(params.debtAsset)).toFixed(debtDec > 8 ? 8 : debtDec),
    debtDec
  );
  
  const liqParams = {
    collateralAsset: params.collateralAsset,
    debtAsset: params.debtAsset,
    user: params.user,
    debtToCover: params.debtToCover,
    swapType: params.swapType,
    swapFee: params.swapFee,
    minProfit: minProfitRaw,
  };
  
  // Step 1: Simulate with staticCall
  try {
    await contract.executeLiquidation.staticCall(liqParams);
    console.log('    âœ… Simulation PASSED');
  } catch(e) {
    console.log('    âŒ Simulation FAILED: ' + (e.reason || e.shortMessage || e.message || '').slice(0, 150));
    state.stats.simulated++;
    return false;
  }
  
  // Step 2: Check gas balance
  const bal = await provider.getBalance(wallet.address);
  if (bal < ethers.parseEther('0.0003')) {
    console.log('    âš ï¸ Gas too low! Need at least 0.0003 ETH');
    return false;
  }
  
  // Step 3: Execute
  try {
    const tx = await contract.executeLiquidation(liqParams, {
      gasLimit: CONFIG.GAS_LIMIT,
      maxFeePerGas: ethers.parseUnits(CONFIG.MAX_GAS_PRICE_GWEI.toString(), 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('0.05', 'gwei'),
    });
    console.log('    TX: ' + tx.hash);
    
    const receipt = await tx.wait();
    if (receipt?.status === 1) {
      console.log('    ðŸŽ‰ SUCCESS! https://basescan.org/tx/' + tx.hash);
      state.stats.executed++;
      state.stats.profit += params.estimatedProfitUsd;
      await logLiquidation(params, tx.hash, 'success').catch(() => {});
      return true;
    } else {
      console.log('    âŒ TX REVERTED on-chain');
      return false;
    }
  } catch(e) {
    console.log('    âŒ TX ERROR: ' + (e.reason || e.shortMessage || e.message || '').slice(0, 200));
    return false;
  }
}

// ============ MAIN LOOP ============

async function mainLoop() {
  console.log(`\n[${now()}] === Cycle ===`);
  
  // Phase 1: Index new borrowers
  try {
    await indexNewBorrowers();
  } catch(e) {
    console.log('  Index error: ' + e.message?.slice(0, 100));
  }
  
  // Phase 2: Monitor positions
  let liquidatableCount = 0;
  try {
    liquidatableCount = await monitorPositions();
  } catch(e) {
    console.log('  Monitor error: ' + e.message?.slice(0, 100));
  }
  
  // Phase 3: Try to liquidate if any are below threshold
  if (liquidatableCount > 0) {
    const targets = Object.entries(state.watchlist)
      .filter(([_, w]) => w.hf < CONFIG.HF_LIQUIDATABLE && w.debt >= CONFIG.MIN_DEBT_USD)
      .sort(([_, a], [__, b]) => a.hf - b.hf); // Most underwater first
    
    for (const [addr, watchData] of targets) {
      console.log(`\n  ðŸ” Simulating liquidation of ${addr.slice(0, 12)}... (HF=${watchData.hf.toFixed(4)}, debt=$${watchData.debt.toFixed(0)})`);
      
      // Get fresh position details
      const positions = await getPositionDetails(addr);
      if (positions.length === 0) {
        console.log('    No positions found');
        continue;
      }
      watchData.positions = positions;
      
      // Simulate PnL
      const sim = await simulateLiquidation(addr, watchData);
      state.stats.simulated++;
      
      if (!sim) {
        console.log('    No profitable liquidation found');
        continue;
      }
      
      if (sim.estimatedProfitUsd < CONFIG.MIN_PROFIT_USD) {
        console.log(`    Profit too low: $${sim.estimatedProfitUsd.toFixed(2)} < $${CONFIG.MIN_PROFIT_USD}`);
        continue;
      }
      
      console.log(`    Best pair: ${sim.collateralSymbol}->${sim.debtSymbol}, profit: $${sim.estimatedProfitUsd.toFixed(2)}`);
      
      // Execute!
      await executeLiquidation(sim);
      break; // One at a time
    }
  }
  
  // Print summary
  const wl = Object.keys(state.watchlist).length;
  const total = Object.keys(state.borrowers).length;
  console.log(`  [Summary] Borrowers: ${total} | Watchlist: ${wl} | Stats: ${state.stats.simulated} sims, ${state.stats.executed} exec, $${state.stats.profit.toFixed(2)} profit`);

  // Sync to Supabase
  try { await syncToSupabase(state, TOKENS.WETH.priceUsd); } catch(e) { console.log('  [Supabase] sync error: ' + e.message?.slice(0, 80)); }
}

// ============ STARTUP ============

async function start() {
  console.log('=== Aave V3 Liquidation Bot - Base ===\n');
  
  // Setup provider
  provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
  poolContract = new ethers.Contract(AAVE.POOL, POOL_ABI, provider);
  
  // Setup wallet (if available)
  if (CONFIG.PRIVATE_KEY) {
    wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);
    const bal = await provider.getBalance(wallet.address);
    console.log(`  Wallet: ${wallet.address}`);
    console.log(`  Gas: ${ethers.formatEther(bal)} ETH ($${(parseFloat(ethers.formatEther(bal)) * 2300).toFixed(2)})`);
  } else {
    console.log('  No wallet configured - MONITOR ONLY mode');
  }
  
  // Setup contract (if available)
  if (CONFIG.CONTRACT_ADDRESS && CONFIG.PRIVATE_KEY) {
    const LIQUIDATOR_ABI = [
      'function executeLiquidation(tuple(address collateralAsset, address debtAsset, address user, uint256 debtToCover, uint8 swapType, uint24 swapFee, uint256 minProfit) params) external',
      'function withdraw(address token) external',
    ];
    contract = new ethers.Contract(fix(CONFIG.CONTRACT_ADDRESS), LIQUIDATOR_ABI, wallet);
    console.log(`  Contract: ${CONFIG.CONTRACT_ADDRESS}`);
  } else {
    console.log('  No contract - will simulate only (zero gas cost)');
  }
  
  // Load saved state
  loadState();
  
  // Update token prices
  console.log('\n  Fetching ETH price...');
  try {
    const cd = AERO_IFACE.encodeFunctionData('getAmountsOut', [
      ethers.parseEther('1'),
      [{ from: TOKENS.WETH.addr, to: TOKENS.USDC.addr, stable: false, factory: AERO_FACTORY }]
    ]);
    const res = await provider.call({ to: AERO_ROUTER, data: cd });
    if (res !== '0x' && res.length > 10) {
      const dec = AERO_IFACE.decodeFunctionResult('getAmountsOut', res);
      const ethPrice = parseFloat(ethers.formatUnits(dec[0][1], 6));
      TOKENS.WETH.priceUsd = ethPrice;
      TOKENS.cbETH.priceUsd = ethPrice * 1.02; // ~2% premium
      TOKENS.wstETH.priceUsd = ethPrice * 1.05; // ~5% premium
      console.log(`  ETH price: $${ethPrice.toFixed(2)}`);
    }
  } catch(e) {
    console.log('  Price fetch failed, using defaults');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('  Config:');
  console.log('    Watch threshold: HF < ' + CONFIG.HF_WATCH_THRESHOLD);
  console.log('    Hot threshold: HF < ' + CONFIG.HF_HOT_THRESHOLD);
  console.log('    Min debt: $' + CONFIG.MIN_DEBT_USD);
  console.log('    Min profit: $' + CONFIG.MIN_PROFIT_USD);
  console.log('    Mode: ' + (contract ? 'LIVE' : 'MONITOR ONLY'));
  console.log('='.repeat(60));
  
  // Auto-save periodically
  setInterval(saveState, CONFIG.SAVE_INTERVAL_MS);
  
  // Main loop
  console.log('\nStarting...\n');
  
  while (true) {
    try {
      await mainLoop();
    } catch(e) {
      console.log('  Loop error: ' + e.message?.slice(0, 150));
    }
    
    // Dynamic interval: faster when there are hot positions
    const hasHot = Object.values(state.watchlist).some(w => w.hf < CONFIG.HF_HOT_THRESHOLD);
    const interval = hasHot ? CONFIG.MONITOR_FAST_MS : CONFIG.INDEX_INTERVAL_MS;
    await sleep(interval);
  }
}

start().catch(e => { console.error('Fatal:', e); process.exit(1); });

