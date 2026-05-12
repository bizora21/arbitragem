/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // wagmi v3 Tempo/Coinbase Smart Wallet connector tries to import 'accounts'
    // as a runtime-only dependency that doesn't exist as a standalone package.
    // We alias it to false to skip it — we don't use Coinbase Smart Wallet.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      // Optional wagmi connector deps we don't use
      accounts: false,
      '@coinbase/wallet-sdk': false,
      '@metamask/connect-evm': false,
      porto: false,
    }
    return config
  },
}

module.exports = nextConfig
