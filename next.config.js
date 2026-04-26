/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // 支持Docker部署
  env: {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  },
  experimental: {
    turbo: undefined, // 禁用Turbopack
  },
  typescript: {
    // 忽略验证和独立服务的类型检查
    ignoreBuildErrors: true,
  },
  eslint: {
    // 忽略 ESLint 检查
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
