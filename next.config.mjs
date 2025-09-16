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
  // Remove static export for now - use regular build
  // output: 'export',
  // distDir: 'out',
  // trailingSlash: true,
  // assetPrefix: './'
}

export default nextConfig
