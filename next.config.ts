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
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      ],
    }];
  },
};

export default nextConfig;
