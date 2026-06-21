import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages 部署: 不使用 standalone (那是 Node 部署模式)
  // 本地开发: next dev, 生产构建: next build (默认输出)
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // 允许预览面板跨域访问 (开发期)
  allowedDevOrigins: ["*.space-z.ai"],
};

export default nextConfig;
