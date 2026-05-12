export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Scheduler 1: Edge Validator (funding rate cross-exchange)
    const { startScheduler } = await import('./src/lib/edge-tracker/scheduler')
    startScheduler()

    // Scheduler 2: DEX Arbitrage (on-chain DEX price monitoring)
    const { startDEXScheduler } = await import('./src/lib/dex/dex-scheduler')
    startDEXScheduler()
  }
}
