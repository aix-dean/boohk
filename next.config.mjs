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
  webpack: (config, { dev, isServer }) => {
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

    if (!dev) {
      // In production, configure Terser to remove console statements
      const TerserPlugin = require('terser-webpack-plugin');
      config.optimization.minimizer = [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: true,  // Removes all console.* calls
            },
          },
        }),
      ];
    }

    return config
  },
}

export default nextConfig
