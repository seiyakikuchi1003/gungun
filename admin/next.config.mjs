/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 管理画面は社内利用のため画像最適化は不要（Cloudflare Pages でも動かしやすくする）
  images: { unoptimized: true },
};
export default nextConfig;
