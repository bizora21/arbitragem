import { createConfig, http } from 'wagmi'
import { base, arbitrum, optimism, polygon, mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const supportedChains = [base, arbitrum, optimism, polygon, mainnet] as const

export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [injected()],
  transports: {
    [mainnet.id]:  http('https://cloudflare-eth.com'),
    [base.id]:     http('https://mainnet.base.org'),
    [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
    [optimism.id]: http('https://mainnet.optimism.io'),
    [polygon.id]:  http('https://polygon-rpc.com'),
  },
  ssr: true,
})

export const CONTRACTS = {
  aaveV3Pool: {
    ethereum: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2' as `0x${string}`,
    base:     '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5' as `0x${string}`,
  },
  compoundV3Comet: {
    base:     '0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf' as `0x${string}`,
    arbitrum: '0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA' as `0x${string}`,
  },
  uniswapV3Router: {
    ethereum: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45' as `0x${string}`,
    base:     '0x2626664c2603336E57B271c5C0b26F421741e481' as `0x${string}`,
  },
} as const

export const TOKENS = {
  USDC: {
    ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
    base:     '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
    arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as `0x${string}`,
  },
  USDT: {
    ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as `0x${string}`,
    base:     '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2' as `0x${string}`,
  },
  DAI: {
    ethereum: '0x6B175474E89094C44Da98b954EedeAC495271d0F' as `0x${string}`,
    base:     '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' as `0x${string}`,
  },
} as const
