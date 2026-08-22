import type { NextConfig } from "next";

const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(
  /\/rest\/v1\/?$/,
  "",
);
const supabaseImagePattern = (() => {
  if (!configuredSupabaseUrl) return [];
  try {
    const url = new URL(configuredSupabaseUrl);
    return [
      {
        protocol: url.protocol.replace(":", "") as "http" | "https",
        hostname: url.hostname,
        port: url.port,
        pathname: "/storage/v1/object/public/restaurant-media/**",
      },
    ];
  } catch {
    return [];
  }
})();

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: supabaseImagePattern,
  },
};

export default nextConfig;
