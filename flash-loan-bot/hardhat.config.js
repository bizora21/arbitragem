require('@nomicfoundation/hardhat-toolbox')
require('dotenv').config()

const PRIVATE_KEY      = process.env.PRIVATE_KEY      || '0x' + '0'.repeat(64)
const BASE_RPC_URL     = process.env.BASE_RPC_URL      || 'https://mainnet.base.org'
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY  || ''

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    base: {
      url:      BASE_RPC_URL,
      chainId:  8453,
      accounts: [PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      base: BASESCAN_API_KEY,
    },
    customChains: [
      {
        network:  'base',
        chainId:  8453,
        urls: {
          apiURL:     'https://api.basescan.org/api',
          browserURL: 'https://basescan.org',
        },
      },
    ],
  },
}
