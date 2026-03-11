/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,

  /**
   * I-07: Rewrite /api/* requests to the backend service.
   *
   * In Docker Compose the browser talks to localhost:3000 (Next.js).
   * All /api/* calls are proxied server-side to http://backend:8000
   * using the NEXT_BACKEND_URL server-side env var (not NEXT_PUBLIC_*).
   * This avoids CORS issues and eliminates hardcoded backend URLs in
   * client-side bundles.
   *
   * Local dev:  NEXT_BACKEND_URL=http://localhost:8000  (or omit for default)
   * Docker:     NEXT_BACKEND_URL=http://backend:8000
   */
  async rewrites() {
    const backendUrl =
      process.env.NEXT_BACKEND_URL ?? "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
