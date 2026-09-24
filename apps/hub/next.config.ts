import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Linting is covered by `turbo run lint` (shared flat config in
  // @wowpixel-lab/config); skip it here to keep builds fast and quiet.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
