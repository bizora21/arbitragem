const { ethers } = require('hardhat')

const AAVE_POOL_ADDRESSES_PROVIDER = '0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D'

async function main() {
  const [deployer] = await ethers.getSigners()
  const balance    = await ethers.provider.getBalance(deployer.address)

  console.log('─────────────────────────────────────────')
  console.log('  Flash Loan Arb — Deploy to Base Chain')
  console.log('─────────────────────────────────────────')
  console.log('Deployer:', deployer.address)
  console.log('Balance: ', ethers.formatEther(balance), 'ETH')

  if (balance < ethers.parseEther('0.001')) {
    console.error('\n❌ Insufficient ETH for deploy (need ≥ 0.001 ETH)')
    process.exit(1)
  }

  console.log('\nDeploying FlashLoanArb...')
  const FlashLoanArb = await ethers.getContractFactory('FlashLoanArb')
  const contract     = await FlashLoanArb.deploy(AAVE_POOL_ADDRESSES_PROVIDER)
  await contract.waitForDeployment()

  const address = await contract.getAddress()

  console.log('\n✅ FlashLoanArb deployed!')
  console.log('   Address:', address)
  console.log('   BaseScan: https://basescan.org/address/' + address)

  console.log('\n─── Next steps ───────────────────────────')
  console.log('1. Copy to .env:')
  console.log('   CONTRACT_ADDRESS=' + address)
  console.log('\n2. Verify on BaseScan (optional but recommended):')
  console.log(`   npx hardhat verify --network base ${address} "${AAVE_POOL_ADDRESSES_PROVIDER}"`)
  console.log('\n3. Run dry-run to test param parsing:')
  console.log('   npm run test-arb')
  console.log('\n4. Start the bot:')
  console.log('   npm run bot')
  console.log('─────────────────────────────────────────')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
