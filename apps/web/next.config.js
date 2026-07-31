/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/stellar", "@repo/ui", "@repo/domain", "@repo/backend"],
};

export default nextConfig;
