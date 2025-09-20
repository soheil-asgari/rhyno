const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "https", hostname: "**" },
      { protocol: "https", hostname: "trustseal.enamad.ir" },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ["sharp", "onnxruntime-node"],
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          { type: 'host', value: 'rhynoai.ir' },       // بدون www
          { type: 'protocol', value: 'http' }          // HTTP
        ],
        destination: 'https://www.rhynoai.ir/:path*',  // هدایت مستقیم به HTTPS + www
        permanent: true,                                // 301 دائمی
      },
    ];
  }
  ,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      const ignored = Array.isArray(config.watchOptions.ignored)
        ? config.watchOptions.ignored
        : [];
      config.watchOptions.ignored = [
        ...ignored,
        /public\/sw\.js$/,
        /public\/workbox-.*\.js$/,
      ];
    }
    return config;
  },
};

module.exports = withBundleAnalyzer(withPWA(nextConfig));
