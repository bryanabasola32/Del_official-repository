/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  productionBrowserSourceMaps: false,
  webpack: (config, { dev }) => {
    config.cache = false;
    config.snapshot = { managedPaths: [] };
    config.parallelism = 1;
    return config;
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};

module.exports = nextConfig;
