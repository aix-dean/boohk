/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizeCss: false,
    esmExternals: true,
  },
  transpilePackages: ['html2canvas', 'jspdf'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      }
    }

    // Exclude .map files from @sparticuz/chromium to prevent webpack parsing errors
    config.module.rules.push({
      test: /\.map$/,
      use: 'ignore-loader',
      include: /node_modules\/@sparticuz\/chromium/
    })

    return config
  },
}

export default nextConfig
