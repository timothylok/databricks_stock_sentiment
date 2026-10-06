/** @type {import('next').NextConfig} */
const nextConfig = {
  // Default is 5 min: clicking between pages in one session reused pages fetched before the daily bust.
  experimental: { staleTimes: { dynamic: 0, static: 30 } },
}

export default nextConfig
